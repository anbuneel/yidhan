# E2EE Implementation Plan for Yidhan

**Version:** 1.4
**Last Updated:** 2026-02-21
**Status:** Approved (5-round Codex peer review)
**Author:** Claude (Opus 4.6)

---

> **Original Prompt:** "Can we implement this capability now?" — referring to the E2EE encryption capability analyzed in `docs/analysis/encryption-capability-analysis-claude.md` (v3.2, approved after 3-round Codex peer review).

---

## Context

The encryption capability analysis (`docs/analysis/encryption-capability-analysis-claude.md` v3.2) was approved after a 3-round Codex peer review. This plan implements that design.

**Critical simplification:** The app has no users other than the developer. This eliminates the need for migration UI, gradual rollout, and production-grade error recovery. We can do a clean cut-over with a simple migration script. A pre-migration JSON export provides the rollback path.

**Goal:** Zero-knowledge E2EE where note titles and content are encrypted client-side before reaching Supabase. Tags remain plaintext. The server never sees readable note content.

---

## Key Decisions (from analysis doc v3.2)

| Decision | Choice |
|----------|--------|
| Passphrase model | One passphrase for all users (email + OAuth) |
| Key derivation | Argon2id via `hash-wasm` WASM (~50KB lazy-loaded) |
| Encryption | AES-256-GCM with AAD (`note_id:user_id`) |
| Conflict detection | HMAC-SHA-256 with derived hash key |
| What's encrypted | Title + content as JSON blob |
| What's NOT encrypted | Tags (plaintext), metadata (timestamps, pinned) |
| Sharing | Disabled for v1 |
| Recovery codes | None for v1 (passphrase lost = data lost) |
| Key storage | Memory only (React state), cleared on signout/timeout/refresh |

---

## Phase 0: Pre-Work

**Disable features incompatible with E2EE before any crypto code ships.**

### 0.1 Disable "Share as Letter" — UI + server-side

- **`src/components/Editor.tsx`** — Hide the share button (set `const sharingEnabled = false` guard)
- **`src/services/notes.ts`** — Remove or guard share creation functions
- **`e2e/sharing.spec.ts`** — Skip or remove sharing tests (feature disabled)

### 0.2 Expire existing share links + revoke ALL public access

- **New migration:** `supabase/migrations/expire_shares_for_e2ee.sql`
  ```sql
  -- Delete all active share links
  DELETE FROM note_shares;

  -- Revoke public SELECT policy on notes (shared note viewing)
  DROP POLICY IF EXISTS "Public can view notes with valid share token" ON notes;

  -- Revoke public tag viewing for shared notes
  DROP POLICY IF EXISTS "Public can view tags for shared notes" ON tags;

  -- Revoke public note_tags viewing for shared notes
  DROP POLICY IF EXISTS "Public can view note_tags for shared notes" ON note_tags;

  -- Block ALL share operations: revoke the management policy
  DROP POLICY IF EXISTS "Users can manage their own shares" ON note_shares;

  -- Drop any other policies on note_shares (catch-all safety)
  DO $$
  DECLARE pol RECORD;
  BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'note_shares' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON note_shares', pol.policyname);
    END LOOP;
  END $$;

  -- Replace with read-only policy so existing code doesn't error on queries
  CREATE POLICY "Users can read their own shares (disabled)"
    ON note_shares FOR SELECT
    USING (auth.uid() = user_id);
  ```

### 0.3 Disable welcome note trigger

- **New migration:** `supabase/migrations/disable_welcome_note_trigger.sql`
  ```sql
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  DROP FUNCTION IF EXISTS public.create_welcome_note();
  ```

### 0.4 Add plaintext-write rejection (post-migration)

