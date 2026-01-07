# Offline Editing Implementation Plan

**Version:** 1.3
**Last Updated:** 2026-01-07
**Status:** In Progress
**Author:** Claude (Opus 4.5)
**Branch:** `feature/offline-editing`

---

## Original Prompt

> Let's implement offline editing in a new branch? [...] Full offline editing.

---

## Overview

Full offline editing for Zenote using IndexedDB (Dexie.js) with automatic sync when connection returns.

**Effort:** 2-3 weeks (6 phases)
**Bundle Impact:** ~35KB gzipped (Dexie + custom code)

---

## Implementation Progress

| Phase | Status | Commit | Description |
|-------|--------|--------|-------------|
| Phase 0 | ✅ Complete | `4904553` | PWA Foundation - iOS safe areas, touch feel, keyboard handling |
| Phase 1 | ✅ Complete | `64f2958` | IndexedDB Foundation + Service Worker with full offline-first |
| Phase 2 | ✅ Complete | `190f230` | Offline Writes with sync queue, compaction, dependency ordering |
| Phase 3 | ✅ Complete | `eb87431` | Sync Engine with self-ignore and conflict detection |
| Phase 4 | ⏳ Pending | - | Conflict Resolution UI ("Two Paths" modal) |
| Phase 5 | ⏳ Pending | - | UI Polish and testing |

### Phase 0 Summary (Complete)
- Added `viewport-fit=cover` to `index.html` for iOS safe areas
- Added safe area padding with `env(safe-area-inset-*)` CSS variables
- Added `user-select: none` to interactive elements for native touch feel
- Added `scroll-margin-top` for keyboard handling in editor

### Phase 1 Summary (Complete)
- Installed `dexie`, `dexie-react-hooks`, `vite-plugin-pwa`
- Created `src/lib/offlineDb.ts` with per-user database naming (`zenote-offline-${userId}`)
- Created `src/services/offlineNotes.ts` with hydration and read operations
- Updated `vite.config.ts` with `navigateFallback` for full offline-first
- Integrated hydration on login and clear on logout in `AuthContext.tsx`

### Phase 2 Summary (Complete)
**New Files:**
- `src/services/offlineTags.ts` - Offline-first tag CRUD operations
- `src/hooks/useSyncStatus.ts` - Hook to track sync state for UI

**Note Write Operations Added:**
- `createNoteOffline()` - Generate local UUID, write to IndexedDB, queue for sync
- `updateNoteOffline()` - Update locally with queue compaction
- `softDeleteNoteOffline()`, `restoreNoteOffline()`, `permanentDeleteNoteOffline()`
- `toggleNotePinOffline()`, `addTagToNoteOffline()`, `removeTagFromNoteOffline()`

**Tag Write Operations Added:**
- `createTagOffline()`, `updateTagOffline()`, `deleteTagOffline()`
- Includes duplicate name validation

**Sync Queue Features:**
- Queue compaction: Consecutive updates to same entity → keep only latest
- Dependency ordering: Creates before add_tag, notes/tags before noteTags
- `clientMutationId` for idempotent server upserts
- `getPendingSyncQueue()` with FIFO + dependency ordering

**Enhanced Hooks:**
- `useNetworkStatus` now returns `isOnline` + `onReconnect` callback
- `useSyncStatus` tracks pending operations count

### Phase 3 Summary (Complete)
**New Files:**
- `src/services/syncEngine.ts` - Core sync logic with retry and conflict detection
- `src/hooks/useSyncEngine.ts` - React hook for sync state management

**Sync Engine Features:**
- Process queue with dependency ordering (creates first, notes before noteTags)
- Self-ignore for realtime: track `pendingMutations` Set, skip matching events
- Conflict detection: compare `localUpdatedAt` vs `serverUpdatedAt` vs `lastSyncedAt`
- Pull remote changes before pushing (get latest server state)
- Retry logic: 5 attempts max, skip 4xx errors, retry 5xx/network errors
- Idempotent operations (check existence before create)

**useSyncEngine Hook:**
- Sync on reconnect via `onReconnect` callback
- Initial sync 2 seconds after hydration
- Periodic sync every 30 seconds while online
- Track: `pendingCount`, `conflicts`, `lastResult`, `lastSyncAt`
- `resolveConflict()` for 'local', 'server', or 'both' resolution

---

## Review Log

- 2026-01-07 - Codex (GPT-5): Added review findings, recommendations, and open questions for offline architecture and UX.
- 2026-01-07 - User: Approved decisions on open questions. Plan status → Approved.
- 2026-01-07 - Implementation: Phases 0-3 completed. All 455 tests passing.

---

## Technology Decision: Dexie.js over PowerSync

