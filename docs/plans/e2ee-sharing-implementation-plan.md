# E2EE Secure Sharing — Implementation Plan

**Version:** 1.1
**Last Updated:** 2026-03-02
**Status:** Approved (Peer Reviewed)
**Author:** Claude (Opus 4.6)
**Design Doc:** [`docs/analysis/e2ee-sharing-design-claude.md`](../analysis/e2ee-sharing-design-claude.md)
**Peer Review:** [`docs/reviews/plan-review-b7d4e91f.md`](../reviews/plan-review-b7d4e91f.md) — 2 rounds, 7 findings, APPROVED

---

## Original Prompt

> Now that we have implemented E2EE and refined it, I want to bring back the "sharing" option. How can we do that securely?

---

## Context

Yidhan's sharing feature ("Share as Letter") was disabled when E2EE was introduced — the migration `expire_shares_for_e2ee.sql` deleted all shares and revoked public RLS policies. Now we're re-enabling sharing using **client-side encrypted share links** (capability-link model), where the decryption key lives in the URL fragment and the server never sees plaintext.

See the [design doc](../analysis/e2ee-sharing-design-claude.md) for the full architecture, cryptographic envelope spec, security hardening details, and the Codex review decisions log.

## Files to Modify/Create

| File | Action | Phase |
|------|--------|-------|
| `supabase/migrations/enable_e2ee_sharing.sql` | NEW | 0 |
| `src/lib/encryption.ts` | MODIFY | 1 |
| `src/types.ts` | MODIFY | 2 |
| `src/types/database.ts` | MODIFY | 2 |
| `src/services/notes.ts` | MODIFY | 2 |
| `src/App.tsx` | MODIFY | 3 |
| `src/components/SharedNoteView.tsx` | MODIFY | 4 |
| `src/components/ShareModal.tsx` | MODIFY | 5 |
| `src/components/Editor.tsx` | MODIFY | 5 |
| `src/main.tsx` | MODIFY | 6 |
| `vercel.json` | NEW | 7 |
| `vite.config.ts` | MODIFY | 7 |
| `index.html` | MODIFY | 7 |
| `src/lib/__tests__/shareEncryption.test.ts` | NEW | 8 |
| `src/services/__tests__/shareService.test.ts` | NEW | 8 |
| `e2e/sharing.spec.ts` | MODIFY | 8 |

---

## Phase 0: Database Migration

**New file: `supabase/migrations/enable_e2ee_sharing.sql`**

Schema changes to `note_shares` table:
- Add `encrypted_payload text NOT NULL` — AES-256-GCM ciphertext (base64)
- Add `iv text NOT NULL` — 12-byte IV (base64)
- Add `encryption_version smallint NOT NULL DEFAULT 1`
- Add `revoked_at timestamptz DEFAULT NULL` — soft-delete revocation
- Widen `share_token` from `varchar(32)` to `varchar(64)` (new 22-char tokens fit, but headroom for future)
- Keep `UNIQUE(note_id)` constraint — re-sharing after revoke uses upsert (see Phase 2)

RPC function for public access:
```sql
CREATE OR REPLACE FUNCTION fetch_shared_note(share_token_param text)
RETURNS TABLE (
  encrypted_payload text,
  iv text,
  encryption_version smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT ns.encrypted_payload, ns.iv, ns.encryption_version
  FROM note_shares ns
  JOIN notes n ON n.id = ns.note_id
  WHERE ns.share_token = share_token_param
    AND ns.revoked_at IS NULL
    AND ns.expires_at > now()
    AND n.deleted_at IS NULL;
  -- Uniform empty result for not-found/expired/revoked/soft-deleted note (no enumeration)
END;
$$;
```

RLS policy changes:
- Drop the disabled read-only policy from `expire_shares_for_e2ee.sql`
- Create owner management policy: `FOR ALL USING (auth.uid() = user_id)`
- Grant `EXECUTE` on RPC to `anon` + `authenticated` roles
- NO public SELECT policy on `note_shares` — public access goes through RPC only

---

## Phase 1: Crypto Helpers

**Modify: `src/lib/encryption.ts`**