- **New migration:** `supabase/migrations/add_plaintext_write_guard.sql`
  ```sql
  -- After migration: make encryption_version non-null with default
  -- This closes the loophole where a stale tab could omit encryption_version
  ALTER TABLE notes ALTER COLUMN encryption_version SET NOT NULL;
  ALTER TABLE notes ALTER COLUMN encryption_version SET DEFAULT 1;

  -- Reject writes with non-empty title/content unconditionally
  -- Since encryption_version is now always set, no escape hatch exists
  ALTER TABLE notes ADD CONSTRAINT chk_no_plaintext_after_encryption
    CHECK (title = '' AND content = '');

  -- Require ciphertext fields to be present on all rows
  -- Prevents stale/buggy clients from writing empty rows without ciphertext
  ALTER TABLE notes ALTER COLUMN encrypted_payload SET NOT NULL;
  ALTER TABLE notes ALTER COLUMN encryption_iv SET NOT NULL;
  ALTER TABLE notes ALTER COLUMN content_hash SET NOT NULL;
  ```
  **Note:** Run this migration AFTER Phase 6 migration completes and all notes have `encryption_version = 1` with valid ciphertext. This unconditionally blocks both plaintext writes AND empty ciphertext rows — stale tabs are caught by `NOT NULL DEFAULT 1` on `encryption_version`, and buggy clients are caught by `NOT NULL` on ciphertext fields.

---

## Phase 1: Core Encryption Library

**Pure functions, no UI. Fully testable in isolation.**

### 1.1 Create `src/lib/encryption.ts`

Core crypto utilities:

```typescript
// Key types
interface DerivedKeys {
  encryptionKey: CryptoKey;  // AES-256-GCM
  hashKey: CryptoKey;         // HMAC-SHA-256
  salt: Uint8Array;           // 16-byte random salt
}

interface EncryptedNote {
  ciphertext: string;   // base64
  iv: string;           // base64 (12-byte nonce)
  contentHash: string;  // base64 HMAC-SHA-256
  version: number;      // encryption schema version (1)
}

// Functions
deriveKeys(passphrase, salt?) → DerivedKeys
encryptNote(noteId, userId, title, content, keys) → EncryptedNote
decryptNote(noteId, userId, encrypted, encryptionKey) → { title, content }
computeContentHash(title, content, hashKey) → string
createKeyCheck(encryptionKey) → { keyCheck, keyCheckIv }
verifyKeyCheck(encryptionKey, keyCheck, keyCheckIv) → boolean
```

**Argon2id params:** parallelism=1, iterations=3, memorySize=65536 (64MB), hashLength=64
- 64-byte output split: first 32 bytes → encryption key, last 32 bytes → HMAC key

**Dependency:** `hash-wasm` (npm install)

### 1.2 Create `src/lib/__tests__/encryption.test.ts`

12 test cases covering:
- Roundtrip encrypt/decrypt preserves title + content
- Wrong key throws (GCM tag failure)
- Tampered ciphertext throws
- Wrong AAD (different noteId) throws
- HMAC consistency (same content → same hash)
- HMAC uniqueness (different content → different hash)
- Key-check roundtrip verification
- Different IVs per encryption (no nonce reuse)

---

## Phase 2: Key Management + Passphrase UI

**React context for key lifecycle + setup/unlock screens.**

### 2.1 Create `src/contexts/EncryptionContext.tsx`

- Holds `DerivedKeys | null` in React state (memory only, never persisted)
- `isUnlocked: boolean` — keys are in memory
- `isEncryptionSetup: boolean` — reads `user_metadata.encryption_salt` to determine
- `setupPassphrase(passphrase)` — derive keys, store salt + key-check blob in Supabase `user_metadata`
  - **Pre-condition:** sync queue must be empty before setup proceeds (wait for drain or show "syncing pending changes...")
- `unlockWithPassphrase(passphrase)` — derive keys from stored salt, verify key-check
- `lockVault()` — clears keys from React state
- **Auto-lock:** watches `user` from `useAuth()` — when user becomes `null`, calls `lockVault()` automatically. This is the sole lock mechanism; AuthContext does NOT call `lockVault()` directly (clean provider separation).

**user_metadata after setup:**
```json
{
  "encryption_salt": "base64...",
  "encryption_key_check": "base64...",
  "encryption_key_check_iv": "base64...",
  "encryption_version": 1
}
```

### 2.2 Create `src/components/PassphraseSetup.tsx`

- Two inputs: passphrase + confirm (min 8 chars)
- Acknowledgment checkbox: "I understand this cannot be recovered"
- Info note: "Tag names are not encrypted"
- **Sync queue check:** if pending sync operations exist, show "Syncing pending changes..." and disable submit until queue is empty
- Calls `setupPassphrase()` on submit
- Wabi-sabi styling (asymmetric corners, warm tones)

