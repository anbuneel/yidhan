# Cross-Device Sync UX Overhaul

**Version:** 12.0
**Last Updated:** 2026-02-16
**Status:** Final — Codex approved with all review findings addressed (v12)
**Author:** Claude (Opus 4.6)

---

## Original Prompt

> I see an issue where the save on a note edit is delayed. Here's the scenario: I edited a note on my mobile, switched to laptop and don't see the edits. I have to refresh - which takes me back to the home page and wait for some time and then open the note again. This is not world class note taking UX.

---

## Context

Editing a note on mobile and switching to laptop fails silently — edits don't appear until the user refreshes (which dumps them to the home page). This stems from multiple gaps in the save→sync→display pipeline: "Saved" only means IndexedDB (not cloud), the sync engine runs on a 30s interval with no post-save trigger, there's no visibility/pagehide flush for mobile app-switching, the editor ignores incoming remote updates for the same note, and pull-to-refresh only reads local data.

This plan addresses all identified issues from both Claude and Codex investigations, plus all findings from eleven rounds of Codex plan review.

### Root Causes (agreed by both Claude and Codex)

1. **"Saved" means local IndexedDB, not cloud sync.** `performSave()` → `onUpdate()` → `handleNoteUpdate()` → `updateNoteOffline()` writes to IndexedDB and queues a sync operation. The "Saved" indicator appears after IndexedDB write, NOT after server sync.
2. **Cross-device delay is 1.5s to 31.5s.** Debounce is 1.5s (`Editor.tsx:233`), then sync engine runs every 30s (`useSyncEngine.ts:117`). No immediate sync after save.
3. **No `visibilitychange`/`pagehide`/`beforeunload` flush.** When user switches apps on mobile, the pending 1.5s debounce timer may never fire. Edits sit unsaved in React state.
4. **Editor ignores same-note remote updates.** `Editor.tsx:80-96` only resets local state when `note.id` changes. If laptop has the note open, incoming updates don't appear.
5. **Sync pull updates IndexedDB but doesn't rehydrate React state.** `fullSync` writes to IndexedDB but App.tsx's `notes` array isn't refreshed from sync results.
6. **Pull-to-refresh is local-only.** `handleRefresh` (`App.tsx:951-962`) only calls `fetchNotesOffline()`.
7. **Realtime subscription has unnecessary churn.** Effect deps include `selectedNoteId` (`App.tsx:467`), causing unsubscribe/resubscribe on every note selection.
8. **Clock-skew edge case.** `lastSyncedAt` uses `Date.now()` client-side vs server timestamps in `pullRemoteChanges`.

---

## Prerequisite: Paginated Supabase Fetching

**File:** `src/lib/supabase.ts` (shared utility, imported by both `syncEngine.ts` and `offlineNotes.ts`)