Export existing helpers (currently module-private at lines 71, 79):
- `toBase64(bytes)` — make exported
- `fromBase64(base64)` — make exported

Add new exported functions:
- `toBase64Url(bytes: Uint8Array): string` — URL-safe base64 (replace `+`→`-`, `/`→`_`, strip `=`)
- `fromBase64Url(b64url: string): Uint8Array` — inverse
- `generateShareToken(): string` — **22-char base64url from 16 random bytes (128 bits entropy).** `crypto.getRandomValues(new Uint8Array(16))` → `toBase64Url()` produces exactly 22 chars unpadded.
- `generateShareKey(): Uint8Array` — 32 random bytes
- `encryptSharePayload(token, shareKey, payload): Promise<EncryptedShareData>` — AES-256-GCM, 12-byte random IV, AAD: `share:<token>:v1`
- `decryptSharePayload(token, shareKeyBytes, encrypted): Promise<SharePayload>` — decrypt + validate schema version

New types in same file:
```typescript
export interface SharePayload {
  version: 1;
  title: string;
  content: string;
  tags: Array<{ name: string; color: string }>;
  sharedAt: string; // ISO 8601
}

export interface EncryptedShareData {
  ciphertext: string; // base64 (standard — consistent with existing DB storage)
  iv: string;
  version: number;
}
```

Reuse existing pattern: `importAesKey()` (line ~87) for importing the share key as a non-extractable CryptoKey. Either export it or inline the `crypto.subtle.importKey` call.

---

## Phase 2: Service Layer

**Modify: `src/types.ts`** — Update `NoteShare` interface:
```typescript
export interface NoteShare {
  id: string;
  noteId: string;
  userId: string;
  shareToken: string;
  expiresAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;        // NEW
}
```
(No need to expose encrypted_payload/iv in the TS type — those are DB-only fields.)

**Modify: `src/types/database.ts`** — Update `note_shares` Row/Insert/Update types + add RPC function type.

**Modify: `src/services/notes.ts`** (share functions at lines 451-652):

| Function | Change |
|----------|--------|
| `generateShareToken()` (line 468) | Replace UUID-based with `generateShareToken()` from encryption.ts |
| `createNoteShare(noteId, userId, note, expiresInDays)` | Add `note: Note` param. Generate shareKey, encrypt payload. **Use upsert**: if a row exists for this `note_id` (revoked or expired), update it with fresh token, payload, IV, `revoked_at = null`, new expiry. Otherwise insert. Return `{ share, shareKey }`. |
| `getNoteShare(noteId)` | Add filter: `.is('revoked_at', null)` + expiry check |
| `deleteNoteShare` → `revokeNoteShare(noteId)` | Soft-delete: `UPDATE SET revoked_at = now()` |
| `updateNoteShareExpiration(noteId, days)` | Cap at 30 days, filter revoked |
| `fetchSharedNote(token)` | **Rewrite entirely**: call RPC `fetch_shared_note`, return `EncryptedShareData \| null` |
| `fetchAllNoteShares()` | Filter out revoked shares |

Key constraint: `fetchSharedNote` return type changes from `Note | null` to `EncryptedShareData | null`. The old plaintext path is fully removed.

**Upsert detail for `createNoteShare`:**
```typescript
// Check for existing row (revoked or expired)
const existing = await supabase
  .from('note_shares')
  .select('id')
  .eq('note_id', noteId)
  .single();

if (existing.data) {
  // Update existing row with fresh share data
  await supabase.from('note_shares').update({
    share_token: token,
    encrypted_payload: encrypted.ciphertext,
    iv: encrypted.iv,
    encryption_version: encrypted.version,
    expires_at: expiresAt,
    revoked_at: null, // Reset revocation
  }).eq('id', existing.data.id);
} else {
  // Insert new row
  await supabase.from('note_shares').insert({ ... });
}
```

---

## Phase 3: URL Routing

**Modify: `src/App.tsx`** (lines 395-398, 1643-1661)

URL format change: `/?s=<token>` → `/s/<token>/<optional-slug>#k=<base64url-key>`