### 2.3 Create `src/components/PassphraseUnlock.tsx`

- Single passphrase input + "Unlock" button
- Error state for wrong passphrase
- Calls `unlockWithPassphrase()` on submit

### 2.4 Modify `src/App.tsx` — View routing + write gating

Insert passphrase gate after auth check, before library access:

```
...existing auth checks...
→ user && !isEncryptionSetup → <PassphraseSetup />
→ user && isEncryptionSetup && !isUnlocked → <PassphraseUnlock />
→ library/editor (existing)
```

**Write gating rule:** All note creation/update paths in App.tsx must check `isUnlocked` before proceeding. This includes:
- `handleNewNote()` (line ~812)
- `handleNoteUpdate()` (line ~865)
- Demo-to-account migration (line ~607)
- Share target note creation (line ~683)
- Import flows (lines ~1327, ~1395, ~1472)

The passphrase gate in routing already blocks the UI, but these guards prevent edge cases where code runs before the gate renders.

### 2.5 Modify `src/main.tsx` — Wrap with provider

```tsx
<AuthProvider>
  <EncryptionProvider>
    <App />
  </EncryptionProvider>
</AuthProvider>
```

**Provider ordering:** `AuthProvider` is outermost so `EncryptionContext` can call `useAuth()` to watch user state. EncryptionContext handles its own cleanup — AuthContext does not need to know about encryption.

### Key lifecycle

| Event | Action |
|-------|--------|
| First login | Show PassphraseSetup (after sync queue drains) → derive keys → store salt in user_metadata |
| Return visit / refresh | Show PassphraseUnlock → derive keys from stored salt |
| signOut / session timeout | signOut() → user becomes null → EncryptionContext auto-clears keys |
| Offboarding | Export while keys in memory → then signOut clears keys |

---

## Phase 3: Database Schema

### 3.1 New migration: `supabase/migrations/add_encryption_columns.sql`

```sql
ALTER TABLE notes ADD COLUMN encrypted_payload text;
ALTER TABLE notes ADD COLUMN encryption_iv text;
ALTER TABLE notes ADD COLUMN encryption_version integer;
ALTER TABLE notes ADD COLUMN content_hash text;
CREATE INDEX idx_notes_content_hash ON notes (content_hash);
```

### 3.2 Modify `src/types/database.ts`

Add to `DbNote` Row/Insert/Update types:
- `encrypted_payload: string | null`
- `encryption_iv: string | null`
- `encryption_version: number | null`
- `content_hash: string | null`

### 3.3 Modify `src/types.ts`

Add optional encryption fields to `Note` interface.

### 3.4 Modify `src/lib/offlineDb.ts` — Dexie v4

Add encryption fields to `LocalNote` interface:
- `encryptedPayload: string | null`
- `encryptionIv: string | null`
- `encryptionVersion: number | null`
- `contentHash: string | null`

Add Dexie v4 migration (same indexes, additive fields set to null for existing notes).

---

## Phase 4: Encryption Layer Integration

**This is the core work — all note reads decrypt, all writes encrypt.**

### 4.1 Create `src/services/encryptedNotes.ts`

Wrapper layer between App and offlineNotes:

```
createEncryptedNote(userId, title, content, keys) → Note
updateEncryptedNote(userId, note, keys) → Note
fetchDecryptedNotes(userId, keys, filterTagIds?) → Note[]
searchDecryptedNotes(userId, query, keys) → Note[]
fetchDecryptedFadedNotes(userId, keys) → Note[]
decryptNoteFromServer(note, userId, keys) → Note
createEncryptedNotesBatch(userId, notes, keys, onProgress?) → Note[]
```

### 4.2 Modify `src/services/offlineNotes.ts`

