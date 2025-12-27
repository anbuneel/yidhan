# Zenote Automated Testing Implementation Plan

**Author:** Claude (Opus 4.5)
**Date:** 2025-12-27
**Status:** In Progress (Phase 1 Complete)

---

## Overview
Implement comprehensive automated testing to enable safe feature development and regression prevention.

**Current State:** 4 test files, 43 tests, ~4% coverage
**Target State:** ~270 tests (unit + integration + E2E), >75% coverage on critical paths

**Approach:** Incremental PRs after each phase for easier review

---

## Phase 1: Foundation & Infrastructure (Day 1)

### 1.1 Create Test Utilities & Mocks

**File: `src/test/mocks/supabase.ts`**
```typescript
// Comprehensive Supabase mock for all service tests
export const mockSupabaseClient = {
  from: vi.fn(),
  auth: { ... },
  channel: vi.fn(),
  removeChannel: vi.fn(),
};
```

**File: `src/test/factories.ts`**
```typescript
// Test data factories
export function createMockNote(overrides?: Partial<Note>): Note
export function createMockTag(overrides?: Partial<Tag>): Tag
export function createMockUser(overrides?: Partial<User>): User
```

**File: `src/test/test-utils.tsx`**
```typescript
// Render helper with providers
export function renderWithProviders(ui: ReactElement)
```

### 1.2 Update Test Setup

**File: `src/test/setup.ts`** (modify existing)
- Add global mocks for localStorage, clipboard, window.location
- Import Supabase mock

---

## Phase 2: Utility Function Tests (Days 1-2)

### 2.1 temporalGrouping.test.ts (~25 tests)
**File: `src/utils/temporalGrouping.test.ts`**

| Test Group | Tests |
|------------|-------|
| `getChapterForDate` | 6 tests - thisWeek, lastWeek, thisMonth, earlier, archive, pinned |
| `groupNotesByChapter` | 8 tests - empty, single, multiple chapters, pinned first |
| `getDefaultExpansionState` | 6 tests - <20, 20-49, 50-99, 100+ notes |
| `getChapterLabel` | 5 tests - all chapter types |

### 2.2 exportImport.test.ts (~50 tests)
**File: `src/utils/exportImport.test.ts`**

| Test Group | Tests |
|------------|-------|
| `exportNotesToJSON` | 5 tests - structure, metadata, tags |
| `parseImportedJSON` | 12 tests - valid, invalid, missing fields, too many notes |
| `htmlToMarkdown` | 8 tests - headings, lists, links, code, task lists |
| `markdownToHtml` | 8 tests - reverse conversion |
| `parseMultiNoteMarkdown` | 6 tests - single, multiple, with tags |
| `copyNoteToClipboard` | 4 tests - plain text format |
| `copyNoteWithFormatting` | 4 tests - HTML format |
| `getSanitizedFilename` | 3 tests - special chars, length |

---

## Phase 3: Service Layer Tests (Days 2-4)

### 3.1 tags.test.ts (~30 tests)
**File: `src/services/tags.test.ts`**

| Test Group | Tests |
|------------|-------|
| `validateTagName` | 5 tests - empty, too long, valid, whitespace |
| `createTag` | 4 tests - success, duplicate, validation error |
| `fetchTags` | 3 tests - empty, multiple, ordered |
| `updateTag` | 4 tests - name, color, both, not found |
| `deleteTag` | 3 tests - success, not found, cascade |
| `addTagToNote` | 4 tests - success, duplicate (ignored), not found |
| `removeTagFromNote` | 3 tests - success, not found |
| `getNoteTags` | 4 tests - empty, multiple, ordered |

### 3.2 notes.test.ts (~60 tests)
**File: `src/services/notes.test.ts`**

