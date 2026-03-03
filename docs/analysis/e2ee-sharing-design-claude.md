# E2EE Secure Sharing — Design Summary

**Version:** 1.1
**Last Updated:** 2026-03-02
**Status:** Draft
**Author:** Claude (Opus 4.6)
**Reviewed by:** Codex (2026-03-02) — 7 findings incorporated
**Implementation Plan:** [`docs/plans/e2ee-sharing-implementation-plan.md`](../plans/e2ee-sharing-implementation-plan.md)
**Plan Review:** [`docs/reviews/plan-review-b7d4e91f.md`](../reviews/plan-review-b7d4e91f.md) — APPROVED (2 rounds, 7 findings)

---

## Original Prompt

> Now that we have implemented E2EE and refined it, I want to bring back the "sharing" option. How can we do that securely?

---

## Decision: Client-Side Encrypted Share Links (Capability-Link Model)

After evaluating four approaches (server-side decrypt, client-side encrypted links, recipient-key sharing, passphrase-protected), we chose **client-side encrypted share links** — the same zero-knowledge pattern used by Firefox Send, PrivateBin, and Bitwarden Send.

The server never sees note content. The decryption key lives only in the URL fragment, which browsers never send to the server.

---

## Architecture

### Core Principles

- **Per-share encryption key** — never reuse the vault passphrase key
- **Snapshot sharing** — shared content is frozen at share time, does not auto-update
- **Capability-link model** — the URL _is_ the credential; anyone with the full link can read the note
- **Zero-knowledge server** — server stores only ciphertext; cannot read shared content
- **Maximum TTL** — shares expire after at most 30 days (no "never expires" option in v1)

### URL Format

```
https://yidhan.vercel.app/s/<token>/<title-slug>#k=<base64url-shareKey>
```

- `<token>` — **22-char base64url** random ID (132-bit entropy), used by server for lookup
- `<title-slug>` — human-readable slug from note title (cosmetic, ignored by server — Stack Overflow pattern). **Optional** — sharer can toggle it off in the share modal for sensitive notes. Generated client-side only; never stored or processed by server.
- `#k=<shareKey>` — 32-byte AES key in base64url (~43 chars); fragment is never sent to server

**Examples:**
```
With slug:    yidhan.vercel.app/s/xQ9mK7bR2pN4wZ8vL3hY5a/grocery-list-for-weekend#k=...
Without slug: yidhan.vercel.app/s/xQ9mK7bR2pN4wZ8vL3hY5a#k=...
```

> **Metadata note:** The title slug is visible to intermediaries (server logs, CDN, link previews, browser history). This is an intentional UX tradeoff — the sharer has already chosen to share this note. The toggle-off option is provided for sensitive titles.

### Cryptographic Envelope

| Parameter | Specification |
|-----------|--------------|
| Algorithm | AES-256-GCM |
| Key | 32 bytes, cryptographically random (`crypto.getRandomValues`) |
| IV | 12 bytes, cryptographically random (`crypto.getRandomValues`), unique per share |
| AAD | `share:<token>:v1` (binds ciphertext to specific share, prevents swap/replay) |
| Payload | `{ version: 1, title, content, tags, sharedAt }` — schema version inside encrypted blob |

AAD binding ensures that ciphertext from one share token cannot be swapped onto another token's row. The `v1` suffix enables future algorithm upgrades without downgrade risk.

### Encryption Flow (Sharer)

1. Client decrypts the note locally (already in memory after vault unlock)
2. Generate random 32-byte `shareKey` via Web Crypto `getRandomValues`
3. Generate random 12-byte IV via Web Crypto `getRandomValues`
4. Construct plaintext payload: `{ version: 1, title, content, tags, sharedAt }`
5. Encrypt with AES-256-GCM using `shareKey`, IV, and AAD `share:<token>:v1`
6. Store ciphertext + IV + encryption_version + expiry + token in `note_shares` table
7. Construct URL with token, optional title slug, and `#k=shareKey`
8. Present link to user for copying

### Decryption Flow (Recipient)

1. Recipient clicks the link — opens in browser
2. Client-side JS reads `shareKey` from `location.hash`
3. If no key in fragment → show "This link appears incomplete"
4. Fetches encrypted payload from server by token (via RPC)
5. Reconstructs AAD from token: `share:<token>:v1`
6. Decrypts locally in browser using key + IV + AAD
7. If decryption fails → show "This link appears incomplete"
8. Sanitizes decrypted HTML via DOMPurify
9. Renders as read-only "letter" view
10. **No account needed. No passphrase. No app install.**

