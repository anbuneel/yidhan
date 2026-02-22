# Plan Review: E2EE Implementation Plan (v1.0 → v1.4)

**Review ID:** 8beb39e6
**Date:** 2026-02-21
**Model:** gpt-5.3-codex
**Status:** Approved after 5 round(s)
**Plan file:** `docs/plans/e2ee-implementation-plan.md`

## Summary

| Metric | Count |
|--------|-------|
| Rounds | 5 |
| Total findings | 26 |
| Agreed & applied | 21 |
| Partially applied | 3 |
| Deferred | 1 |
| Rejected | 1 |

---

## Round 1

### Codex Review

12 findings raised against v1.0 of the implementation plan. VERDICT: REVISE.

1. **Critical: stale-tab plaintext protection explicitly removed** — Analysis doc mandates it as mandatory but plan says not needed.
2. **Critical: no sync-queue drain/freeze before enabling E2EE** — Pending plaintext queue entries could push plaintext to Supabase.
3. **Critical: conflict resolution path not updated** — `useSyncEngine.ts:resolveConflict()` and `ConflictModal` still operate on plaintext.
4. **High: hydration path missing from scope** — `hydrateFromServer()`/`dbNoteToLocal()` not mentioned; first-load would be blank.
5. **High: migration not resumable/idempotent** — No persisted checkpoint or restart semantics.
6. **High: migration doesn't freeze editing/sync** — Active sync could cause conflicts during migration.
7. **High: sharing disabled only in UI, not server-side** — Share APIs/routes/policies still exist.
8. **Medium: plaintext write paths outside App.tsx not accounted for** — `demoMigration.ts` and `resolveConflict` still write plaintext.
9. **Medium: key lifecycle integration underspecified** — signOut and timeout don't explicitly clear keys.
10. **Medium: telemetry scrubbing not addressed** — Sentry could leak decrypted content.
11. **Medium: verification plan too thin** — Only crypto unit tests + manual checklist.
12. **Alternative: two-stage additive rollout** — Safer approach with `encryption_enabled` flag.

### Claude Counter-Review

| # | Codex Finding | Disposition | Rationale |
|---|--------------|-------------|-----------|
| 1 | Stale-tab plaintext protection removed | reject | Single user, single device, no stale tabs. Add RLS guard when users arrive. |
| 2 | No sync-queue drain before E2EE | agree | Real data leakage risk. Must drain or block before passphrase setup. |
| 3 | Conflict resolution path not updated | agree | Excellent catch. Must work with encrypted payloads + decrypted previews. |
| 4 | Hydration path missing | agree | Critical read path must map encrypted columns. |
| 5 | Migration not resumable/idempotent | partial | Skip-already-encrypted logic + pre-migration backup sufficient for ~50 notes. |
| 6 | Migration doesn't freeze editing/sync | agree | Must pause sync engine and disable editor during migration. |
| 7 | Sharing disabled only in UI | agree | Must revoke public RLS policies too. |
| 8 | Plaintext write paths outside App.tsx | agree | demoMigration.ts must go through createEncryptedNote(). |
| 9 | Key lifecycle underspecified | agree | Need explicit lockVault() wiring. |
| 10 | Telemetry scrubbing | agree | Sentry beforeSend must strip note content. |
| 11 | Verification plan too thin | partial | Added integration tests for key paths. Full E2E automation overkill for single user. |
| 12 | Two-stage additive rollout | reject | Unnecessary complexity for 1 user. Pre-migration backup provides rollback. |

### User Decisions

- Finding 1: User sided with Claude — defer. "defer and add the why, claude's"
- Finding 12: User sided with Claude — reject. "defer and add the why, claude's"

### Revisions Applied

- Added sync queue drain pre-condition in PassphraseSetup
- Added useSyncEngine.ts and ConflictModal to Phase 4 (conflict resolution with encrypted payloads)
- Added hydrateFromServer() and dbNoteToLocal() to Phase 4.2
- Added pre-migration JSON export backup and skip-already-encrypted logic
- Added migration mode flag that pauses sync engine and disables editor
- Expanded Phase 0.2 SQL to revoke public SELECT RLS policies
- Added demoMigration.ts to modified files list
- Added explicit lockVault() wiring in AuthContext signOut
- Added Sentry beforeSend scrubbing
- Added integration tests for sync queue drain, conflict resolution, migration idempotency

---

## Round 2

### Codex Review

7 findings raised against v1.1. VERDICT: REVISE.

1. **Critical: stale-tab protection still missing — stale tab possible during deploy** even with one user.
2. **High: sharing SQL incomplete** — Missing note_tags public policy drop and note_shares insert block.
3. **High: conflict resolution key plumbing under-specified** — How do keys reach useSyncEngine/resolveConflict?
4. **High: note-creation side effects before unlock** — App.tsx lines 607/683 can create notes before passphrase gate renders.
5. **Medium: AuthContext/EncryptionProvider ordering ambiguity** — Provider order creates dependency confusion.
6. **Medium: migration skip condition missing content='' check**.
7. **Medium: migration backup failure behavior and cross-tab protection unspecified**.

### Claude Counter-Review