Replace `shareToken` state with `shareRoute`:
```typescript
const [shareRoute, setShareRoute] = useState<{ token: string; shareKey: Uint8Array } | null>(() => {
  const match = window.location.pathname.match(/^\/s\/([A-Za-z0-9_-]{22})(?:\/|$)/);
  if (!match) return null;
  const token = match[1];
  const keyMatch = window.location.hash.match(/^#k=([A-Za-z0-9_-]{43})$/);
  if (!keyMatch) return { token, shareKey: new Uint8Array(0) }; // missing key → "incomplete"
  try {
    const shareKey = fromBase64Url(keyMatch[1]);
    return shareKey.length === 32 ? { token, shareKey } : { token, shareKey: new Uint8Array(0) };
  } catch { return { token, shareKey: new Uint8Array(0) }; }
});
```

> **Note:** Token regex `{22}` matches the corrected 16-byte → 22-char base64url token. Key regex `{43}` matches 32-byte → 43-char base64url key.

After parsing, clear the hash from the URL (defense in depth):
```typescript
if (window.location.hash.startsWith('#k=')) {
  window.history.replaceState({}, '', window.location.pathname);
}
```

Update render block to pass `shareKey` to SharedNoteView.

---

## Phase 4: SharedNoteView (Recipient Decryption)

**Modify: `src/components/SharedNoteView.tsx`**

Props change: add `shareKey: Uint8Array`

New loading states: add `'decrypting'` and `'incomplete'`

Updated flow:
1. If `shareKey.length !== 32` → show "This link appears incomplete"
2. Call `fetchSharedNote(token)` (returns encrypted data via RPC)
3. If null → show "This letter has faded" (uniform for not-found/expired/revoked/soft-deleted note)
4. Call `decryptSharePayload(token, shareKey, encryptedData)`
5. If decryption fails → show "This link appears incomplete"
6. Sanitize decrypted HTML via `sanitizeHtml()`
7. Render read-only letter view with title, content, tag badges

Add `Referrer-Policy: no-referrer` meta tag via useEffect.

Replace `note: Note | null` state with `decryptedPayload: SharePayload | null`.

---

## Phase 5: ShareModal (Creator Encryption)

**Modify: `src/components/ShareModal.tsx`**

- Remove `null` from expiry options (no "Never") → `1 | 7 | 30` days only
- Add `includeSlug` toggle state (default: true)
- Add `generateSlug(title)` helper: lowercase, hyphenate, truncate to 60 chars
- URL generation: `${origin}/s/${token}${slug ? '/' + slug : ''}#k=${toBase64Url(shareKey)}`
- On create: call updated `createNoteShare()`, get back `{ share, shareKey }`
- Store shareKey in component state (memory only, never persisted)
- On re-open with existing share: show share exists but key is not recoverable. Display: "The complete link was shown when created. Revoke and re-create if needed." Copy button disabled.
- Replace `deleteNoteShare` call with `revokeNoteShare`
- Update privacy tip text to explain E2EE

**Modify: `src/components/Editor.tsx`** (line 33):
- Change `const sharingEnabled = false` → `const sharingEnabled = true`

---

## Phase 6: Sentry Scrubbing

**Modify: `src/main.tsx`**

Extend `beforeSend` handler:
- Strip URL fragments from `event.request.url`
- Strip fragments from breadcrumb `data.url`, `data.from`, `data.to`

Disable Sentry session replay on shared note routes:
- Check `window.location.pathname` on init — if it starts with `/s/`, do not initialize `replayIntegration`
- This prevents any decrypted content (title, tags, note body) from being captured in session replays

---

## Phase 7: Configuration & Security Headers

**New file: `vercel.json`**
```json
{
  "rewrites": [
    { "source": "/s/:path*", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/s/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store, private" },
        { "key": "Surrogate-Control", "value": "no-store" },
        { "key": "Referrer-Policy", "value": "no-referrer" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co; img-src 'self' data:; frame-ancestors 'none'" }
      ]
    }
  ]
}
```