### Error States

| Scenario | Message |
|----------|---------|
| Valid link | Note rendered beautifully |
| Expired | "This letter has faded" |
| Revoked | "This letter has faded" |
| Truncated/missing key | "This link appears incomplete" |
| Wrong/corrupted key | "This link appears incomplete" |
| Token not found | "This letter has faded" (uniform — no enumeration) |

> **Uniform errors:** Not-found, expired, and revoked all return the same response shape and message. This prevents token enumeration attacks.

---

## User Experience

### Sharer

1. Open a note → tap **Share**
2. Modal shows a generated link with one-tap copy
3. Optionally toggle title slug on/off (on by default)
4. Set expiry: 24 hours, 7 days, or 30 days (default: 7 days)
5. Send the link via any channel (text, email, chat)
6. Manage/revoke shares from the note or settings

### Recipient

1. Receive link → click it
2. See the note — clean, read-only letter view
3. Done. No signup, no friction.

---

## Security Hardening

### Monitoring & Analytics

- **Sentry:** Strip URL fragments from breadcrumbs/events (extend existing scrubbing in `main.tsx`)
- **Session replay:** Disable on shared note route
- **Analytics:** Never log/capture URL fragments
- **Old path:** Do not re-enable the old plaintext `fetchSharedNote` path

### Caching

- **Client:** `fetch(..., { cache: 'no-store' })` on shared payload requests
- **Server:** Response headers: `Cache-Control: no-store, private`
- **CDN/Edge:** Vercel config: no edge caching on `/s/*` routes; `Surrogate-Control: no-store`

### Headers & CSP

- **Referrer-Policy:** `no-referrer` on shared note pages (prevents token leaking via referrer to external resources)
- **CSP:** Strict policy on `/s/*` — no third-party scripts, no tracking pixels, no external resources
- **Sanitization:** DOMPurify sanitization in shared render path (same as editor)

---

## Database & RLS

### Revocation Model

**Soft-delete with `revoked_at` timestamp.** No row deletion.

- Provides audit trail (when was it revoked)
- Single canonical check in fetch query:
  ```sql
  WHERE token = $1
    AND revoked_at IS NULL
    AND expires_at > now()
  ```

### RPC Function Specification

Public access via **Supabase RPC function** (`fetch_shared_note`), not broad table SELECT.

| Requirement | Detail |
|-------------|--------|
| Returned columns | `encrypted_payload`, `iv`, `encryption_version` only |
| Error behavior | Uniform null response for not-found, expired, and revoked (no enumeration) |
| SQL | Static/parameterized only — no dynamic SQL |
| Function mode | `SECURITY DEFINER` with explicit `search_path = 'public'` |
| Rate limiting | Enforced at edge (Vercel) — e.g., 30 requests/minute per IP on `/s/*` |

### Owner Permissions

- Owner can create, read, update, and revoke their own shares (standard RLS)
- No public access to `notes`, `tags`, or `note_tags` tables

---

## Decisions Log

| # | Finding | Decision |
|---|---------|----------|
| 1 | Token entropy too low | 22-char base64url (132-bit) + rate limiting |
| 2 | Title slug leaks metadata | Optional slug, client-generated, server-ignored, documented tradeoff |
| 3 | Crypto envelope incomplete | Full spec: 12-byte IV, AAD `share:<token>:v1`, versioned payload |
| 4 | Caching guidance incomplete | Client + server + CDN layers all specified |
| 5 | RPC security underspecified | Minimal columns, uniform errors, SECURITY DEFINER, rate limits |
| 6 | Revocation semantics ambiguous | Soft-delete with `revoked_at` only — no row deletion |
| 7 | Missing referrer/CSP controls | `Referrer-Policy: no-referrer` + strict CSP on shared routes |
| Q1 | Max TTL policy? | Yes — 30 days max in v1 |
| Q2 | Immutable snapshots only? | Yes — v1 is snapshot only, no auto-update |

---

## Future Enhancements (Not v1)

- **Passphrase protection** — optional second layer on top of the link key
- **View-once** — self-destructing share links
- **Live sharing** — auto-update when note changes (requires re-encryption on each edit)
- **"Never expires" option** — if user demand warrants it, with explicit warnings

---

## References

- Codex review: 7 findings (all incorporated — see Decisions Log)
- Pattern precedents: Firefox Send, PrivateBin, Bitwarden Send, Standard Notes
- URL structure precedent: Stack Overflow (ID + cosmetic slug)