- `createNoteOffline()` — accept + store encrypted fields, set title/content to empty strings, queue encrypted payload
- `updateNoteOffline()` — same: store encrypted, queue encrypted payload
- `queueSyncOperation()` — payload contains `{ encrypted_payload, encryption_iv, content_hash, encryption_version }` instead of `{ title, content }`
- `upsertNoteFromServer()` — store encrypted fields from server response
- `hydrateFromServer()` — map encrypted columns from Supabase response into `LocalNote` encrypted fields (critical: without this, first-load after login produces blank notes)
- `dbNoteToLocal()` — include encrypted fields when converting DB rows to `LocalNote`
- `searchNotesOffline()` — no longer usable directly (search goes through `encryptedNotes.ts` which decrypts all notes then filters)

### 4.3 Modify `src/services/syncEngine.ts` + `src/hooks/useSyncEngine.ts`

**Sync pause API:** Add `pauseSync()` / `resumeSync()` functions.
- `syncEngine.ts`: add a module-level `syncPaused` flag. When `true`, ALL sync entry points return immediately: `processQueue()`, `pullRemoteChanges()`, and `fullSync()`. `pauseSync()` sets the flag and waits for any in-flight sync to finish before returning (so migration starts with a quiet sync engine).
- `useSyncEngine.ts`: expose `pauseSync()` / `resumeSync()` from the hook. When paused, auto-sync timers and reconnect triggers skip processing. Migration page calls `pauseSync()` before migration and `resumeSync()` after.

**Conflict detection** (lines 237-239):
```typescript
// BEFORE:
serverNote.title === localNote.title && serverNote.content === localNote.content
// AFTER:
serverNote.content_hash === localNote.contentHash
```

**Update push** (lines 263-272):
```typescript
// BEFORE: .update({ title, content })
// AFTER:  .update({ encrypted_payload, encryption_iv, content_hash, encryption_version })
```

**Create push**: same change — send encrypted fields, title/content as empty strings.

**pullRemoteChanges()**: store encrypted fields in IndexedDB (not plaintext).

### 4.4 Modify `src/hooks/useSyncEngine.ts` — Conflict resolution

- **Key plumbing:** `useSyncEngine` hook accepts `keys: DerivedKeys | null` as a parameter. App.tsx passes `keys` from `useEncryption()` into `useSyncEngine(userId, { keys })`.
- `resolveConflict()` decrypts both local and server versions using the `keys` parameter for preview in `ConflictModal`
- When user chooses a version, the chosen version is re-encrypted using the `keys` before writing
- `ConflictModal` receives decrypted previews (in-memory only) for display

### 4.5 Modify `src/services/notes.ts`

- `toNote()` converter — pass through encrypted fields from DB response
- `subscribeToNotes()` — realtime payloads include encrypted fields, decryption happens in App.tsx handler
- `searchNotes()` (server-side) — effectively dead code post-E2EE, can be removed or left with a comment

### 4.6 Modify `src/App.tsx` — Use encrypted service layer

Replace all `offlineNotes` calls with `encryptedNotes` equivalents, passing `keys` from `useEncryption()`:
- `fetchNotesOffline()` → `fetchDecryptedNotes()`
- `createNoteOffline()` → `createEncryptedNote()`
- `updateNoteOffline()` → `updateEncryptedNote()`
- `searchNotesOffline()` → `searchDecryptedNotes()`
- `fetchFadedNotesOffline()` → `fetchDecryptedFadedNotes()`
- `createNotesBatchOffline()` → `createEncryptedNotesBatch()`

Realtime handlers decrypt incoming notes before updating React state.

### 4.7 Modify `src/services/demoMigration.ts` — Demo-to-account migration