| Factor | Dexie.js (Chosen) | PowerSync |
|--------|-------------------|-----------|
| Storage | Native IndexedDB (fast) | WASM-SQLite (slower) |
| Cost | Free forever (MIT) | Free tier deactivates after 1 week inactive |
| Bundle | ~29KB | ~100KB+ |
| Control | Full control over sync/UX | Server-side rules |
| Track Record | WhatsApp Web, Microsoft To Do | Newer |

PowerSync's free tier inactivity clause is problematic for a "calm" app where users may not open it for weeks.

---

## Architecture

```
User Action → IndexedDB → UI Updates Immediately
                  ↓
            Sync Queue Entry
                  ↓
         ┌─────────────────────┐
         │   Network Check     │
         │   Online? → Sync    │
         │   Offline? → Queue  │
         └─────────────────────┘
```

**Key Principle:** IndexedDB is the source of truth for the UI. Supabase is the source of truth for persistence. Sync engine reconciles the two.

---

## Data Model (IndexedDB via Dexie.js)

```typescript
// src/lib/offlineDb.ts
// Database name: `zenote-offline-${userId}` (per-user isolation)
class ZenoteDB extends Dexie {
  notes: Table<LocalNote>         // Notes with sync tracking
  tags: Table<LocalTag>           // Tags with sync tracking
  noteTags: Table<LocalNoteTag>   // Junction table
  syncQueue: Table<SyncQueueEntry> // Pending operations
  conflicts: Table<ConflictRecord> // Unresolved conflicts
  pendingMutations: Table<string>  // clientMutationIds awaiting server confirm
}

// Enhanced types for conflict detection
interface LocalNote {
  id: string                    // UUID (local or server-generated)
  // ... note fields ...
  syncStatus: SyncStatus
  lastSyncedAt: number | null   // Timestamp of last successful sync
  serverUpdatedAt: number | null // Server's updated_at from last sync
  localUpdatedAt: number        // Local modification timestamp
}

interface SyncQueueEntry {
  id: string                    // Auto-increment
  clientMutationId: string      // UUID for idempotency
  operation: SyncOperation      // 'create' | 'update' | 'delete' | etc.
  entityType: 'note' | 'tag' | 'noteTag'
  entityId: string
  payload: unknown
  createdAt: number
  retryCount: number
}
```

**Sync Status:** `'synced' | 'pending' | 'conflict'`

---

## New Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/offlineDb.ts` | Dexie database schema (per-user naming) | ✅ Created |
| `src/services/offlineNotes.ts` | Offline-aware note CRUD | ✅ Created |
| `src/services/offlineTags.ts` | Offline-aware tag ops | ✅ Created |
| `src/hooks/useSyncStatus.ts` | Sync state for UI | ✅ Created |
| `src/services/syncEngine.ts` | Queue processor, conflict detection, mutation tracking | ✅ Created |
| `src/hooks/useSyncEngine.ts` | React hook for sync engine lifecycle | ✅ Created |
| `src/components/SyncIndicator.tsx` | Subtle offline indicator (accessible, SVG icons) | ⏳ Phase 5 |
| `src/components/ConflictModal.tsx` | "Two Paths" conflict UI (respects prefers-reduced-motion) | ⏳ Phase 4 |
| `src/lib/offlineDb.test.ts` | Unit tests for IndexedDB operations | ⏳ Phase 5 |
| `src/services/syncEngine.test.ts` | Unit tests for sync engine | ⏳ Phase 5 |

## Files Modified

| File | Changes | Status |
|------|---------|--------|
| `index.html` | Add `viewport-fit=cover` for iOS safe areas | ✅ Done |
| `src/index.css` | Add safe area padding, `user-select: none` for UI elements | ✅ Done |
| `package.json` | Add `dexie`, `dexie-react-hooks`, `vite-plugin-pwa` | ✅ Done |
| `vite.config.ts` | Add VitePWA config with `navigateFallback` | ✅ Done |
| `src/contexts/AuthContext.tsx` | Hydrate on login, clear on logout, expose `isHydrating` | ✅ Done |
| `src/hooks/useNetworkStatus.ts` | Return `isOnline`, `onReconnect` callback | ✅ Done |
| `src/App.tsx` | Initialize offline DB, add sync engine | ⏳ Phase 3 |
| `src/components/Editor.tsx` | Use offline save, show sync status | ⏳ Phase 3 |
| `src/components/NoteCard.tsx` | Show ink dot for pending sync | ⏳ Phase 5 |
| `src/components/Header.tsx` | Add SyncIndicator | ⏳ Phase 5 |

---

## Implementation Phases

### Phase 0: PWA Foundation (Day 1)
Mobile-native feel before offline logic.