**Problem (Codex R10 #2, #3):** Supabase returns a maximum of 1000 rows per request by default. All pull queries (data pulls and ID-membership queries) currently use unpaginated `select()` calls. If a user has >1000 notes, the membership query returns a truncated set — valid server notes look "absent" and get falsely deleted locally. Incremental/full data pulls have the same truncation risk, silently missing updates while reporting success.

**Solution:** Add a paginated fetch helper in `src/lib/supabase.ts` (Codex R11 #2 — co-located with the Supabase client instance so both `syncEngine.ts` and `offlineNotes.ts` can import it):
```typescript
const PAGE_SIZE = 1000;

export async function fetchAllPaginated<T>(
  queryBuilder: () => PostgrestFilterBuilder<any, any, T[]>
): Promise<{ data: T[]; error: Error | null }> {
  const allData: T[] = [];
  let offset = 0;

  while (true) {
    // .order('id') ensures deterministic pagination (Codex R11 #3):
    // without stable ordering, concurrent inserts/updates can shift rows
    // between pages, causing duplicates or skipped entries.
    const { data, error } = await queryBuilder()
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) return { data: allData, error };
    if (!data) break;

    allData.push(...data);
    if (data.length < PAGE_SIZE) break; // Last page
    offset += PAGE_SIZE;
  }

  return { data: allData, error: null };
}
```

**All pull queries must use this helper:**
- Note data pull (full or incremental)
- Tag data pull (full or incremental)
- Note ID-membership query (`select('id')`)
- Tag ID-membership query (`select('id')`)
- Initial hydration fetch (`offlineNotes.ts`)

**Partial-page error handling:** If a paginated fetch errors partway through (pages 1-3 succeeded, page 4 failed), the helper returns both the data collected so far AND the error. The caller decides: for data upserts, apply what was fetched and report `'partial'`; for membership queries, **skip deletion reconciliation entirely** (incomplete membership set would cause false deletions) and report `'partial'`.

---

## Phase 1: Critical Data Pipeline

These three changes fix the core problem: edits not reaching the server promptly.

### 1A. Immediate sync trigger after local save + relax interval to 60s

**Files:** `src/App.tsx`, `src/hooks/useSyncEngine.ts`

- Destructure `triggerSync` from `useSyncEngine()` (line 137 — currently only destructures `conflicts, removeConflict`)
- Add a coalesced sync trigger: a `useRef` timeout that calls `triggerSync()` after 2s, reset on each save (prevents flooding during rapid typing)
- Call this coalesced trigger at the end of `handleNoteUpdate()` (line ~756), after `updateNoteOffline()` succeeds
- Relax the periodic interval from 30s to 60s (`useSyncEngine.ts:120`) since saves now trigger immediate sync — the interval is just a safety net
- **Re-run latch (Codex R2 #5):** Add a `syncRequestedWhileRunning` ref in `useSyncEngine`. When `triggerSync` is called while `isSyncInProgress()` is true, set the latch. After `doSync` completes, check the latch — if set, clear it and run `doSync` again. This ensures queue entries added during an active sync cycle are processed immediately, not deferred to the next interval. The latch is binary (not a counter) to avoid runaway re-runs.
- Clean up the timeout ref on unmount

**Impact:** Worst-case server push drops from ~32s → ~3.5s (1.5s debounce + 2s coalesce). Background churn halved. No more missed entries during active sync.

### 1B. Flush pending auto-save on visibility change / page hide

**File:** `src/components/Editor.tsx`

- Add a `useEffect` with `visibilitychange` and `pagehide` event listeners
- On `document.visibilityState === 'hidden'` or `pagehide`: cancel the debounce timer (`autoSaveTimeoutRef`), immediately call `performSave()` if title/content differ from last saved values
- **Race handling (Codex #5):** Before calling `performSave()`, await `inFlightSaveRef.current` if one exists, and use a `flushingRef` guard to prevent double-dispatch if both `visibilitychange` and `pagehide` fire in sequence
- Works in both web browsers and Capacitor WebViews (standard Web APIs)

**Impact:** Eliminates the scenario where mobile app-switching leaves edits stranded in React state.

### 1C. Make pull-to-refresh trigger server sync first (with failure handling)

**Files:** `src/App.tsx`, `src/hooks/useSyncEngine.ts`

- **Return richer sync outcome (Codex R2 #3):** Change `doSync` in `useSyncEngine.ts` to return a status enum instead of swallowing errors:
  ```typescript
  type SyncOutcome = 'ok' | 'partial' | 'offline' | 'error';
  interface TriggerSyncResult { outcome: SyncOutcome; result?: FullSyncResult }
  ```
  - `'ok'`: `fullSync` succeeded, `result.failed === 0`, and pull had no errors
  - `'partial'`: `fullSync` succeeded but `result.failed > 0`, or pull had **some but not all** entities fail (e.g. tag pull failed but note pull succeeded)
  - `'offline'`: short-circuited because `!isOnline`
  - `'error'`: `fullSync` threw an exception, or **all** pull entities failed (both notes and tags returned errors)

  **Deterministic mapping (Codex R8 #3, updated R11 #1):** `doSync` in `useSyncEngine` maps outcomes based on **unique failed entities in data pulls only** — membership-query failures are reconciliation gaps (not complete data loss), so they map to `'partial'`, never `'error'`:
  ```typescript
  const failedDataEntities = new Set(
    result.pullErrors.filter(e => e.operation === 'data').map(e => e.entity)
  );
  const hasMembershipErrors = result.pullErrors.some(e => e.operation === 'membership');
  ```
  - Exception thrown → `'error'`
  - `failedDataEntities.size === 2` (both note and tag DATA pulls failed) → `'error'` (no useful data fetched)
  - `failedDataEntities.size === 1` or `result.failed > 0` or `hasMembershipErrors` → `'partial'`
  - None of the above → `'ok'`
- **Pull error propagation (Codex R3 #1):** Currently `pullRemoteChanges` logs errors and returns silently (`syncEngine.ts:608-611`, `652-655`). Change it to return error metadata alongside pull counts:
  ```typescript
  interface PullError {
    entity: 'notes' | 'tags';
    operation: 'data' | 'membership';  // Codex R11 #1: distinguish for outcome mapping
    error: Error;
  }
  interface PullResult {
    pulledNotes: number;
    pulledTags: number;
    errors: PullError[];
  }
  ```
  **Both entity pulls must run independently (Codex R9 #2):** The current code early-returns after a notes pull error (`syncEngine.ts:608-610`), preventing the tag pull from running at all. This must be removed — a notes error should be collected into `errors` and the function should continue to the tag pull. Without this, both data pulls can never fail independently, and the `'error'` outcome (`failedDataEntities.size === 2`) is unreachable. Structure:
  ```typescript
  const errors: PullResult['errors'] = [];

  // All queries use fetchAllPaginated to prevent truncation (Codex R10 #2, #3)

  // Note data pull — collect error, don't return
  const { data: updatedNotes, error: notesError } = await fetchAllPaginated(
    () => lastSync > 0
      ? supabase.from('notes').select('*').gt('updated_at', new Date(lastSync).toISOString())
      : supabase.from('notes').select('*')
  );
  if (notesError) {
    errors.push({ entity: 'notes', operation: 'data', error: notesError });
  }
  // Always process whatever data was fetched (even partial on mid-pagination error)
  // ... process updatedNotes ...

  // Tag data pull — always runs regardless of notes outcome
  const { data: changedTags, error: tagsError } = await fetchAllPaginated(
    () => lastTagSync > 0
      ? supabase.from('tags').select('*').gt('updated_at', new Date(lastTagSync).toISOString())
      : supabase.from('tags').select('*')
  );
  if (tagsError) {
    errors.push({ entity: 'tags', operation: 'data', error: tagsError });
  }
  // ... process changedTags ...

  // Note membership query — deletion detection for hard-deleted notes (Codex R9 #3)
  // For membership queries, skip deletion on error (incomplete set = false deletions)
  const { data: allNoteIds, error: noteMembershipError } = await fetchAllPaginated(
    () => supabase.from('notes').select('id')
  );
  if (noteMembershipError) {
    errors.push({ entity: 'notes', operation: 'membership', error: noteMembershipError });
    // Do NOT run deletion reconciliation — incomplete ID set would cause false deletes
  } else {
    const serverNoteIds = new Set(allNoteIds.map(n => n.id));
    const localNotes = await db.notes.toArray();
    for (const localNote of localNotes) {
      if (!serverNoteIds.has(localNote.id) && localNote.syncStatus === 'synced') {
        await db.notes.delete(localNote.id);
      }
    }
  }

  // Tag membership query — also always runs
  // ... (see deletion detection snippet below) ...

  return { pulledNotes, pulledTags, errors };
  ```
  `fullSync` merges pull errors into `FullSyncResult`. `doSync` in `useSyncEngine` maps per the deterministic rules above: all pull entities failed → `'error'`; some failed → `'partial'`; exception → `'error'`
- Change `handleRefresh()` (App.tsx:951-962) to `await triggerSync()` first, then `fetchNotesOffline()` + `fetchTagsOffline()` to rehydrate state
- **Branch on outcome in refresh UX:**
  - `'ok'` → "Notes refreshed"
  - `'partial'` → "Refreshed, but some changes couldn't sync"
  - `'offline'` → "You're offline. Showing local notes."
  - `'error'` → "Couldn't reach server. Showing local notes."
- Currently `handleRefresh` only calls `fetchNotesOffline()` (reads stale IndexedDB)

**Impact:** Pull-to-refresh becomes a real "get me the latest" action with honest, granular feedback.

---

## Phase 2: React to Remote Changes

These changes ensure the UI updates when changes arrive from another device.

### 2A. Rehydrate React state after fullSync (only when changes occurred)

**Files:** `src/hooks/useSyncEngine.ts`, `src/App.tsx`

- **Expand `fullSync` return to include pull counts (Codex R2 #1):** Currently `fullSync` (`syncEngine.ts:695-701`) calls `pullRemoteChanges()` (returns `void`) then `processQueue()` (returns `SyncResult`). The core cross-device case — another device changed notes, local queue is empty — returns `processed: 0`, which would miss the rehydration trigger.
  - Change `pullRemoteChanges()` to return `PullResult` (see 1C above) — count how many notes/tags were actually written to IndexedDB (not skipped), plus any errors
  - **Incremental tag pull (Codex R3 #2):** Currently tag pull fetches ALL tags (`select('*')` with no filter, `syncEngine.ts:648-650`) and re-puts every one — this means `pulled.tags` is always > 0, defeating the conditional rehydration. Fix: make tag pull incremental like notes. After the `updated_at` migration (3B), filter tags by `updated_at > lastTagSync`. Additionally, only count a tag as "pulled" when the server version actually differs from the local version (compare `name`, `color`, `updated_at` before writing). This ensures `pulled.tags` is 0 on no-op cycles.
  - **Note deletion reconciliation via ID-membership query (Codex R9 #3):** If a note is permanently deleted on another device while this client is offline, the incremental pull won't include it (deleted rows have no `updated_at`). The realtime DELETE event only fires online. Fix: add a lightweight `supabase.from('notes').select('id')` membership query in `pullRemoteChanges`, same pattern as tags. Any local synced note whose ID is absent from the server result is hard-deleted locally. Pending/conflict notes are preserved (they may be new local-only notes not yet pushed). The membership query error is captured in `pullErrors` — failure means deletion reconciliation is skipped but upserts still succeed (`'partial'` outcome).
  - **Tag deletion detection must be separated from incremental pull (Codex R8 #2):** The current deletion logic (`syncEngine.ts:682-689`) assumes the pull result is a **complete snapshot** — it deletes any local synced tag whose ID is absent from the server result. With incremental pulls, unchanged tags are absent from the result set (they haven't been updated), so this logic would wrongly delete them. Fix: split into two operations:
    1. **Incremental pull** (for data): fetch only changed tags via `.gt('updated_at', lastTagSync)` — used for upserts and accurate pull counts
    2. **Deletion check** (for membership): always fetch the full set of tag IDs via a lightweight `supabase.from('tags').select('id')` query — used exclusively for deletion detection
    ```typescript
    // 1. Incremental pull for changed tag data (paginated — Codex R10 #2, #3)
    const { data: changedTags, error: tagsError } = await fetchAllPaginated(
      () => lastTagSync > 0
        ? supabase.from('tags').select('*').gt('updated_at', new Date(lastTagSync).toISOString())
        : supabase.from('tags').select('*')
    );
    // ... upsert changedTags, count actual changes for pulled.tags ...

    // 2. Lightweight ID-only query for deletion detection (paginated)
    const { data: allTagIds, error: tagMembershipError } = await fetchAllPaginated(
      () => supabase.from('tags').select('id')
    );
    if (tagMembershipError) {
      // Capture in pullErrors so outcome maps to 'partial' (Codex R9 #1)
      // Do NOT run deletion — incomplete ID set would cause false deletes
      errors.push({ entity: 'tags', operation: 'membership', error: tagMembershipError });
    } else {
      const serverTagIds = new Set(allTagIds.map(t => t.id));
      for (const localTag of localTags) {
        if (!serverTagIds.has(localTag.id) && localTag.syncStatus === 'synced') {
          await db.tags.delete(localTag.id);
        }
      }
    }
    ```
    All queries use `fetchAllPaginated` to prevent Supabase's 1000-row default limit from truncating results (Codex R10 #2, #3). The ID-only query is very lightweight (just UUIDs, no name/color payload) and keeps deletion detection correct regardless of whether the data pull was full or incremental. **If any membership query fails (including mid-pagination errors), deletion reconciliation is skipped entirely for that entity** — an incomplete ID set would cause false deletions. The error is appended to `pullErrors` so sync reports `'partial'` (Codex R9 #1).
  - Change `fullSync` to return an expanded result:
    ```typescript
    interface FullSyncResult extends SyncResult {
      pulled: { notes: number; tags: number };
      pullErrors: PullError[];  // Uses PullError (with entity + operation + error)
    }
    ```
  - This gives the callback a complete picture of what changed
- Add an optional `onSyncComplete` callback parameter to `useSyncEngine()`
- Call it after successful `fullSync()` in `doSync()`, passing the `FullSyncResult`
- **Conditional rehydration (Codex #4, updated):** Only call the callback when `result.processed > 0 || result.conflicts > 0 || result.pulled.notes > 0 || result.pulled.tags > 0` — skip when the sync cycle had no meaningful changes in either direction, avoiding unnecessary re-renders
- In `App.tsx`, pass a callback that re-reads notes and tags from IndexedDB into React state (`fetchNotesOffline` → `setNotes`, `fetchTagsOffline` → `setTags`)
- This is safe because the Editor maintains its own local state independent of the `notes` array — no risk of blowing away in-flight edits

**Impact:** Library view and the `selectedNote` prop stay fresh after sync cycles that actually changed data, including pull-only updates from other devices.

### 2B. Apply remote updates to the currently open editor

**File:** `src/components/Editor.tsx`

- Add `lastSavedTitleRef` and `lastSavedContentRef` refs to track what was last saved (updated in `performSave` success path and on note switch)
- Add a new `useEffect` that watches `note.title` and `note.content` (the prop from parent) while `note.id === currentNoteId`:
  - **Self-echo check:** If incoming matches `lastSavedRef` values, ignore (it's our own save echoing back via realtime)
  - **Clean editor:** If local state matches `lastSavedRef` (no unsaved changes), silently update `title`, `content`, and Tiptap editor content
  - **Dirty editor:** If user has unsaved changes, show a "Updated on another device" banner with "Load changes" and "Keep mine" buttons
- Add `remoteUpdate` state and banner JSX (styled with wabi-sabi design tokens)

**Precedence with ConflictModal (Codex #6):**
- The editor banner handles **UI-level conflicts** — the user has unsaved local edits in React state while a different version arrives via the `note` prop. This is a lightweight, pre-save conflict.
- The existing `ConflictModal` ("Two Paths") handles **sync-level conflicts** — detected during `processQueue` when the sync engine tries to push a locally-saved IndexedDB note to the server and finds the server version was updated after `lastSyncedAt`. This is a post-save conflict.
- **They cannot overlap:** The editor banner appears while edits are still in React state (not yet saved to IndexedDB). Once the user saves, the edit goes through the normal sync pipeline, and if the server has a newer version, the ConflictModal handles it. If the user clicks "Load changes" on the banner, their local state is replaced with the remote version — no sync conflict possible. If they click "Keep mine", they continue editing and their next save goes through normal conflict detection.
- **Data flow:** Banner state (`remoteUpdate`) is local to Editor and does not interact with `ConflictInfo`/`conflicts` from the sync engine. No shared state between the two systems.

**Impact:** Users see cross-device changes in real time; conflicts get a clear resolution UI with well-defined precedence.

### 2C. Preserve syncStatus in realtime updates

**File:** `src/App.tsx`

**Problem (Codex R3 #3):** The realtime `onUpdate` handler (`App.tsx:440-442`) does `{ ...updatedNote, tags: n.tags }`. The `updatedNote` from Supabase has no `syncStatus` field, so this overwrites the local note's `syncStatus` with `undefined`, breaking the pending→synced transition that 3A depends on.

**Fix:** Preserve local `syncStatus` (and other local-only fields) during realtime merges:
```typescript
return prev.map((n) => {
  if (n.id === updatedNote.id) {
    return { ...updatedNote, tags: n.tags, syncStatus: n.syncStatus };
  }
  return n;
});
```

Also apply to:
- Restored notes insertion (line 450) — default `syncStatus: 'synced'`
- **Realtime `onInsert` handler (Codex R4 #2)** (`App.tsx:407-416`) — the new note from another device has no `syncStatus`. Set `syncStatus: 'synced'` when adding to React state, since it came from the server:
  ```typescript
  return [{ ...newNote, syncStatus: 'synced' }, ...prev];
  ```

**Impact:** Note-specific sync status is consistent across all server-originated paths (updates, inserts, restores), keeping the "Saved" → "Synced" transition reliable.

### 2D. Reduce auto-save debounce from 1.5s to 800ms

**File:** `src/components/Editor.tsx`

- Change the debounce timeout from `1500` to `800` (`Editor.tsx:235`)
- Most note apps (Notion, Apple Notes) use shorter debounce windows. 1.5s is conservative and adds unnecessary latency to the save→sync pipeline
- Combined with 1A (2s coalesced sync trigger), this reduces the total edit-to-server time from ~3.5s to ~2.8s

**Impact:** Shaves ~700ms off every save cycle. Low risk — the debounce still prevents save-per-keystroke.

### 2E. Persist navigation state across refresh

**File:** `src/App.tsx`

**Problem:** The app uses React state (`view`, `selectedNoteId`) with no URL routing and no persistence. On browser refresh, state resets to `view: 'library'` and the user is dumped back to the home page — losing their place in the editor.

**Solution:** Persist `view` and `selectedNoteId` to `sessionStorage` so a refresh returns the user to the note they were editing.

Implementation:
- On `view` or `selectedNoteId` change, write to `sessionStorage` (keyed per user to avoid cross-account leaks):
  ```typescript
  sessionStorage.setItem(`yidhan-nav-${userId}`, JSON.stringify({ view, selectedNoteId }));
  ```
- **Two-stage restore (Codex R4 #3, R6 #3):** Navigation state is restored in two stages to avoid flicker or stale editor:
  1. **On mount (before notes load):** Read `sessionStorage`, stash the saved `view` and `selectedNoteId` in a ref (e.g., `pendingNavRestoreRef`). Set `selectedNoteId` into state so the note will be selected once loaded, but keep `view` as `'library'` (shows the normal loading spinner):
     ```typescript
     const saved = sessionStorage.getItem(`yidhan-nav-${userId}`);
     if (saved) {
       const parsed = JSON.parse(saved);
       pendingNavRestoreRef.current = parsed;
       setSelectedNoteId(parsed.selectedNoteId);
       // Do NOT set view yet — wait for notes to load
     }
     ```
  2. **After notes load (in the existing `fetchNotesOffline` `.then()`):** Validate that `selectedNoteId` exists in the loaded notes. If yes, set `view` to the saved view. If no, clear the ref and stay on library:
     ```typescript
     .then((loadedNotes) => {
       setNotes(loadedNotes);
       const pending = pendingNavRestoreRef.current;
       if (pending?.selectedNoteId && loadedNotes.some(n => n.id === pending.selectedNoteId)) {
         setView(pending.view);
       } else {
         setSelectedNoteId(null); // Note was deleted
         sessionStorage.removeItem(`yidhan-nav-${userId}`);
       }
       pendingNavRestoreRef.current = null;
     })
     ```
- Clear on sign-out to prevent stale state for next user
- **Why `sessionStorage` over URL hash routes:** Hash routes would require a routing library or manual hash management across the entire app. `sessionStorage` is scoped to the browser tab, survives refresh, and doesn't leak state across tabs (each tab has its own session). It's a minimal change that solves the refresh problem without an architectural overhaul.

**Impact:** Refresh keeps users on the note they were editing instead of dumping them to the home page.

### 2F. Remove selectedNoteId from realtime subscription deps

**File:** `src/App.tsx`

- Add a `selectedNoteIdRef = useRef()` kept in sync with `selectedNoteId` state
- In the realtime subscription effect (lines 405-467), replace `selectedNoteId` references with `selectedNoteIdRef.current`
- Remove `selectedNoteId` from the effect's dependency array (line 467)
- This prevents unnecessary unsubscribe/resubscribe churn on every note open/close

**Impact:** No more brief windows where realtime updates could be missed during channel reconnection.

---

## Phase 3: UX Polish

### 3A. Distinguish "Saved locally" from "Synced to cloud" (note-specific)

**Files:** `src/components/Editor.tsx`, `src/App.tsx`, `src/lib/offlineDb.ts`

**Note-specific signal (Codex #1):** Instead of keying "Synced" to the global `lastSyncAt` timestamp, watch the selected note's `syncStatus` field in IndexedDB transition from `'pending'` → `'synced'`.

Implementation:
- Add a `noteSyncStatus` prop to Editor, derived in App.tsx from the `selectedNote`'s sync state
- After each sync cycle (via `onSyncComplete`), the rehydrated `notes` array includes updated sync statuses from IndexedDB
- In Editor, add an effect: when `noteSyncStatus` transitions to `'synced'` and the editor is in `'saved'` or `'idle'` state, briefly show `'synced'` status (2s)
- This only fires when **this specific note** reaches the server, not when unrelated notes sync
- Update the save indicator JSX: "Saved" (checkmark icon) for local, "Synced" (cloud-check icon) for server-confirmed

**Requires:** Exposing `syncStatus` on the `Note` type passed to Editor. Currently `Note` in `types.ts` doesn't have `syncStatus`:
- Add an optional `syncStatus?: 'synced' | 'pending' | 'conflict'` field to the `Note` type
- Populate it from `LocalNote.syncStatus` during the `localNoteToNote()` conversion in `offlineNotes.ts`

**Ensuring the transition is observable in React state (Codex R2 #2):** The current save path in `handleNoteUpdate` (`App.tsx:749`) does an optimistic update with the raw `updatedNote` object (which has no `syncStatus`). After `updateNoteOffline()` completes, the note is `'pending'` in IndexedDB but React state doesn't reflect this. Fix:
- After `updateNoteOffline()` succeeds, use its return value (which has `syncStatus: 'pending'`) to update React state instead of the pre-save `updatedNote`:
  ```typescript
  const savedNote = await updateNoteOffline(user.id, updatedNote);
  setNotes((prev) => prev.map((n) => n.id === savedNote.id ? savedNote : n));
  ```
- This ensures the note in React state goes `'synced'` → `'pending'` (on save) → `'synced'` (after sync completes and rehydrates), making the transition visible to Editor's `noteSyncStatus` prop

**Impact:** "Synced" means this exact note is cloud-confirmed. No false positives from unrelated sync cycles. Transition from pending → synced is always observable.

### 3B. Standardize lastSyncedAt to server timestamps (comprehensive)

**Files:** `src/services/syncEngine.ts`, `src/services/offlineNotes.ts`

**Full scope (Codex #2):**

For **notes** — 5 locations to fix:
1. `pullRemoteChanges()` (`syncEngine.ts:628-641`): Replace `const now = Date.now()` with `new Date(serverNote.updated_at).getTime()` for `lastSyncedAt`
2. Idempotent create path (`syncEngine.ts:179`): Replace `new Date()` in `markNoteSynced(userId, noteId, new Date())` with the server's `updated_at` — add `.select('updated_at')` to the existing check query
3. Initial hydration (`offlineNotes.ts:63`): Replace `now` (which is `Date.now()`) with `new Date(dbNote.updated_at).getTime()` for `lastSyncedAt`
4. **Soft-delete sync path (Codex R3 #4)** (`syncEngine.ts:266`): Currently `markNoteSynced(userId, noteId, new Date())` uses client time. Fix: add `.select('updated_at').single()` to the soft-delete update query and use the returned server timestamp
5. **All other note sync paths that already use server time** (`syncEngine.ts:196`, `:255`, `:279`, `:303`): Already correct — these use `new Date(result.updated_at)`. No changes needed, but verify during implementation.

For **tags** — requires schema migration:
4. Add `updated_at` column to `tags` table via Supabase migration (`supabase/migrations/add_tags_updated_at.sql`):
   ```sql
   ALTER TABLE tags ADD COLUMN updated_at timestamptz DEFAULT now() NOT NULL;
   -- Backfill existing rows
   UPDATE tags SET updated_at = created_at;
   -- Auto-maintain on updates (Codex R2 #4)
   CREATE OR REPLACE FUNCTION update_tags_updated_at()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = now();
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER tags_updated_at_trigger
     BEFORE UPDATE ON tags
     FOR EACH ROW
     EXECUTE FUNCTION update_tags_updated_at();
   ```
5. Update `src/types/database.ts` to include `updated_at` in the tags Row type
6. `pullRemoteChanges()` (`syncEngine.ts:668-679`): Replace `const now = Date.now()` with `new Date(serverTag.updated_at).getTime()` for `lastSyncedAt` and `serverUpdatedAt`
7. Tag hydration (`offlineNotes.ts:70-77`): Same pattern as notes — use server timestamp
8. **All `markTagSynced` calls (Codex R3 #4)** (`syncEngine.ts:334`, `:346`, `:360`): All three use `new Date()` (client time). Fix: add `.select('updated_at').single()` to each tag create/update/delete query that returns data, and pass the server timestamp to `markTagSynced`. For tag deletes where the row is gone, `markTagSynced` is a no-op anyway (tag removed from local DB), so no timestamp needed.
9. Tag update sync path (`syncEngine.ts:351-356`): The Postgres trigger auto-sets `updated_at` on any UPDATE, so the returned `updated_at` will be fresh server time

### 3C. One-time sync cursor migration for existing skewed timestamps

**File:** `src/lib/offlineDb.ts`

**Problem (Codex R4 #1):** Existing IndexedDB entries have `lastSyncedAt` values written with `Date.now()` (client time). If a device's clock was ahead, these "future" timestamps will suppress incremental pulls (`updated_at > lastSyncedAt` will miss real updates) even after the fix is deployed.

**Solution:** Use a **Dexie schema version upgrade** to reset sync cursors on first app start after this release.

**Mechanism (Codex R5 #2):** Bump the Dexie schema version in `offlineDb.ts` (currently version 2, lines 96-112). The new version (3) triggers Dexie's `.upgrade()` hook, which runs exactly once per database — deterministic, no ambient flag needed:
```typescript
db.version(3).stores({
  // Same indexes as v2 — no schema change needed, just the upgrade hook
  notes: 'id, userId, syncStatus, deletedAt, pinned, updatedAt',
  // ...
}).upgrade(async (tx) => {
  // Only reset synced entries (Codex R5 #1):
  // Pending/conflict notes must keep their cursors to preserve
  // conflict detection on the next push cycle
  await tx.table('notes')
    .where('syncStatus').equals('synced')
    .modify({ lastSyncedAt: 0 });
  await tx.table('tags')
    .where('syncStatus').equals('synced')
    .modify({ lastSyncedAt: 0 });
});
```

**Why only reset `syncStatus: 'synced'` (Codex R5 #1):** Pending notes have local changes not yet pushed. If we reset their `lastSyncedAt` to 0, the next push cycle's conflict check (`serverUpdatedAt > lastSyncedAt`) would always be false — skipping conflict detection entirely and risking overwriting newer server content. By preserving pending/conflict cursors, those entries go through normal conflict detection on the next sync. Only `'synced'` entries need the reset since they have no local changes at risk.

**Pull cursor must also respect this (Codex R6 #1):** The current pull cursor in `pullRemoteChanges` (`syncEngine.ts:590-595`) computes `lastSync = Math.max(...notes.map(n => n.lastSyncedAt || 0))` across ALL notes. After the migration, a pending note with a skewed future `lastSyncedAt` would still suppress pulls. Fix: compute the pull cursor from `syncStatus === 'synced'` rows only:
```typescript
const syncedNotes = notes.filter(n => n.syncStatus === 'synced');
const lastSync = Math.max(...syncedNotes.map(n => n.lastSyncedAt || 0), 0);
```
Apply the same filter for the tag pull cursor when incremental tag pull is implemented.

**`lastSync === 0` guard must be altered (Codex R7 #1):** The current `pullRemoteChanges` has an early return at `syncEngine.ts:597-600`:
```typescript
// Current — blocks post-migration re-pull
if (lastSync === 0) {
  return; // "initial hydration handles this"
}
```
After the Dexie v3 upgrade resets all synced entries to `lastSyncedAt: 0`, this guard would cause pull to silently no-op, defeating the migration entirely.

**Fix: remove the `lastSync === 0` early return entirely (Codex R8 #1).** The original guard assumed initial hydration always populates IndexedDB before pull runs. But hydration is explicitly non-fatal on timeout (`AuthContext.tsx:105`), and the app continues with local-only load (`App.tsx:399`). If the local DB is empty in that state, the guard causes a dead-end: cloud data never appears.

Instead, always attempt a pull — full when `lastSync === 0` (empty DB, post-migration, or failed hydration), incremental otherwise:
```typescript
const notes = await db.notes.toArray();
const syncedNotes = notes.filter(n => n.syncStatus === 'synced');
const lastSync = Math.max(...syncedNotes.map(n => n.lastSyncedAt || 0), 0);

// Full pull when lastSync is 0 (empty DB, post-migration, or failed hydration);
// incremental pull otherwise. No early return — pull is the recovery path.
// All queries use fetchAllPaginated to prevent truncation (Codex R10 #2, #3).
const { data: updatedNotes, error: notesError } = await fetchAllPaginated(() => {
  const q = supabase.from('notes').select('*');
  return lastSync > 0
    ? q.gt('updated_at', new Date(lastSync).toISOString())
    : q;
});
```
The worst case is a redundant full fetch right after successful hydration — a minor one-time cost that's far safer than a permanent dead-end. The same pattern applies to the tag pull query. All queries are paginated to prevent Supabase's 1000-row default limit from causing truncation.

**Impact:** Cleans up all legacy clock-skewed sync cursors on first run without weakening conflict detection for in-flight edits. Pull cursor cannot be poisoned by pending/conflict entries. Post-migration pull correctly re-fetches all server data.

---

## Execution Order

```
Phase 1 (independent — can be done in parallel):
  1A. Immediate sync trigger + 60s interval     [App.tsx, useSyncEngine.ts]
  1B. Flush on visibilitychange/pagehide        [Editor.tsx]
  1C. Pull-to-refresh with sync + failure path  [App.tsx, useSyncEngine.ts]

Phase 2 (order matters — see dependencies below):
  2D. Reduce debounce to 800ms                  [Editor.tsx]  (independent)
  2E. Persist navigation state (sessionStorage) [App.tsx]     (independent)
  2F. Remove selectedNoteId from realtime deps  [App.tsx]     (independent)
  2C. Preserve syncStatus in realtime updates   [App.tsx]     (needed by 3A)
  2A. Conditional rehydrate after fullSync      [useSyncEngine.ts, App.tsx, syncEngine.ts]
      NOTE: 2A's incremental tag pull requires 3B's tags.updated_at migration.
      Implementation approach: deploy 2A with a fallback — if the incremental tag
      query fails with PostgreSQL error code 42703 (undefined_column), fall back
      to full tag pull (current behavior). After 3B migration lands, the
      incremental path activates automatically.
      Detection mechanism: the `.gt('updated_at', ...)` Supabase query returns
      `{ error: { code: '42703' } }` when the column doesn't exist. This is
      deterministic — no ambient flags or feature checks needed.
  2B. Remote updates in open editor + banner    [Editor.tsx]  (depends on 2A)

Phase 3 (3C and 3B first, then 3A):
  3C. One-time sync cursor migration            [offlineDb.ts]
  3B. Server timestamp standardization          [syncEngine.ts, offlineNotes.ts, database.ts, migration]
  3A. Note-specific Synced UX                   [Editor.tsx, App.tsx, offlineNotes.ts, types.ts]

Post-implementation:
  - Update CLAUDE.md, changelog.ts, README.md per repo conventions
  - Update docs/prd.md if sync UX is documented there
```

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/App.tsx` | Destructure `triggerSync`; coalesced sync trigger; fix `handleRefresh` with failure path; `onSyncComplete` callback (conditional); preserve `syncStatus` in realtime handlers; `selectedNoteIdRef` for realtime deps; pass `noteSyncStatus` to Editor; `sessionStorage` nav state persistence; use `updateNoteOffline` return value in `handleNoteUpdate` |
| `src/components/Editor.tsx` | Visibility/pagehide flush with race guards; remote update detection + banner; `lastSaved*Ref` tracking; note-specific `'synced'` save status; reduce debounce to 800ms |
| `src/hooks/useSyncEngine.ts` | `onSyncComplete(result)` callback (conditional on pull+push changes); return `TriggerSyncResult` with `SyncOutcome` enum and `FullSyncResult`; relax interval to 60s; re-run latch for mid-sync triggers |
| `src/lib/supabase.ts` | `fetchAllPaginated` helper with `.order('id')` for deterministic pagination (shared by `syncEngine.ts` and `offlineNotes.ts`) |
| `src/services/syncEngine.ts` | `pullRemoteChanges` returns `PullResult` (counts + typed errors with `operation: 'data' \| 'membership'`); note + tag ID-membership queries for deletion reconciliation; pull cursor computed from `syncStatus === 'synced'` only; `fullSync` returns `FullSyncResult`; incremental tag pull (filter by `updated_at`, with fallback); server timestamps in pull + all sync paths (soft_delete, markTagSynced); fix idempotent create path timestamp; all queries paginated |
| `src/lib/offlineDb.ts` | Dexie v3 schema upgrade: reset `lastSyncedAt` to 0 on `syncStatus: 'synced'` entries only |
| `src/services/offlineNotes.ts` | Server timestamps in hydration (`dbNoteToLocal`, `dbTagToLocal`); expose `syncStatus` via `localNoteToNote()`; hydration fetches use `fetchAllPaginated` (imported from `supabase.ts`) |
| `src/types.ts` | Add optional `syncStatus` field to `Note` type |
| `src/types/database.ts` | Add `updated_at` to tags Row/Insert/Update types |
| `supabase/migrations/add_tags_updated_at.sql` | New migration: add `updated_at` column + trigger to tags table |

---

## Testing Strategy

### Unit Tests (extend existing)

**Editor.tsx tests:**
- Visibility flush: simulate `visibilitychange` with `hidden`, assert `onUpdate` called immediately
- Visibility flush race: trigger flush while `inFlightSaveRef` has a pending promise, assert no double-dispatch
- Visibility + pagehide sequence: fire both events, assert `performSave` called only once (guard ref)
- Remote update (clean editor): re-render with updated note prop, assert content updates silently (no banner)
- Remote update (dirty editor): change title, re-render with updated note prop, assert banner appears
- Self-echo suppression: save, re-render with matching note prop, assert no banner
- "Load changes" / "Keep mine" button behavior
- Note-specific synced: change `noteSyncStatus` prop from `'pending'` to `'synced'`, assert "Synced" indicator shows
- False synced prevention: verify "Synced" does NOT show when `noteSyncStatus` is still `'pending'`

**useSyncEngine tests:**
- `onSyncComplete` callback invoked after `fullSync` with pushed changes (`processed > 0`)
- `onSyncComplete` callback invoked after `fullSync` with pulled changes only (`pulled.notes > 0`, `processed === 0`)
- `onSyncComplete` NOT invoked when sync has no changes in either direction
- `triggerSync` returns `outcome: 'ok'` on clean sync, `'partial'` when `failed > 0` or one pull entity failed, `'offline'` when not online, `'error'` on exception
- `triggerSync` returns `'error'` only when both entities have DATA pull failures (`failedDataEntities.size === 2`)
- `triggerSync` returns `'partial'` when tag membership query fails but data pulls succeed
- `triggerSync` returns `'partial'` (not `'error'`) when both membership queries fail but both data pulls succeed
- `triggerSync` returns `'partial'` (not `'error'`) when single entity has 2 errors (data + membership) — uses `operation` field, not raw count
- Coalesced sync: multiple rapid triggers → single `fullSync` call
- Re-run latch: trigger sync during active sync → second run happens after first completes
- Re-run latch is binary: three triggers during active sync → only one re-run (not two)

**syncEngine tests:**
- Verify `pullRemoteChanges` returns correct pull counts (only counts actually-changed tags, not all)
- Verify `pullRemoteChanges` returns error metadata when note/tag pull fails (not silent)
- Verify `pullRemoteChanges` uses server timestamp for `lastSyncedAt`, not `Date.now()`
- Verify idempotent create path uses server timestamp from existing note
- Verify soft-delete path uses server timestamp (not `new Date()`)
- Verify all `markTagSynced` calls use server timestamp
- Verify tag pull is incremental (filters by `updated_at > lastTagSync`)
- Verify tag pull fallback: when incremental query returns error code `42703`, falls back to full tag pull (fetches all tags)
- Verify incremental tag pull does NOT delete unchanged local tags (absence from incremental result ≠ deletion)
- Verify tag deletion uses ID-only query (`select('id')`) and correctly removes tags not present on server
- Verify tag deletion preserves local tags with `syncStatus: 'pending'` even if absent from server
- Verify tag ID-membership query failure: upserts still succeed, error appended to `pullErrors`, outcome is `'partial'`
- Verify note ID-membership query removes locally-synced notes absent from server (hard-delete reconciliation)
- Verify note ID-membership query preserves local notes with `syncStatus: 'pending'` (may be unpushed new notes)
- Verify note ID-membership query failure: upserts still succeed, error appended to `pullErrors`, outcome is `'partial'`
- Verify notes pull and tags pull run independently: notes error does NOT prevent tag pull from executing
- `fetchAllPaginated`: returns all rows when result exceeds 1000 (mock multi-page response)
- `fetchAllPaginated`: stops on last page (data.length < PAGE_SIZE)
- `fetchAllPaginated`: mid-pagination error returns partial data + error (not just error)
- `fetchAllPaginated`: applies `.order('id')` to each page for deterministic pagination
- Membership query with mid-pagination error: deletion reconciliation is skipped (not run on partial ID set)
- Membership query with mid-pagination error: error appended to pullErrors, outcome is `'partial'`
- Verify tag `lastSyncedAt` uses `updated_at` after migration

**App.tsx tests:**
- Realtime subscription stability: verify channel is NOT recreated when `selectedNoteId` changes
- Realtime `onUpdate` preserves local `syncStatus` (not clobbered by server note shape)
- Realtime `onInsert` sets `syncStatus: 'synced'` on new notes from server
- Pull-to-refresh with each `SyncOutcome`: verify correct toast for `'ok'`, `'partial'`, `'offline'`, `'error'`
- `handleNoteUpdate` sets `syncStatus: 'pending'` in React state (uses return value from `updateNoteOffline`)
- Navigation state persists across refresh (sessionStorage round-trip)
- Navigation state clears on sign-out
- Navigation restore defers view switch until notes are loaded (no flicker)
- Graceful fallback when restored `selectedNoteId` points to deleted note
- Dexie v3 upgrade resets `lastSyncedAt` to 0 only for `syncStatus: 'synced'` entries
- Dexie v3 upgrade preserves `lastSyncedAt` on pending/conflict entries (conflict detection intact)
- After upgrade, next pull re-fetches all synced notes/tags from server (full pull, no `.gt()` filter)
- `pullRemoteChanges` never skips — always attempts pull (no early return guard)
- `pullRemoteChanges` uses full pull (no timestamp filter) when `lastSync === 0` (empty DB, post-migration, or failed hydration)
- `pullRemoteChanges` recovers from failed hydration: empty local DB + server has notes → pull populates IndexedDB

### E2E Tests (new file: `e2e/sync.spec.ts`)
- Cross-tab sync: edit in tab 1, verify appears in tab 2 within 10s
- Pull-to-refresh: create note via API, pull-to-refresh, verify it appears

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Double processing (realtime + sync both deliver same update) | Realtime callbacks already deduplicate inserts; update overwrites are idempotent |
| Infinite loop from onSyncComplete → setNotes → re-render | `handleSyncComplete` only reads IndexedDB, doesn't trigger another sync; `isSyncInProgress()` guard prevents concurrent syncs; conditional on actual changes (pull or push) prevents no-op cycles; incremental tag pull prevents false positives |
| Pull errors silently swallowed | `pullRemoteChanges` now returns error metadata; `fullSync` merges into `FullSyncResult`; `SyncOutcome` maps to `'partial'` or `'error'` for honest refresh UX |
| syncStatus clobbered by realtime | Realtime `onUpdate` handler explicitly preserves local `syncStatus` during merge |
| Stale nav state after sign-out | `sessionStorage` cleared on sign-out; view switch deferred until notes load; `selectedNoteId` validated against loaded notes |
| Legacy skewed sync cursors | Dexie v3 upgrade resets `lastSyncedAt` to 0 only on `syncStatus: 'synced'` entries; pending/conflict cursors preserved for safe conflict detection |
| Empty-DB dead-end after hydration failure (Codex R8 #1) | `pullRemoteChanges` no longer has an early-return guard; always attempts pull. `lastSync === 0` triggers full pull (no `.gt()` filter), acting as recovery path for failed hydration, empty DB, and post-migration scenarios |
| Incremental tag pull false deletions (Codex R8 #2) | Tag deletion detection separated from incremental pull; uses lightweight ID-only query (`select('id')`) that always returns full membership set, regardless of incremental/full data pull mode |
| Cross-device permanent note delete while offline (Codex R9 #3) | Note ID-membership query in pull path detects server-deleted notes; only removes local synced notes (pending preserved); membership query failure degrades to `'partial'` (upserts unaffected) |
| Membership query failure (notes or tags) | Error captured in `pullErrors`; upserts still succeed; outcome maps to `'partial'` — honest signal that reconciliation was incomplete |
| Supabase row limit truncation (Codex R10 #2, #3) | All pull queries use `fetchAllPaginated` helper; mid-pagination errors on membership queries skip deletion reconciliation entirely (incomplete ID set would cause false deletes); mid-pagination errors on data pulls apply what was fetched and report `'partial'` |
| SyncOutcome misclassification (Codex R10 #1, R11 #1) | Outcome mapping uses `failedDataEntities` (filtered to `operation === 'data'` only); membership-only failures always map to `'partial'`, never `'error'`; `'error'` reserved for both data pulls failing |
| Pagination row duplication/skip (Codex R11 #3) | All paginated queries use `.order('id')` for deterministic ordering; UUID-based ordering is immutable across concurrent writes |
| Missing `tags.updated_at` column | Incremental tag query catches PostgreSQL error `42703` (undefined_column) and falls back to full tag pull; no app-level breakage before migration lands |
| Realtime inserts missing syncStatus | All server-originated inserts explicitly set `syncStatus: 'synced'` |
| Missed entries during active sync | Re-run latch ensures one follow-up sync runs; binary latch prevents runaway re-runs |
| syncStatus transition not observable | `handleNoteUpdate` uses `updateNoteOffline` return value (with `syncStatus: 'pending'`) to update React state, making pending→synced visible |
| Tag updated_at not maintained | Postgres trigger auto-sets `updated_at` on every UPDATE; no app-code maintenance needed |
| Editor content flicker during typing | Dirty editor check prevents silent replacement; banner gives user control |
| performSave during unmount via pagehide | Guarded by `flushingRef` and `inFlightSaveRef` await; writes to IndexedDB (safe); App.tsx still mounted |
| Offline breakage | `triggerSync` no-ops offline; `performSave` writes IndexedDB offline; all paths degrade gracefully |
| Capacitor native | `visibilitychange` and `pagehide` fire in Capacitor WebViews (standard Web APIs) |
| Banner vs ConflictModal confusion | Well-defined precedence: banner = pre-save (React state), ConflictModal = post-save (sync engine). Cannot overlap. |
| False "Synced" on unrelated sync cycles | Gated on note-specific `syncStatus` field, not global timestamp |
| Tags missing `updated_at` | Schema migration adds column with backfill from `created_at` |