- Currently calls `createNoteOffline()` directly (line 87)
- Must route through `createEncryptedNote()` after E2EE is enabled
- `demoMigration.ts` accepts encryption `keys` as parameter
- Demo-to-account migration is gated behind `isUnlocked` (won't run until passphrase is entered)

### 4.8 Modify `src/main.tsx` — Sentry telemetry scrubbing

Add `beforeSend` hook to strip decrypted note content from error payloads:
```typescript
Sentry.init({
  // ...existing config...
  beforeSend(event) {
    // Strip note title/content from error payloads to prevent leakage
    // Scrub breadcrumbs, extra data, and contexts
    return scrubNoteContent(event);
  },
});
```

---

## Phase 5: Export/Import

### No changes needed for export

Notes in React state are already decrypted (decrypted at load time). `exportNotesToJSON()` and `exportNoteToMarkdown()` read from decrypted Note objects. Exports are plaintext — the user is authenticated and unlocked.

### Import — minor change in App.tsx

Import flow calls `createNotesBatchOffline()` → swap to `createEncryptedNotesBatch()`. The import functions themselves (`src/utils/exportImport.ts`) parse plaintext and return it; encryption happens in the batch create.

---

## Phase 6: Migration Script

**One-time operation to encrypt existing plaintext notes.**

### 6.1 Create `src/utils/migrationE2EE.ts`

```typescript
migrateExistingNotes(userId, keys, onProgress?) → { migrated, skipped, failed, errors[] }
```

**Pre-migration safety:**
1. Show "Export backup first" button — user downloads JSON backup manually via existing `exportNotesToJSON()` / `downloadFile()`. Then check a confirmation checkbox: **"I have saved my backup"** before migration button enables. (The current `downloadFile()` is fire-and-forget with no success signal, so we require explicit user confirmation instead of trying to detect download completion.)
2. Pause sync engine via `pauseSync()` (see Phase 4.3) and disable editor writes (migration mode flag)
3. Document to user: "Close other browser tabs before migrating"

**Per-note processing** (idempotent — safe to re-run):
1. Read note from Supabase
2. **Skip if already encrypted** (`encrypted_payload IS NOT NULL AND title = '' AND content = ''`) — makes re-runs safe
3. Encrypt title + content → encrypted_payload, iv, content_hash
4. Write encrypted fields to Supabase
5. Read back, decrypt, verify matches original
6. If verified: clear title/content to empty strings
7. If verification fails: log error, skip (do not clear plaintext)
8. Report progress

Process 10 notes at a time.

**Post-migration:**
1. Resume sync engine and re-enable editor
2. Run Phase 0.4 migration (`chk_no_plaintext_after_encryption` constraint)

### 6.2 Create `src/pages/MigrationPage.tsx` (temporary)

Simple page at `/migrate`:
- Shows "Export Backup" button → then "I have saved my backup" checkbox → then "Migrate Notes" button enables
- Requires passphrase unlock
- Instruction: "Close other browser tabs before proceeding"
- Progress bar during migration
- Pauses sync engine and editor writes during migration
- Results summary (migrated / skipped / failed)
- Can be removed after migration succeeds

### 6.3 Post-migration cleanup (manual SQL)

```sql
-- Verify no plaintext remains
SELECT id FROM notes WHERE title != '' OR content != '';
-- Should return 0 rows

-- Then apply the plaintext-write guard constraint (Phase 0.4)
```

---

## Phase 7: Client-Side Welcome Note

### Modify `src/components/PassphraseSetup.tsx`

After passphrase setup completes, create welcome note via `createEncryptedNote()` with the same HTML content from the old trigger. This replaces the server-side trigger disabled in Phase 0.

---

## Files Summary

### New files (8)

| File | Purpose |
|------|---------|
| `src/lib/encryption.ts` | Core Argon2id + AES-GCM + HMAC crypto |
| `src/lib/__tests__/encryption.test.ts` | Crypto unit tests |
| `src/contexts/EncryptionContext.tsx` | Key management React context |
| `src/components/PassphraseSetup.tsx` | First-time passphrase setup screen |
| `src/components/PassphraseUnlock.tsx` | Returning user unlock screen |
| `src/services/encryptedNotes.ts` | Encrypt/decrypt wrapper over offlineNotes |
| `src/utils/migrationE2EE.ts` | One-time migration script |
| `src/pages/MigrationPage.tsx` | Temporary migration UI (remove after use) |

### Modified files (13)

| File | Changes |
|------|---------|
| `src/App.tsx` | Passphrase gate in routing, write gating, swap to encrypted note calls |
| `src/main.tsx` | Wrap with EncryptionProvider, Sentry `beforeSend` scrubbing |
| `src/types.ts` | Add optional encryption fields to Note |
| `src/types/database.ts` | Add encryption columns to DbNote |
| `src/lib/offlineDb.ts` | Dexie v4, encryption fields on LocalNote |
| `src/services/offlineNotes.ts` | Encrypted fields in CRUD, hydration, sync queue |
| `src/services/syncEngine.ts` | HMAC conflict detection, encrypted push/pull |
| `src/services/notes.ts` | toNote() converter, realtime encrypted fields |
| `src/hooks/useSyncEngine.ts` | Accept `keys` param, conflict resolution with decrypted previews |
| `src/services/demoMigration.ts` | Accept `keys` param, route through createEncryptedNote |
| `src/components/Editor.tsx` | Hide share button |
| `e2e/sharing.spec.ts` | Skip/remove sharing tests |
| `package.json` | Add `hash-wasm` dependency |

### Database migrations (4)

| File | Purpose |
|------|---------|
| `supabase/migrations/expire_shares_for_e2ee.sql` | Delete shares, revoke ALL public/sharing RLS policies |
| `supabase/migrations/disable_welcome_note_trigger.sql` | Remove welcome note trigger |
| `supabase/migrations/add_encryption_columns.sql` | Add encrypted_payload, iv, version, content_hash |
| `supabase/migrations/add_plaintext_write_guard.sql` | CHECK constraint: reject plaintext writes after encryption (run post-migration) |

---

## Verification Plan

### Automated tests

**Unit tests** (`src/lib/__tests__/encryption.test.ts`):
- 12 crypto roundtrip tests (encrypt/decrypt, tamper detection, HMAC, key-check)

**Integration tests** (new test file or added to existing):
- Sync queue drain blocks passphrase setup when queue has pending entries
- Conflict resolution with encrypted payloads — decrypt for preview, re-encrypt on resolution
- Migration idempotency — running migration twice skips already-encrypted notes
- Migration with verification failure — plaintext preserved on failed notes
- Passphrase lock/unlock lifecycle — keys present after unlock, absent after lock
- Plaintext-write guard constraint — rejects inserts/updates with non-empty title/content unconditionally (encryption_version NOT NULL DEFAULT 1)
- Sync pause/resume — auto-sync skips when paused, resumes normally after
- Sync pause race test — call `pauseSync()` while sync is actively running, assert migration only begins after sync settles, and all sync entry points no-op while paused

**E2E tests:**
- `e2e/sharing.spec.ts` — update to verify sharing is disabled (or remove)

### Full CI check
- Run `npm run check` — typecheck + lint + test + build all pass

### Manual testing checklist
- [ ] Fresh signup → passphrase setup → create note → Supabase has only ciphertext (no readable title/content)
- [ ] Page refresh → unlock prompt → correct passphrase → notes visible
- [ ] Wrong passphrase → error shown, retry works
- [ ] Create, edit, delete, pin notes — all work with encryption
- [ ] Search finds notes by title and content keywords
- [ ] Export JSON → re-import → all notes present and correct
- [ ] Migration script: user exports backup, confirms "I have saved my backup", then migration encrypts all notes, skips already-encrypted
- [ ] Migration requires explicit "I have saved my backup" confirmation before proceeding
- [ ] After migration, Supabase has no readable title/content
- [ ] Post-migration CHECK constraint blocks any plaintext write attempts
- [ ] Session timeout clears keys → passphrase required again
- [ ] Logout clears keys (EncryptionContext auto-lock on user null)
- [ ] Demo mode (`/demo`) unaffected (no encryption)
- [ ] Demo-to-account migration creates encrypted notes (requires unlock first)
- [ ] Offline create/edit → come online → sync pushes encrypted data
- [ ] Conflict detection works (HMAC comparison: same content = no conflict, different = conflict modal)
- [ ] Conflict modal shows decrypted previews of both versions

### Browser DevTools verification
- IndexedDB notes table: title/content should be empty strings, encryptedPayload populated
- Supabase dashboard: notes table shows only ciphertext in encrypted_payload column
- Network tab: no plaintext title/content in request/response payloads
- Sentry: verify error payloads don't contain note content (trigger a test error)

---

## Deferred Items

| Item | Rationale |
|------|-----------|
| Key hierarchy / passphrase change | Not needed for single-user v1. |
| Recovery codes | Not needed for single-user v1. |
| Tag encryption | Deferred — titles+content are the sensitive data. |
| Sharing with E2EE | Disabled for v1. |
| Two-stage additive rollout | Unnecessary complexity for 1 user. Pre-migration backup provides rollback. |
