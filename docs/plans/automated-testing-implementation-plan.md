# Zenote Automated Testing Implementation Plan

**Author:** Claude (Opus 4.5)
**Date:** 2025-12-27
**Status:** In Progress (Phase 6 Complete)

---

## Overview
Implement comprehensive automated testing to enable safe feature development and regression prevention.

**Current State:** 15 test files, 439 tests
**Target State:** ~450 tests (unit + integration + E2E), >75% coverage on critical paths

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
  → PR #33

Day 2 (PR 2): ✅ COMPLETE
  [x] 2.2 exportImport.test.ts (94 tests)
  → PR #34

Day 3-4 (PR 3): ✅ COMPLETE
  [x] 3.1 tags.test.ts (34 tests)
  [x] 3.2 notes.test.ts (107 tests)
  → PR #35

Day 5-6 (PR 4): ✅ COMPLETE
  [x] 4.1 TagModal.test.tsx (27 tests)
  [x] 4.2 Editor.test.tsx (29 tests)
  [x] 4.3 ShareModal.test.tsx (22 tests)
  [x] 4.4 HeaderShell.test.tsx (22 tests)
  [x] 4.5 Auth.test.tsx (43 tests) - moved from Phase 5
  → PR #36

Day 7 (PR 5): ✅ COMPLETE
  [x] 5.1 ChapteredLibrary.test.tsx (17 tests)
  [x] 5.2 useNetworkStatus.test.ts (9 tests)
  → PR #37

Day 8-9 (PR 6): ✅ COMPLETE
  [x] 6.1 Playwright setup
  [x] 6.2 E2E test files
  → PR #38