| Test Group | Tests |
|------------|-------|
| `createNote` | 5 tests - basic, with tags, with options |
| `createNotesBatch` | 6 tests - empty, single, batch >500, progress callback |
| `fetchNotes` | 8 tests - empty, multiple, exclude deleted, tag filter AND logic |
| `updateNote` | 4 tests - title, content, timestamp updated |
| `searchNotes` | 5 tests - title match, content match, case insensitive, no deleted |
| `softDeleteNote` | 3 tests - sets deleted_at, already deleted |
| `restoreNote` | 3 tests - clears deleted_at, not found |
| `permanentDeleteNote` | 3 tests - hard delete, not found |
| `toggleNotePin` | 3 tests - pin, unpin, not found |
| `fetchFadedNotes` | 3 tests - only deleted, ordered by deleted_at |
| `countFadedNotes` | 2 tests - count, empty |
| `emptyFadedNotes` | 2 tests - delete all, empty |
| `cleanupExpiredFadedNotes` | 3 tests - >30 days deleted, <30 days kept |
| `createNoteShare` | 4 tests - with expiry, without, token generated |
| `getNoteShare` | 3 tests - exists, not found, expired |
| `deleteNoteShare` | 2 tests - revoke, not found |
| `fetchSharedNote` | 4 tests - valid, expired, not found, deleted note |

---

## Phase 4: Component Tests (Days 4-6)

### 4.1 TagModal.test.tsx (~12 tests)
**File: `src/components/TagModal.test.tsx`**

- Create tag with valid name
- Create tag validation errors (empty, too long)
- Edit tag name and color
- Delete tag with confirmation
- Loading states during async operations
- Cancel/close behavior

### 4.2 Editor.test.tsx (~15 tests)
**File: `src/components/Editor.test.tsx`**

- Renders with note title and content
- Auto-save triggers after 1.5s debounce
- Save status transitions (idle -> saving -> saved)
- Delete button shows confirmation
- Escape key saves and exits
- New note focuses title
- Existing note focuses content end

### 4.3 ShareModal.test.tsx (~10 tests)
**File: `src/components/ShareModal.test.tsx`**

- Create share with different expirations
- Copy link to clipboard
- Update expiration
- Revoke share
- Loading and error states

### 4.4 ChapteredLibrary.test.tsx (~8 tests)
**File: `src/components/ChapteredLibrary.test.tsx`**

- Renders chapters with correct grouping
- Collapse/expand chapters
- Empty state when no notes
- Pinned section always first

---

## Phase 5: Auth & Integration Tests (Days 6-7)

### 5.1 Auth.test.tsx (~20 tests)
**File: `src/components/Auth.test.tsx`**

| Test Group | Tests |
|------------|-------|
| Login mode | 4 tests - success, invalid creds, loading, error display |
| Signup mode | 5 tests - success, validation, existing user, email confirm |
| Forgot password | 3 tests - send email, invalid email, cooldown |
| Password reset | 3 tests - update success, mismatch, validation |
| OAuth buttons | 3 tests - Google click, GitHub click, loading states |
| Modal close | 2 tests - dirty form confirmation, clean close |

### 5.2 useNetworkStatus.test.ts (~8 tests)
**File: `src/hooks/useNetworkStatus.test.ts`**

- Initial online state
- Offline event shows toast
- Online event shows toast (was offline)
- Cleanup removes listeners

---

## Phase 6: E2E Tests with Playwright (Days 8-9)

### 6.1 Playwright Setup
**File: `playwright.config.ts`**
- Configure for local dev server
- Set up screenshot on failure
- Configure retry strategy

**File: `e2e/fixtures.ts`**
- Test user creation helper
- Login helper
- Note creation helper

### 6.2 Critical User Journey Tests
**Directory: `e2e/`**

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `auth.spec.ts` | 6 | Signup, login, logout, password reset |
| `notes.spec.ts` | 8 | Create, edit, delete, restore, pin, search |
| `tags.spec.ts` | 5 | Create, edit, delete, filter notes by tag |
| `sharing.spec.ts` | 4 | Create share, view shared, revoke |
| `export-import.spec.ts` | 4 | Export JSON, Markdown, import back |
| `settings.spec.ts` | 3 | Update profile, change theme, offboarding |

**Total: ~30 E2E tests**

---