- **iOS Safe Areas**: Add `viewport-fit=cover` to index.html, use `env(safe-area-inset-*)` in CSS
- **Touch Feel**: Add `user-select: none` to buttons/nav, verify no 300ms tap delay
- **Keyboard Handling**: Ensure editor scrolls when software keyboard appears
- **Verify PWA**: Test "Add to Home Screen" on iOS Safari and Android Chrome
- **Deliverable:** App feels native on mobile, ready for offline features

### Phase 1: IndexedDB Foundation + Service Worker (Days 2-4)
- Install Dexie.js + dexie-react-hooks + vite-plugin-pwa
- Configure service worker for app shell caching (full offline-first)
- Create database schema with per-user naming (`zenote-offline-${userId}`)
- Create offline notes service (`offlineNotes.ts`)
- Hydrate IndexedDB from Supabase on auth
- Wipe IndexedDB on logout (`db.delete()`)
- **Deliverable:** Notes persist locally, app loads offline after hard refresh

### Phase 2: Offline Writes (Days 5-7)
- Implement sync queue with `clientMutationId` for idempotency
- All writes go to IndexedDB first, update `localUpdatedAt`
- Queue operations for later sync with dependency ordering
- Queue compaction: merge consecutive updates to same entity
- Handle offline note creation (local UUIDs via `crypto.randomUUID()`)
- **Deliverable:** Can create/edit notes offline

### Phase 3: Sync Engine (Days 8-11)
- Network-triggered sync via `useNetworkStatus`
- Reconnect ordering: pull remote delta → apply to IDB → replay queue
- FIFO queue processing with retry (exponential backoff)
- Self-ignore for realtime: track pendingMutations, skip matching events
- Update `lastSyncedAt` and `serverUpdatedAt` after successful sync
- **Deliverable:** Notes sync automatically on reconnect

### Phase 4: Conflict Resolution (Days 12-14)
- Detect conflicts (local vs server edits)
- Build "Two Paths" conflict modal
- Options: Keep local / Keep server / Keep both
- Kintsugi animation on resolution
- **Deliverable:** Concurrent edits handled gracefully

### Phase 5: UI Polish (Days 15-16)
- SVG cloud icon when offline (accessible, screen-reader text)
- Ink dot on notes with pending changes
- "Saved locally" vs "Synced" status in editor
- Respect `prefers-reduced-motion` for animations
- Unit tests for sync engine edge cases
- Testing and bug fixes
- **Deliverable:** Complete zen offline experience

---

## Conflict Resolution

**Detection:** When syncing, compare timestamps:
- If `localUpdatedAt > lastSyncedAt` AND `serverUpdatedAt > lastSyncedAt` → conflict
- This approach handles clock skew better than direct timestamp comparison

**Resolution UI (Zen-style):**
```
Two versions of this thought exist.
Which feels truer?

[Local version]     [Server version]
   [Keep this]         [Keep this]

         [Keep both as separate notes]
```

**Auto-resolve:** Tags and pin status use last-write-wins (no modal).

---

## Sync Queue Operations

| Operation | Entity | Notes |
|-----------|--------|-------|
| `create` | note, tag | Offline-created with local UUID |
| `update` | note, tag | Content/metadata changes |
| `delete` | note, tag | Hard delete |
| `soft_delete` | note | Move to Faded Notes |
| `restore` | note | Restore from Faded Notes |
| `pin` | note | Toggle pin status |
| `add_tag` | note_tag | Assign tag to note |
| `remove_tag` | note_tag | Remove tag from note |

---

## Testing Strategy

**Unit Tests (Vitest):**
```typescript
// src/lib/offlineDb.test.ts
test('creates per-user database with correct name')
test('wipes database on logout')
test('handles schema migrations')

// src/services/syncEngine.test.ts
test('queue compaction merges consecutive updates')
test('dependency ordering: notes before noteTags')
test('conflict detection with lastSyncedAt')
test('retry with exponential backoff')
test('self-ignore matches pending mutations')
```

**E2E Tests:**
```typescript
// e2e/offline.spec.ts
test('create note while offline, syncs on reconnect')
test('edit note offline, changes persist')
test('conflict resolution with two paths modal')
test('tag operations sync correctly')
test('app loads after hard refresh with no network')
```

**Manual Testing:**
- [ ] Create note offline → verify sync
- [ ] Edit same note on two devices → trigger conflict
- [ ] Large queue (10+ ops) → verify order preserved
- [ ] Logout clears IndexedDB → no data leakage
- [ ] Hard refresh with no network → app loads from cache

---

## Key Decisions

1. **Dexie.js** over raw IndexedDB (type-safe, simpler API)
2. **Queue-based sync** over immediate sync (reliable, orderly)
3. **User choice for conflicts** over auto-merge (respects user intent)
4. **Ink dot indicator** over sync badge (zen aesthetic)
5. **Last-write-wins for tags** (simpler, less disruptive)

