# Reliability Hardening Plan

**Version:** 1.2
**Last Updated:** 2026-03-10
**Status:** Items 1-3 Implemented (PR #163) — Items 4-5 Deferred
**Author:** Codex (GPT-5)
**Date/Timestamp:** 2026-03-10

---

## Original Prompt

> Can you propose a plan to fix these or give operational recommendations
>
> Save this plan in the active docs section, update index - i need to review this first

---

## Context

This document captures the highest-value reliability and operational hardening work for Yidhan's current architecture. It is based on repo evidence from the offline-first data path: per-user Dexie storage, optimistic local writes, a client sync queue, periodic and reconnect sync against Supabase, realtime subscriptions, and browser-held E2EE keys.

This revision reflects follow-up review and narrows the scope to the most credible pre-launch work: prevent silent mutation loss, remove destructive hydration behavior, improve E2EE warning and telemetry, and defer larger convergence and scale projects unless user behavior justifies them.

---

## Confirmed Architecture

Confirmed from client code:

- IndexedDB/Dexie is the local working set for notes, tags, note-tag relationships, sync queue entries, and conflicts.
- Writes are optimistic: local state and IndexedDB update first, then the sync queue pushes to Supabase.
- Sync runs on reconnect, on initial load after hydration, on manual refresh, and on a 60-second safety-net interval.
- Realtime subscriptions cover `notes` and `tags`.
- E2EE encrypts note title/content client-side before persistence and sync.
- Share links use a server-stored ciphertext plus a URL-fragment key that never reaches the server.

Confirmed code paths were traced through:

- `src/lib/offlineDb.ts`
- `src/services/offlineNotes.ts`
- `src/services/offlineTags.ts`
- `src/services/syncEngine.ts`
- `src/contexts/AuthContext.tsx`
- `src/contexts/EncryptionContext.tsx`
- `src/services/encryptedNotes.ts`
- `src/services/notes.ts`
- `src/hooks/useSyncEngine.ts`

Inferred rather than confirmed:

- Exact Supabase SQL, RLS policies, triggers, and the body of the `fetch_shared_note` RPC were not inspected directly in this pass. Conclusions about those server behaviors are based on client contracts and comments.

---

## Final Priority Ranking

| # | Item | Priority | Effort | Rationale |
|---|------|----------|--------|-----------|
| 1 | Silent mutation loss | High | Small | Real data divergence risk with a narrow first fix |
| 2 | Destructive hydration | Medium-High | Medium | Confirmed destructive behavior on a fragile trigger path |
| 3 | E2EE warning copy and telemetry | Medium | Small | Cheap trust and support improvement |
| 4 | Note-tag convergence | Low-Medium | Large | Real gap, but convergence lag more than data loss |
| 5 | Search and sync scale work | Low | Large | Mostly future-proofing for larger vaults |

---

## Priority Plan

### 1. Stop Silent Mutation Loss

Confirmed current behavior:

- Stale non-create queue entries older than 1 hour with 3+ retries are removed during cleanup.
- Retry exhaustion also removes queue entries after 5 failed attempts.
- These paths log warnings but do not surface user-visible recovery state.
- `create` operations are intentionally exempt from stale cleanup, but updates, deletes, pins, and tag operations are not.

Recommended v1 changes:

- Add a `blocked` or `failed` state directly on existing queue entries instead of deleting them.
- Store the last error message and retry count on the queue record.
- Surface blocked mutation count in `SyncIndicator` and expose a retry action.
- Mark affected notes or tags as blocked in UI where practical.
- Exclude blocked entries from normal automatic sync cycles.
- Add a single `Retry blocked changes` action in `SyncIndicator` that resets blocked entries to pending, clears retry metadata, and triggers immediate sync.

Why this scope:

- This addresses the real failure mode without introducing a new dead-letter subsystem before launch.
- A separate failure table can remain a later optimization if the simpler state model proves insufficient.

### 2. Remove Destructive Hydration

Confirmed current behavior:

- `hydrateFromServer()` clears `notes`, `tags`, and `noteTags` before repopulating them.
- `needsHydration()` decides whether hydration is needed based on DB existence, `noteCount === 0`, and a timeout fallback that assumes hydration is needed.
- This is explicitly acknowledged in code comments as weaker than a real hydration marker.

Recommended changes:

- Add a small local metadata record containing:
  - hydration status
  - last hydrated timestamp
  - cache schema version
- Never clear local tables when the sync queue contains `pending` or `blocked` entries.
- When queued work exists, skip destructive hydration entirely and rely on the normal push path plus incremental pull to converge state.
- When no queued work exists, replace destructive startup hydration with merge/upsert behavior wherever possible.
- Keep `Reset local cache and resync` as an explicit recovery path rather than an automatic fallback.

Why this matters:

- This is confirmed behavior, not a theoretical concern.
- It is the second most important reliability fix because it can wipe local working state during startup recovery.

### 3. Improve E2EE Warning Copy And Telemetry

Confirmed current behavior:

- Passphrase and share-link loss are unrecoverable by design.
- `Remember this browser` is opt-in and already conservative, but users may still underestimate the implications.

Recommended changes:

- Strengthen passphrase-loss and share-link-loss copy in setup, unlock, and sharing surfaces.
- Add Sentry breadcrumbs or counters for:
  - key-check failures
  - restore failures
  - decryption failures
  - share-link decryption failures
- Keep `Remember this browser` behavior unchanged for now unless production evidence suggests abuse or confusion.

Why this scope:

- This improves trust and supportability without reopening a deliberate product tradeoff.

### 4. Improve Note-Tag Convergence Later

Confirmed current behavior:

- `note_tags` are hydrated initially, but steady-state sync and realtime do not treat membership as a first-class incremental entity.
- This can lead to stale tag chips or filters across devices until refresh, rehydrate, or later sync convergence.

Recommended changes:

- Defer full `note_tags` convergence work until after launch unless users report confusion.
- When prioritized, add proper incremental and realtime sync for note-tag membership.
- If required, evolve Supabase schema to support `updated_at`, `user_id`, and deletion semantics on membership rows.

Why it is deferred:

- This is a correctness gap, but primarily a convergence-delay problem rather than direct data loss.

### 5. Tackle Search And Sync Scale When Usage Demands It

Confirmed current behavior:

- A 60-second sync interval exists, but saves already trigger immediate sync, so the interval acts as a safety net.
- Full sync still performs membership scans for deletion reconciliation.
- Encrypted search requires client-side decryption of note content.

Recommended changes:

- Keep the current sync design for now.
- If latency becomes noticeable, prioritize deletion reconciliation improvements before broader sync redesign.
- Delay local search indexing or worker-based search until note volume makes it necessary.

Why it is deferred:

- This is the most future-facing work in the list and is least urgent pre-launch.

---

## Implementation Touchpoints

### Shared Local Storage Upgrade

- Coordinate items 1 and 2 into a single Dexie version bump in `src/lib/offlineDb.ts`.
- That single upgrade should add:
  - queue-entry status support for `pending | blocked`
  - retry and error metadata on queue entries
  - a small `meta` table or equivalent metadata record for hydration state

### Item 1 Touchpoints

- `src/services/syncEngine.ts`
  - stale cleanup path
  - retry exhaustion path
  - blocked entries excluded from normal auto-processing
- `src/lib/offlineDb.ts`
  - sync queue schema update
- `src/components/SyncIndicator.tsx`
  - blocked count
  - `Retry blocked changes` action

### Item 2 Touchpoints

- `src/services/offlineNotes.ts`
  - `hydrateFromServer()`
  - `needsHydration()`
- `src/lib/offlineDb.ts`
  - hydration metadata storage

### Item 3 Touchpoints

- `src/components/PassphraseSetup.tsx`
- `src/components/PassphraseUnlock.tsx`
- `src/components/ShareModal.tsx`
- `src/contexts/EncryptionContext.tsx`
- `src/components/SharedNoteView.tsx`

---

## Operational Recommendations

Keep the first operational pass lightweight:

- Add Sentry breadcrumbs or counters for hydration starts and failures, blocked mutations, sync partial/error outcomes, and decryption failures.
- Track blocked mutation count and hydration fallback frequency in the app where possible.
- Skip full dashboards and formal support runbooks for now.
- Write support guidance organically from real incidents rather than upfront process documents.

---

## Validation And Rollout

### Automated Tests

- Failure-injection tests for retry exhaustion and stale cleanup to confirm blocked entries remain recoverable.
- Tests proving hydration does not clear local state when queued work exists.
- Dexie upgrade tests for the single version bump that adds both queue-state changes and hydration metadata.
- Targeted tests for key-check failure and decryption error telemetry.

### End-To-End Scenarios

- offline edit followed by repeated sync failure
- reconnect after blocked mutation
- startup after hydration timeout
- startup with queued work already present
- cross-device note edit plus tag update sanity checks

### Acceptance Criteria

- After 5 failed retries, the queue entry remains in `syncQueue` with `status='blocked'`.
- Stale non-create entries are marked `blocked`, not removed.
- Blocked entries are excluded from automatic sync cycles until the user retries them.
- `Retry blocked changes` resets blocked entries to `pending` and triggers immediate sync.
- Startup does not clear local state while `pending` or `blocked` queue entries exist.
- Users receive clearer warnings about unrecoverable E2EE loss cases.
- Sync visibility improves without introducing a large new subsystem.

---

## Assumptions And Limits

- Supabase schema changes are allowed if note-tag convergence is prioritized later.
- Introducing `blocked` or `failed` queue state is acceptable.
- Web E2EE cannot fully eliminate XSS or same-origin compromise risk; the goal is reduction and observability, not perfect protection.
- This document remains review-first and should not yet be treated as a full implementation spec for all five items.