## Implementation Order

```
Day 1 (PR 1): ✅ COMPLETE
  [x] 1.1 Create test utilities & mocks
  [x] 1.2 Update test setup
  [x] 2.1 temporalGrouping.test.ts (35 tests)
  → PR #XX

Day 2 (PR 2):
  [ ] 2.2 exportImport.test.ts
  → Commit & PR

Day 3-4 (PR 3):
  [ ] 3.1 tags.test.ts
  [ ] 3.2 notes.test.ts
  → Commit & PR

Day 5-6 (PR 4):
  [ ] 4.1 TagModal.test.tsx
  [ ] 4.2 Editor.test.tsx
  [ ] 4.3 ShareModal.test.tsx
  [ ] 4.4 ChapteredLibrary.test.tsx
  → Commit & PR

Day 7 (PR 5):
  [ ] 5.1 Auth.test.tsx
  [ ] 5.2 useNetworkStatus.test.ts
  [ ] Coverage config
  → Commit & PR

Day 8-9 (PR 6):
  [ ] 6.1 Playwright setup
  [ ] 6.2 E2E test files
  → Commit & PR
```

---

## Files to Create

| File | Type | Tests | Status |
|------|------|-------|--------|
| `src/test/mocks/supabase.ts` | Mock | - | ✅ |
| `src/test/factories.ts` | Factory | - | ✅ |
| `src/test/test-utils.tsx` | Utility | - | ✅ |
| `src/utils/temporalGrouping.test.ts` | Unit | 35 | ✅ |
| `src/utils/exportImport.test.ts` | Unit | 50 | |
| `src/services/tags.test.ts` | Unit | 30 | |
| `src/services/notes.test.ts` | Unit | 60 | |
| `src/components/TagModal.test.tsx` | Integration | 12 | |
| `src/components/Editor.test.tsx` | Integration | 15 | |
| `src/components/ShareModal.test.tsx` | Integration | 10 | |
| `src/components/ChapteredLibrary.test.tsx` | Integration | 8 | |
| `src/components/Auth.test.tsx` | Integration | 20 | |
| `src/hooks/useNetworkStatus.test.ts` | Unit | 8 | |
| `playwright.config.ts` | Config | - | |
| `e2e/fixtures.ts` | E2E Helper | - | |
| `e2e/auth.spec.ts` | E2E | 6 | |
| `e2e/notes.spec.ts` | E2E | 8 | |
| `e2e/tags.spec.ts` | E2E | 5 | |
| `e2e/sharing.spec.ts` | E2E | 4 | |
| `e2e/export-import.spec.ts` | E2E | 4 | |
| `e2e/settings.spec.ts` | E2E | 3 | |

**Total: 21 new files, ~268 new tests**
**Progress: 4 files created, 35 tests written**

---

## Files to Modify

| File | Change | Status |
|------|--------|--------|
| `src/test/setup.ts` | Add global mocks | ✅ |
| `package.json` | Add coverage script, Playwright dep | |
| `vite.config.ts` | Add coverage thresholds | |

---

## PR Structure (Incremental)

| PR | Phase | Tests Added | Description | Status |
|----|-------|-------------|-------------|--------|
| PR 1 | 1 + 2.1 | 35 | Test infrastructure + temporalGrouping | ✅ |
| PR 2 | 2.2 | ~50 | exportImport tests | |
| PR 3 | 3 | ~90 | Service layer tests (tags + notes) | |
| PR 4 | 4 | ~45 | Component tests | |
| PR 5 | 5 | ~28 | Auth + hooks tests | |
| PR 6 | 6 | ~30 | E2E tests with Playwright | |

---

## Success Criteria

- [ ] All 270+ tests pass
- [ ] Coverage >75% on services and utilities
- [ ] Coverage >60% on components
- [ ] E2E tests cover all critical user journeys
- [ ] `npm run check` passes
- [ ] No flaky tests
- [ ] CI runs tests on every PR

---

## Related Documents

- Analysis: `docs/analysis/testing-strategy-claude.md`