---

## Review Findings (Codex)

- High: Conflict detection relies only on `updatedAt` vs `updated_at`, which risks false conflicts or data loss with clock skew and rapid edits; needs a last-synced marker.
- High: Realtime subscription integration lacks a clear strategy to ignore self-originated changes or reconcile with the local queue, risking duplicate writes or oscillation.
- High: IndexedDB per-user scoping and wipe-on-auth-change are not specified beyond a manual test note, which risks data leakage on shared devices.
- Medium: Queue operations lack idempotency, compaction, and dependency ordering (note/tag before note_tag), which can cause duplicates or ordering errors after retries.
- Medium: "Full offline" does not include an app-shell caching plan; reloads or first-load offline will fail without a service worker.
- Medium: Testing is E2E-only with no unit/integration coverage for sync engine edge cases (retry, conflicts, clock skew).

---

## Recommendations (Codex)

- Keep Dexie, but add per-user DB naming, schema versioning, and indexes; track `lastSyncedAt`, `serverUpdatedAt`, and a `clientMutationId` for idempotent upserts and queue compaction.
- Define reconnect ordering: pull remote delta -> apply to IndexedDB -> replay queue; ignore self-originated realtime events via mutation IDs or local op log.
- Clarify offline scope (offline-after-first-load vs offline-on-hard-refresh); if the latter, add a service worker (Workbox/Vite PWA) to cache the app shell.
- Design: replace placeholder glyphs with real icons, add accessible offline status text, and respect `prefers-reduced-motion` for conflict animation.

---

## Decisions (User Approved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Offline scope | **Full offline-first** | App works after hard refresh with no network. Requires service worker for app shell caching. |
| Security | **Logout wipe sufficient** | No local encryption needed. IndexedDB cleared on logout. Per-user DB naming prevents cross-user data access. |
| Conflict UI | **Note-level only** | Keep current "Two Paths" modal design. Rich Tiptap diffing would add complexity without proportional value for a "calm" app. |

---

## Response to Codex Findings

### High Priority

**1. Conflict detection needs last-synced marker**
- Add `lastSyncedAt` and `serverUpdatedAt` fields to LocalNote/LocalTag types
- Add `clientMutationId` (UUID) to each sync queue entry for idempotency
- Conflict detection: `localUpdatedAt > lastSyncedAt AND serverUpdatedAt > lastSyncedAt`

**2. Realtime subscription self-ignore**
- Track pending `clientMutationId` values in a Set
- When realtime event arrives, check if its mutation ID matches our pending ops
- If match: ignore (we already applied locally), remove from pending set
- If no match: apply server change to IndexedDB

**3. Per-user IndexedDB scoping**
- Database name: `zenote-offline-${userId}`
- On logout: call `db.delete()` to wipe all user data
- On login: create/open user-specific database
- Schema versioning: Dexie handles via version() method

### Medium Priority

**4. Queue idempotency and ordering**
- Each queue entry gets `clientMutationId` for idempotent server upserts
- Queue compaction: consecutive updates to same entity → keep latest only
- Dependency ordering: process `create` ops before `add_tag` ops (topological sort by entity type)

**5. Service worker for full offline-first**
- Add `vite-plugin-pwa` for Workbox integration
- Cache app shell (HTML, CSS, JS, fonts) for offline hard refresh
- Network-first strategy for API calls, cache-first for static assets

**6. Unit/integration tests for sync engine**
- Add Vitest tests for sync engine edge cases:
  - `syncEngine.test.ts`: queue processing, retry logic, conflict detection
  - `offlineDb.test.ts`: schema migrations, per-user isolation
  - Mock network conditions with `vi.mock()`

---

## Dependencies

```json
{
  "dependencies": {
    "dexie": "^4.0.0",
    "dexie-react-hooks": "^1.1.7"
  },
  "devDependencies": {
    "vite-plugin-pwa": "^0.21.0"
  }
}
```

---

## Critical Files Reference

- `src/services/notes.ts` - Current CRUD to wrap
- `src/App.tsx` - State management, subscriptions (lines 170-420)
- `src/components/Editor.tsx` - Save flow (lines 65-159)
- `src/hooks/useNetworkStatus.ts` - Network detection
- `src/utils/withRetry.ts` - Retry logic to reuse

---

## Related Documents

- [Offline Support Design](../analysis/offline-support-design-claude.md) - Zen philosophy for offline UX
- [Mobile Strategy Analysis](../analysis/mobile-strategy-analysis-claude.md) - PWA vs native decision
- [Strategic Viability Review](../active/strategic-viability-review-claude.md) - Offline as P0 blocker