| # | Codex Finding | Disposition | Rationale |
|---|--------------|-------------|-----------|
| 1 | Stale-tab protection (revised argument) | agree | Valid refinement: stale tab during deploy is possible. Simple CHECK constraint is low-effort. |
| 2 | Sharing SQL incomplete | agree | Should drop ALL sharing policies with catch-all. |
| 3 | Conflict resolution key plumbing | agree | Specify: useSyncEngine accepts keys param from App.tsx. |
| 4 | Note-creation before unlock | agree | All write paths must check isUnlocked. |
| 5 | Provider ordering ambiguity | agree | Simplify: EncryptionContext watches user, auto-locks. AuthContext doesn't call lockVault. |
| 6 | Migration skip missing content check | agree | Simple fix: add AND content = ''. |
| 7 | Migration backup/freeze details | partial | Abort on backup failure + close tabs instruction. Skip cross-tab lock. |

### Revisions Applied

- Added Phase 0.4 with CHECK constraint for post-migration plaintext rejection
- Expanded Phase 0.2 SQL with catch-all policy drop loop for note_shares
- Specified exact key plumbing: useSyncEngine accepts keys parameter
- Added isUnlocked guard rule for all note write paths
- Simplified provider design: EncryptionContext watches user, auto-locks
- Fixed migration skip condition to check both title and content
- Added backup abort on failure + close tabs instruction

---

## Round 3

### Codex Review

4 findings raised against v1.2. VERDICT: REVISE.

1. **Critical: CHECK constraint bypassable** — `encryption_version IS NULL` escape hatch lets stale tabs omit the column.
2. **High: sharing policy `"Anyone can read share tokens"` not dropped** — Leaves public read path open.
3. **High: backup download is fire-and-forget** — `downloadFile()` has no success signal, can't verify.
4. **Medium: sync pause only gates processQueue, not fullSync/pull**.

### Claude Counter-Review

| # | Codex Finding | Disposition | Rationale |
|---|--------------|-------------|-----------|
| 1 | CHECK constraint bypass via IS NULL | agree | Make encryption_version NOT NULL DEFAULT 1 post-migration. Unconditional CHECK. |
| 2 | Missing share tokens policy | partial | Policy name doesn't exist in migration files, but principle is right. Catch-all already handles it. |
| 3 | Backup fire-and-forget | agree | Require manual "I have saved my backup" confirmation instead. |
| 4 | Sync pause scope too narrow | agree | Gate fullSync/pull and wait for in-flight sync to finish. |

### Revisions Applied

- Made encryption_version NOT NULL DEFAULT 1, CHECK constraint now unconditional
- Catch-all policy drop loop already covers any unnamed policies
- Replaced auto-backup with manual export + "I have saved my backup" confirmation checkbox
- Expanded pauseSync to gate all sync entry points and wait for in-flight completion

---

## Round 4

### Codex Review

3 findings raised against v1.3. VERDICT: REVISE.

1. **Correctness: encrypted-row integrity not enforced** — Rows with empty title/content but NULL ciphertext are undecryptable.
2. **Race risk: pauseSync only pauses processQueue in description** — Pull and fullSync still need gating (description was inconsistent).
3. **Checklist wording inconsistency** — Still says "auto-backup" but flow is now manual confirmation.

### Claude Counter-Review

| # | Codex Finding | Disposition | Rationale |
|---|--------------|-------------|-----------|
| 1 | Missing ciphertext NOT NULL constraints | agree | Add NOT NULL on encrypted_payload, encryption_iv, content_hash post-migration. |
| 2 | Sync pause description scope | agree | Updated description to explicitly list all three entry points. |
| 3 | Checklist wording | agree | Fixed to match manual confirmation flow. |

### Revisions Applied

- Added NOT NULL constraints on encrypted_payload, encryption_iv, content_hash in post-migration SQL
- Updated sync pause description to explicitly gate fullSync, pullRemoteChanges, processQueue
- Fixed checklist wording to match manual backup confirmation flow

---

## Round 5

### Codex Review

0 blocking findings. VERDICT: APPROVED.

Codex confirmation:
> 1. No blocking findings. The Round 4 revisions address the remaining correctness and safety issues: ciphertext columns are now enforced post-migration, sync pause now gates all sync entry points and waits for in-flight completion, and the backup checklist wording now matches the manual confirmation flow.
> 2. Non-blocking testing gap: add one explicit race test where `pauseSync()` is called while a sync is actively running, and assert migration only begins after that sync settles and that `fullSync()`, `pullRemoteChanges()`, and `processQueue()` all no-op while paused.

---

## Deferred Items

| # | Finding | Rationale |
|---|---------|-----------|
| R1-1 | Stale-tab RLS plaintext rejection (original scope) | Initially deferred by user — single user, single device. Subsequently addressed with a simpler CHECK constraint approach in Round 2. |

## Rejected Items (user-confirmed)

| # | Finding | Rationale |
|---|---------|-----------|
| R1-12 | Two-stage additive rollout with encryption_enabled flag | Unnecessary complexity for 1 user with ~50 notes. Pre-migration backup provides the rollback path. User confirmed. |

---

## Related Documents

| Document | Description |
|----------|-------------|
| [E2EE Implementation Plan v1.4](../plans/e2ee-implementation-plan.md) | The plan reviewed in this document |
| [Encryption Capability Analysis v3.2](../analysis/encryption-capability-analysis-claude.md) | The analysis that informed the plan |