**Modify: `vite.config.ts`** (line 34):
- Add `/s/` to PWA `navigateFallbackDenylist`: `[/^\/api/, /^\/share\//, /^\/s\//]`
- Ensures shared note pages always fetch fresh from server (not served from PWA cache)

**Modify: `index.html`**:
- Add `<meta name="referrer" content="strict-origin-when-cross-origin" />` (default policy; Vercel header overrides to `no-referrer` for `/s/*`)

**Rate limiting:** Deferred to post-v1 hardening. Vercel does not offer built-in edge rate limiting without middleware or Edge Config. The 128-bit token entropy makes brute-force enumeration infeasible even without rate limiting. Will revisit with Vercel Firewall or Supabase pg_net when available.

---

## Phase 8: Tests

**New file: `src/lib/__tests__/shareEncryption.test.ts`** — Crypto unit tests:
- `toBase64Url` / `fromBase64Url` roundtrip
- `generateShareToken` — 22 chars, only `[A-Za-z0-9_-]`
- `encryptSharePayload` / `decryptSharePayload` roundtrip
- Wrong key → decryption failure
- Wrong token (AAD mismatch) → decryption failure
- Tampered ciphertext → decryption failure
- `generateSlug` edge cases (empty, unicode, long titles, special chars)

**New file: `src/services/__tests__/shareService.test.ts`** — Service layer tests:
- `createNoteShare` encrypts payload and inserts/upserts correctly
- `revokeNoteShare` sets `revoked_at` (soft-delete)
- `getNoteShare` filters revoked and expired shares
- `fetchSharedNote` calls RPC and returns `EncryptedShareData | null`
- `createNoteShare` upsert: re-create after revoke resets `revoked_at` and generates fresh token

**Modify: `e2e/sharing.spec.ts`** — Update E2E tests for new URL format:
- Update share link format assertions from `/?s=<token>` to `/s/<token>/...#k=...`
- Test share creation, copy, and open in separate context (incognito)
- Test revoke flow
- Test expired link shows "faded" message
- Test truncated link (no `#k=`) shows "incomplete" message

---

## What NOT to Do

1. Do NOT re-enable the old plaintext `fetchSharedNote` path (direct `notes` table query)
2. Do NOT use vault passphrase keys (`DerivedKeys`) for share encryption — each share gets a fresh random key
3. Do NOT re-enable public SELECT policies on `notes`, `tags`, or `note_tags`
4. Do NOT store the share key on the server — it exists only in the URL fragment
5. Do NOT allow "Never expires" — max TTL is 30 days
6. Do NOT log URL fragments in Sentry, analytics, or console
7. Do NOT import `EncryptionContext` in `SharedNoteView` — the recipient has no vault

---

## Verification

1. **Crypto layer**: Run `npm run test` — new tests in `shareEncryption.test.ts` should pass
2. **Service layer**: Run `npm run test` — new tests in `shareService.test.ts` should pass
3. **Full CI**: Run `npm run check` (typecheck + lint + test + build)
4. **Manual E2E flow**:
   - Sign in, unlock vault, open a note
   - Click Share → modal shows encrypted link with `#k=...` fragment
   - Copy link, open in incognito browser (no account)
   - Note should render as read-only letter
   - Test with truncated URL (no `#k=`) → "This link appears incomplete"
   - Revoke share → link shows "This letter has faded"
   - Test expiry (set 24h, fast-forward in DB) → "This letter has faded"
   - Soft-delete note → share link shows "This letter has faded"
   - Re-create share after revoke → new link works
5. **Security checks**:
   - Verify URL fragment NOT in Sentry events (check Sentry dashboard)
   - Verify `Cache-Control: no-store` header on `/s/*` responses
   - Verify `Referrer-Policy: no-referrer` header on `/s/*` responses
   - Verify CSP header on `/s/*` responses
   - Verify RPC returns empty for invalid/expired/revoked tokens (no enumeration)
   - Verify RPC returns empty when underlying note is soft-deleted

---

## Implementation Sequence

Phases 0-2 (DB + crypto + service) → Phases 3-5 (routing + UI) → Phases 6-7 (hardening) → Phase 8 (tests)

Single PR targeting `main`, branch: `feature/e2ee-sharing`
