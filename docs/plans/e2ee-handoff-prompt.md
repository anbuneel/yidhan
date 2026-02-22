# E2EE Implementation — Claude Code Web Handoff Prompt

Copy everything below the line into Claude Code web.

---

## Task

Implement end-to-end encryption (E2EE) for Yidhan. The full implementation plan is at `docs/plans/e2ee-implementation-plan.md` (v1.4, approved after 5-round Codex peer review). Read that file first — it has exact file paths, function signatures, type definitions, and code snippets for every phase.

## Branch

Create a feature branch called exactly `feature/e2ee`. Do not generate your own branch name.

```bash
git checkout -b feature/e2ee
```

## Implementation Order

Work through the phases in this exact order: **0 → 1 → 3 → 2 → 4 → 5 → 6 → 7**. This ordering respects dependencies while front-loading independent work.

After completing each phase, run `npm run check` (typecheck + lint + test + build). Fix any issues before moving to the next phase. Commit after each phase passes with the message format shown below.

## Phase-by-Phase Instructions

### Phase 0: Pre-Work

**Goal:** Disable features incompatible with E2EE before any crypto code ships.

1. **`src/components/Editor.tsx`** — Add a `const sharingEnabled = false` guard to hide the share button. Do NOT delete the share code — just gate it.
2. **New file: `supabase/migrations/expire_shares_for_e2ee.sql`** — `DELETE FROM note_shares;`
3. **New file: `supabase/migrations/disable_welcome_note_trigger.sql`** — Drop the `on_auth_user_created` trigger and `create_welcome_note()` function.

```bash
git add -A && git commit -m "feat(e2ee): phase 0 — disable sharing and welcome note trigger"
```

### Phase 1: Core Encryption Library

**Goal:** Pure crypto functions, no UI, no React. Fully testable in isolation.

1. **Install dependency:** `npm install hash-wasm`
2. **New file: `src/lib/encryption.ts`** — Implement all functions listed in the plan (Phase 1.1): `deriveKeys`, `encryptNote`, `decryptNote`, `computeContentHash`, `createKeyCheck`, `verifyKeyCheck`. Follow the exact type signatures (`DerivedKeys`, `EncryptedNote`).
   - Argon2id params: `parallelism=1, iterations=3, memorySize=65536, hashLength=64`
   - 64-byte output split: first 32 bytes → AES-256-GCM key, last 32 bytes → HMAC-SHA-256 key
   - AES-GCM AAD: `${noteId}:${userId}` encoded as UTF-8
   - IV: 12-byte random nonce per encryption (crypto.getRandomValues)
   - Encrypt JSON blob: `JSON.stringify({ title, content })`
   - All binary data stored as base64 strings
3. **New file: `src/lib/__tests__/encryption.test.ts`** — 12 test cases as listed in the plan (Phase 1.2). These tests must all pass.

```bash
git add -A && git commit -m "feat(e2ee): phase 1 — core encryption library with tests"
```

### Phase 3: Database Schema (done before Phase 2 — no dependency on crypto)

**Goal:** Add encryption columns to the database and update TypeScript types.

1. **New file: `supabase/migrations/add_encryption_columns.sql`** — Add `encrypted_payload text`, `encryption_iv text`, `encryption_version integer`, `content_hash text` to notes table. Add index on `content_hash`.
2. **Modify `src/types/database.ts`** — Add the four encryption columns to `DbNote` Row/Insert/Update types. All nullable.
3. **Modify `src/types.ts`** — Add optional encryption fields to the `Note` interface.
4. **Modify `src/lib/offlineDb.ts`** — Add encryption fields to `LocalNote` interface (`encryptedPayload`, `encryptionIv`, `encryptionVersion`, `contentHash` — all `string | null`). Add a Dexie version bump with the new fields defaulting to null. Keep existing indexes unchanged.

```bash
git add -A && git commit -m "feat(e2ee): phase 3 — database schema and type updates"
```

### Phase 2: Key Management + Passphrase UI

**Goal:** React context for key lifecycle + setup/unlock screens.

1. **New file: `src/contexts/EncryptionContext.tsx`** — Context providing `DerivedKeys | null`, `isUnlocked`, `isEncryptionSetup`, `setupPassphrase()`, `unlockWithPassphrase()`, `lockVault()`. The context reads `user_metadata.encryption_salt` to determine setup state. On `lockVault()`, clear keys from React state. The context watches the user object from `useAuth()` — when user becomes null (signout), auto-lock.
2. **New file: `src/components/PassphraseSetup.tsx`** — Two inputs (passphrase + confirm, min 8 chars), acknowledgment checkbox ("I understand this cannot be recovered"), info note about tags not being encrypted. Wabi-sabi styling matching existing app aesthetic.
3. **New file: `src/components/PassphraseUnlock.tsx`** — Single passphrase input + "Unlock" button. Error state for wrong passphrase.
4. **Modify `src/App.tsx`** — Insert passphrase gate after auth check: `user && !isEncryptionSetup → PassphraseSetup`, `user && isEncryptionSetup && !isUnlocked → PassphraseUnlock`, else existing library/editor. Use the `useEncryption()` hook.
5. **Modify `src/main.tsx`** — Wrap `<App />` with `<EncryptionProvider>` inside `<AuthProvider>`.