```

---

## Files to Create

| File | Type | Tests | Status |
|------|------|-------|--------|
| `src/test/mocks/supabase.ts` | Mock | - | ✅ |
| `src/test/factories.ts` | Factory | - | ✅ |
| `src/test/test-utils.tsx` | Utility | - | ✅ |
| `src/utils/temporalGrouping.test.ts` | Unit | 35 | ✅ |
| `src/utils/exportImport.test.ts` | Unit | 94 | ✅ |
| `src/services/tags.test.ts` | Unit | 34 | ✅ |
| `src/services/notes.test.ts` | Unit | 107 | ✅ |
| `src/components/TagModal.test.tsx` | Integration | 27 | ✅ |
| `src/components/Editor.test.tsx` | Integration | 29 | ✅ |
| `src/components/ShareModal.test.tsx` | Integration | 22 | ✅ |
| `src/components/HeaderShell.test.tsx` | Integration | 22 | ✅ |
| `src/components/Auth.test.tsx` | Integration | 43 | ✅ |
| `src/components/ChapteredLibrary.test.tsx` | Integration | 17 | ✅ |
| `src/hooks/useNetworkStatus.test.ts` | Unit | 9 | ✅ |
| `playwright.config.ts` | Config | - | ✅ |
| `e2e/fixtures.ts` | E2E Helper | - | ✅ |
| `e2e/auth.spec.ts` | E2E | 20 | ✅ |
| `e2e/notes.spec.ts` | E2E | 22 | ✅ |
| `e2e/tags.spec.ts` | E2E | 16 | ✅ |
| `e2e/sharing.spec.ts` | E2E | 9 | ✅ |
| `e2e/export-import.spec.ts` | E2E | 9 | ✅ |
| `e2e/settings.spec.ts` | E2E | 10 | ✅ |

**Total: 22 new files, ~525 tests**
**Progress: 22 files created, 439 unit tests + 86 E2E tests written**

---

## Files to Modify

| File | Change | Status |
|------|--------|--------|
| `src/test/setup.ts` | Add global mocks | ✅ |
| `package.json` | Add E2E scripts, Playwright dep | ✅ |
| `.gitignore` | Add Playwright artifacts | ✅ |
| `eslint.config.js` | Disable React hooks rules for e2e/ | ✅ |
| `vite.config.ts` | Add coverage thresholds | |

---

## PR Structure (Incremental)

| PR | Phase | Tests Added | Description | Status |
|----|-------|-------------|-------------|--------|
| PR #33 | 1 + 2.1 | 35 | Test infrastructure + temporalGrouping | ✅ |
| PR #34 | 2.2 | 94 | exportImport tests | ✅ |
| PR #35 | 3 | 141 | Service layer tests (tags + notes) | ✅ |
| PR #36 | 4 | 143 | Component integration tests | ✅ |
| PR #37 | 5 | 26 | ChapteredLibrary + hooks tests | ✅ |
| PR #38 | 6 | 86 | E2E tests with Playwright | ✅ |

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

## Progress Log

### Phase 1: Foundation & Infrastructure (Complete)

**PR:** [#33](https://github.com/anbuneel/zenote/pull/33)
**Branch:** `feature/phase1-test-infrastructure`
**Tests:** 78 total (35 new + 43 existing)

#### Files Created
| File | Description |
|------|-------------|
| `src/test/mocks/supabase.ts` | Chainable Supabase query mocks, auth mocks, channel mocks |
| `src/test/factories.ts` | Test data factories (Note, Tag, User, Session, NoteShare) |
| `src/test/test-utils.tsx` | Render helpers with MockAuthProvider |
| `src/utils/temporalGrouping.test.ts` | 35 tests for temporal grouping utilities |

#### Files Modified
| File | Change |
|------|--------|
| `src/test/setup.ts` | Added global mocks (localStorage, clipboard, matchMedia, IntersectionObserver, ResizeObserver) |

#### Test Coverage
| Function | Tests |
|----------|-------|
| `getChapterForDate` | 10 |
| `groupNotesByChapter` | 8 |
| `getDefaultExpansionState` | 6 |
| `getChapterLabel` | 6 |
| Helper functions | 5 |

### Phase 2: Export/Import Tests (Complete)

**PR:** [#34](https://github.com/anbuneel/zenote/pull/34)
**Branch:** `feature/phase2-export-import-tests`
**Tests:** 163 total (85 new + 78 existing)

#### Files Created
| File | Description |
|------|-------------|
| `src/utils/exportImport.test.ts` | 85 tests for export/import utilities |

#### Test Coverage
| Function/Group | Tests |
|----------------|-------|
| `ValidationError` | 2 |
| `exportNotesToJSON` | 5 |
| `parseImportedJSON` | 16 |
| `htmlToMarkdown` | 14 |
| `markdownToHtml` | 11 |
| `parseMultiNoteMarkdown` | 7 |
| `exportNoteToJSON` | 2 |
| `exportNoteToMarkdown` | 4 |
| `getSanitizedFilename` | 6 |
| `formatNoteForClipboard` | 4 |
| `formatNoteForClipboardHtml` | 3 |
| `htmlToPlainText` | 6 |
| `copyNoteToClipboard` | 1 |
| `copyNoteWithFormatting` | 1 |
| `downloadFile` | 1 |
| Constants | 3 |

### Phase 3: Service Layer Tests (Complete)

**PR:** [#35](https://github.com/anbuneel/zenote/pull/35)
**Branch:** `feature/phase3-service-tests`
**Tests:** 270 total (141 new + 129 existing)

#### Files Created
| File | Description |
|------|-------------|
| `src/services/tags.test.ts` | 34 tests for tag CRUD operations |
| `src/services/notes.test.ts` | 107 tests for note CRUD, soft-delete, shares |

#### Test Coverage
| Service Function | Tests |
|------------------|-------|
| `fetchTags` | 4 |
| `createTag` | 5 |
| `updateTag` | 5 |
| `deleteTag` | 3 |
| `addTagToNote` | 5 |
| `removeTagFromNote` | 3 |
| `getNoteTags` | 4 |
| `validateTagName` | 5 |
| `fetchNotes` | 8 |
| `createNote` | 5 |
| `createNotesBatch` | 6 |
| `updateNote` | 5 |
| `softDeleteNote` | 3 |
| `restoreNote` | 3 |
| `permanentDeleteNote` | 3 |
| `toggleNotePin` | 4 |
| `searchNotes` | 5 |
| `fetchFadedNotes` | 4 |
| `countFadedNotes` | 3 |
| `emptyFadedNotes` | 3 |
| `cleanupExpiredFadedNotes` | 3 |
| `createNoteShare` | 5 |
| `getNoteShare` | 4 |
| `updateNoteShareExpiration` | 4 |
| `deleteNoteShare` | 3 |
| `fetchSharedNote` | 5 |

### Phase 4: Component Integration Tests (Complete)

**PR:** [#36](https://github.com/anbuneel/zenote/pull/36)
**Branch:** `feature/phase4-component-tests`
**Tests:** 413 total (143 new + 270 existing)

#### Files Created
| File | Description |
|------|-------------|
| `src/components/TagModal.test.tsx` | 27 tests for tag modal form and CRUD |
| `src/components/ShareModal.test.tsx` | 22 tests for share link management |
| `src/components/HeaderShell.test.tsx` | 22 tests for header layout and auth states |
| `src/components/Editor.test.tsx` | 29 tests for note editing and auto-save |
| `src/components/Auth.test.tsx` | 43 tests for authentication flows |

#### Test Coverage
| Component | Test Groups |
|-----------|-------------|
| TagModal | Rendering, form validation, color selection, save/delete operations, modal interactions |
| ShareModal | Share creation, clipboard copy, expiration updates, revoke, modal interactions |
| HeaderShell | Rendering, theme toggle, unauthenticated/authenticated states, initials extraction |
| Editor | Rendering, title editing, auto-save, delete confirmation, export menu, navigation, keyboard shortcuts, save status |
| Auth | Rendering modes, mode switching, login/signup/forgot/reset flows, OAuth buttons, theme toggle, modal mode, error sanitization |

#### Key Testing Patterns
- Mocking complex child components for focused unit testing
- `vi.useFakeTimers` for testing debounced auto-save behavior
- `vi.spyOn(navigator.clipboard, 'writeText')` for clipboard API
- Password input selection by type (`input[type="password"]`) when labels lack `htmlFor`
- React Testing Library `userEvent` for realistic user interactions

---

## Related Documents

- Analysis: `docs/analysis/testing-strategy-claude.md`
- Testing Infrastructure: `docs/analysis/testing-infrastructure-claude.md`

---

## Progress Log (cont.)

### Phase 5: Remaining Component & Hook Tests (Complete)

**PR:** [#37](https://github.com/anbuneel/zenote/pull/37)
**Branch:** `feature/phase5-remaining-tests`
**Tests:** 439 total (26 new + 413 existing)

#### Files Created
| File | Description |
|------|-------------|
| `src/components/ChapteredLibrary.test.tsx` | 17 tests for temporal chapter grouping component |
| `src/hooks/useNetworkStatus.test.ts` | 9 tests for network connectivity hook |

#### Test Coverage
| Component/Hook | Test Groups |
|----------------|-------------|
| ChapteredLibrary | Empty states (6), with notes (9), chapter grouping (2) |
| useNetworkStatus | Event listeners (2), online/offline toasts (5), state transitions (2) |

#### Key Testing Patterns
- Mocking child components (ChapterSection, ChapterNav, TimeRibbon) for focused testing
- `vi.mock()` for module-level mocking before imports
- `window.dispatchEvent(new Event('offline'))` for network event simulation
- `vi.spyOn(window, 'addEventListener')` for listener verification
- IntersectionObserver implicitly tested via global mock in test/setup.ts

### Phase 6: E2E Tests with Playwright (Complete)

**PR:** [#38](https://github.com/anbuneel/zenote/pull/38)
**Branch:** `feature/phase6-e2e-tests`
**Tests:** 86 E2E tests

#### Files Created
| File | Description |
|------|-------------|
| `playwright.config.ts` | Playwright configuration with webServer, browsers, and retry settings |
| `e2e/fixtures.ts` | Test fixtures (authenticatedPage) and reusable helper functions |
| `e2e/auth.spec.ts` | 20 tests for authentication flows (login, signup, forgot password, OAuth) |
| `e2e/notes.spec.ts` | 22 tests for note CRUD, search, pinning, faded notes |
| `e2e/tags.spec.ts` | 16 tests for tag creation, editing, deletion, filtering, assignment |
| `e2e/sharing.spec.ts` | 9 tests for share link creation, viewing, and revocation |
| `e2e/export-import.spec.ts` | 9 tests for export (JSON, Markdown) and import functionality |
| `e2e/settings.spec.ts` | 10 tests for settings modal, profile, password, theme, offboarding |

#### Files Modified
| File | Change |
|------|--------|
| `package.json` | Added E2E scripts (e2e, e2e:ui, e2e:headed, e2e:report) |
| `.gitignore` | Added Playwright artifacts (test-results/, playwright-report/, etc.) |
| `eslint.config.js` | Disabled React hooks rules for e2e/ directory |

#### Test Coverage by Feature
| Feature | Tests |
|---------|-------|
| Landing Page | 4 |
| Login Flow | 5 |
| Signup Flow | 5 |
| Forgot Password | 3 |
| Auth Modal Behavior | 3 |
| Note Creation | 4 |
| Note Editing | 5 |
| Note Deletion | 3 |
| Note Search | 5 |
| Note Pinning | 2 |
| Faded Notes | 3 |
| Tag Creation | 4 |
| Tag Editing | 2 |
| Tag Deletion | 1 |
| Tag Filtering | 4 |
| Tag Assignment | 5 |
| Share Creation | 4 |
| Shared Note View | 3 |
| Share Revocation | 2 |
| Export | 4 |
| Copy to Clipboard | 2 |
| Import | 3 |
| Settings Modal | 3 |
| Profile Settings | 2 |
| Password Settings | 2 |
| Theme Settings | 1 |
| Offboarding | 2 |

#### Key Testing Patterns
- Custom test fixtures with `base.extend<{}>` for authenticated page context
- Reusable helper functions for common actions (loginUser, createNote, createTag, etc.)
- `authenticatedPage` fixture that logs in before each test
- `page.waitForEvent('download')` for testing file downloads
- Semantic locators using `getByRole`, `getByTestId`, `getByText`, `getByPlaceholder`
- Flexible regex patterns for matching UI text (e.g., `/sign in/i`, `/save|create/i`)
- Conditional logic for optional UI elements (confirmation dialogs, etc.)

#### E2E Test Scripts
```bash
npm run e2e          # Run all E2E tests headless
npm run e2e:ui       # Open Playwright UI for interactive testing
npm run e2e:headed   # Run tests with visible browser
npm run e2e:report   # View HTML test report
```

#### Prerequisites for Running E2E Tests
- Test user account configured in Supabase
- Environment variables: `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`
- Dev server running (or use webServer config in playwright.config.ts)