```bash
git add -A && git commit -m "feat(e2ee): phase 2 — key management context and passphrase UI"
```

### Phase 4: Encryption Layer Integration

**Goal:** All note reads decrypt, all writes encrypt. This is the largest phase.

1. **New file: `src/services/encryptedNotes.ts`** — Wrapper layer between App and offlineNotes. Functions: `createEncryptedNote`, `updateEncryptedNote`, `fetchDecryptedNotes`, `searchDecryptedNotes`, `fetchDecryptedFadedNotes`, `decryptNoteFromServer`, `createEncryptedNotesBatch`. Each function encrypts before calling offlineNotes (writes) or decrypts after reading (reads).
2. **Modify `src/services/offlineNotes.ts`** — `createNoteOffline()` and `updateNoteOffline()` accept + store encrypted fields, set title/content to empty strings in the DB, queue encrypted payload (not plaintext) for sync. `upsertNoteFromServer()` stores encrypted fields from server response. `searchNotesOffline()` can no longer work directly (encrypted content is not searchable).
3. **Modify `src/services/syncEngine.ts`** — Conflict detection: replace `serverNote.title === localNote.title && serverNote.content === localNote.content` with `serverNote.content_hash === localNote.contentHash`. Update push/create: send `{ encrypted_payload, encryption_iv, content_hash, encryption_version }` instead of `{ title, content }`. Pull: store encrypted fields in IndexedDB. **Important:** Implement `pauseSync()`/`resumeSync()` that gates `fullSync`, `pullRemoteChanges`, and `processQueue`, and waits for any in-flight sync to complete.
4. **Modify `src/services/notes.ts`** — `toNote()` converter passes through encrypted fields. Realtime payloads include encrypted fields.
5. **Modify `src/App.tsx`** — Replace all `offlineNotes` calls with `encryptedNotes` equivalents, passing `keys` from `useEncryption()`. All note write paths must check `isUnlocked` before proceeding. Realtime handlers decrypt incoming notes before updating React state.

All note write paths must be guarded with an `isUnlocked` check — if the vault is locked, writes must be blocked.

```bash
git add -A && git commit -m "feat(e2ee): phase 4 — encryption layer integration"
```

### Phase 5: Export/Import

**Goal:** Swap import to use encrypted note creation.

1. **Modify `src/App.tsx`** — Import flow: change `createNotesBatchOffline()` → `createEncryptedNotesBatch()`. Export needs no changes (notes in React state are already decrypted).

```bash
git add -A && git commit -m "feat(e2ee): phase 5 — encrypted import"
```

### Phase 6: Migration Script

**Goal:** One-time script to encrypt existing plaintext notes.

1. **New file: `src/utils/migrationE2EE.ts`** — `migrateExistingNotes(userId, keys, onProgress?)` function. For each note: read plaintext from Supabase, encrypt, write encrypted fields, read back + decrypt to verify, clear title/content to empty strings. Process 10 notes at a time. Skip already-encrypted notes (where `encrypted_payload` is not null AND `title === '' AND content === ''`).
2. **New file: `src/pages/MigrationPage.tsx`** — Simple page showing "Migrate Notes" button, progress bar, results summary. Requires passphrase unlock first. Includes manual backup confirmation checkbox ("I have saved my backup") before migration can start. Aborts if backup confirmation is not checked.
3. Add a route for `/migrate` in the app routing.

```bash
git add -A && git commit -m "feat(e2ee): phase 6 — migration script and page"
```

### Phase 7: Client-Side Welcome Note

**Goal:** Replace the disabled server-side welcome note trigger.

1. **Modify `src/components/PassphraseSetup.tsx`** — After passphrase setup completes successfully, create a welcome note via `createEncryptedNote()` with the same content the old trigger used (check `supabase/migrations/create_welcome_note_trigger.sql` for the original HTML content).

```bash
git add -A && git commit -m "feat(e2ee): phase 7 — client-side welcome note"
```

## After All Phases

1. Run `npm run check` one final time to confirm everything passes.
2. Push the branch: `git push -u origin feature/e2ee`
3. Do NOT create a PR — I will review the branch first.

## Key Reminders

- **Read `docs/plans/e2ee-implementation-plan.md` first.** It has the complete specification including post-migration constraints (NOT NULL, CHECK), sync pause semantics, and provider ordering.
- **Match existing code style.** Read the files you're modifying before changing them. Follow existing patterns for imports, error handling, and component structure.
- **Wabi-sabi design.** New UI components (PassphraseSetup, PassphraseUnlock, MigrationPage) should match the app's aesthetic: asymmetric corners (`2px 12px 4px 12px`), warm tones, Cormorant Garamond for headings, Inter for body.
- **Do not touch demo mode.** The `/demo` route and `demoStorage.ts`/`demoMigration.ts` should remain unaffected by E2EE. Demo mode doesn't use authentication or encryption.
- **Sentry scrubbing.** If a Sentry `beforeSend` hook exists, ensure it strips note title/content from error reports. If it doesn't exist, add one.
- **`hash-wasm` is the only new dependency.** Do not add any other packages.
- **No stale plaintext.** After encryption, title and content in the DB (both Supabase and IndexedDB) must be empty strings, never null. The encrypted payload fields hold the real data.
