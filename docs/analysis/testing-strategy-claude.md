# Zenote Automated Testing Strategy Analysis

**Author:** Claude (Opus 4.5)
**Date:** 2025-12-27
**Consulted:** Codebase Exploration Agent

---

## Original Prompt

> Are you in a position to do a full analysis and recommend a plan for implementing automated testing that builds confidence in the product quality and enables us to safely make feature enhancements without breaking existing functionality?

---

## Executive Summary

Zenote's test suite has grown significantly from 43 tests to **199 tests** across 7 test files. Phases 1-3 of the testing strategy are complete, covering utilities and services. The testing infrastructure (Vitest + Testing Library) is fully operational with comprehensive Supabase mocking patterns established.

**Current Progress:**
- Phase 1 (temporalGrouping): ✅ 35 tests
- Phase 2 (exportImport): ✅ 23 tests
- Phase 3 (notes + tags services): ✅ 98 tests
- Remaining: Component integration tests (~90) and E2E tests (~30)

---

## 1. Current Test Coverage

### Test Framework Setup
- **Framework:** Vitest 4.0.15 with jsdom environment
- **Test Libraries:** @testing-library/react, @testing-library/user-event
- **Coverage Tool:** @vitest/coverage-v8 (configured, not yet utilized)
- **Configuration:** `vite.config.ts` with jsdom environment and `src/test/setup.ts`

### Current Tests (7 files, 199 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `notes.test.ts` | 64 | Full CRUD, soft-delete, sharing, subscriptions |
| `tags.test.ts` | 34 | CRUD, note-tag relations, subscriptions |
| `temporalGrouping.test.ts` | 35 | Chapter classification, grouping, expansion |
| `exportImport.test.ts` | 23 | JSON/Markdown export/import, clipboard |
| `sanitize.test.ts` | 19 | XSS prevention, HTML sanitization |
| `formatTime.test.ts` | 12 | Relative time formatting with fake timers |
| `ErrorBoundary.test.tsx` | 5 | Error UI, refresh button, reload |
| `TagBadge.test.tsx` | 7 | Color indicators, overflow truncation |

### Coverage Gaps (Remaining)
- **Auth flows:** login, signup, OAuth, password reset (0%)
- **Editor:** auto-save, debounce, state management (0%)
- **Components:** modals, headers, library views (0%)

---

## 2. Critical User Flows to Test

### A. Authentication Flows (HIGH PRIORITY)
**Service Layer:** `src/contexts/AuthContext.tsx`

| Flow | Test Type | Complexity |
|------|-----------|------------|
| Email/Password Login | Integration | High |
| Email/Password Signup | Integration | High |
| Google OAuth | Integration | Very High |
| GitHub OAuth | Integration | Very High |
| Password Reset Flow | Integration | High |
| Profile Update | Integration | Medium |
| Offboarding (initiate/cancel) | Integration | High |

**Key Functions:**
- `signIn(email, password)`
- `signUp(email, password, fullName?)`
- `signInWithGoogle()` / `signInWithGitHub()`
- `resetPassword(email)` / `updatePassword(newPassword)`
- `updateProfile(fullName)`
- `initiateOffboarding()` / `cancelOffboarding()`

### B. Note CRUD Operations (HIGH PRIORITY)
**Service Layer:** `src/services/notes.ts` (580 lines)

| Operation | Test Type | Notes |
|-----------|-----------|-------|
| Create (single + batch) | Unit/Integration | 500 note batch limit |
| Fetch with tag filtering | Integration | AND logic for multiple tags |
| Update | Integration | Title, content, timestamp |
| Search | Integration | Full-text, excludes soft-deleted |
| Pin Toggle | Unit | Boolean, affects ordering |
| Soft Delete | Integration | Sets deleted_at, 30-day retention |
| Restore | Integration | Clears deleted_at |
| Permanent Delete | Integration | Hard delete |
| Real-time Subscribe | Integration | INSERT/UPDATE/DELETE events |
| Share CRUD | Integration | Token generation, expiration |

**Critical Business Logic:**
```typescript
// Tag filtering uses AND logic (notes must have ALL selected tags)
const filteredNotes = notes.filter((note) => {
  const noteTagIds = note.tags.map((t) => t.id);
  return filterTagIds.every((tagId) => noteTagIds.includes(tagId));
});

// Batch size limit: 500 notes (Supabase constraint)
// Soft-delete cleanup: 30 days auto-release
```

### C. Tag Management (MEDIUM PRIORITY)
**Service Layer:** `src/services/tags.ts` (209 lines)

| Operation | Test Type | Notes |
|-----------|-----------|-------|
| Create | Unit | 1-20 char validation, 8 colors |
| Fetch | Integration | Ordered by name |
| Update | Unit | Name + color validation |
| Delete | Integration | Cascade via junction table |
| Add/Remove from Note | Integration | Duplicate key handling |

**Validation Rules:**
```typescript
const MAX_TAG_NAME_LENGTH = 20;
const MIN_TAG_NAME_LENGTH = 1;
```

### D. Editor & Rich Text (MEDIUM PRIORITY)

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Auto-save debounce | High | 1.5s delay, save status UI |
| Cursor focus management | Medium | Title vs content positioning |
| Slash commands | Medium | /date, /time, /now, /divider |
| Keyboard shortcuts | Medium | Cmd+N, Cmd+Shift+C |
| Export from editor | Low | Single note MD/JSON |

### E. Share as Letter (MEDIUM PRIORITY)

| Test Case | Notes |
|-----------|-------|
| Create with expiration | 1d, 7d, 30d, never |
| Token validation | Valid/invalid/expired |
| Public access | Read-only, formatting preserved |
| Soft-deleted notes | Not accessible via share |
| Revocation | Immediate access removal |

### F. Export/Import (MEDIUM PRIORITY)
**Functions:** `src/utils/exportImport.ts` (634 lines)

| Feature | Test Type | Notes |
|---------|-----------|-------|
| Export JSON | Unit | All notes + tags, metadata |
| Export Markdown | Unit | HTML conversion, task lists |
| Import JSON | Unit | Validation, max 1000 notes |
| Import Markdown | Unit | Combined format parsing |
| Copy to clipboard | Unit | Plain text + HTML |

**Constraints:**
```typescript
const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMPORT_NOTES = 1000;
```

---

## 3. Component Architecture Analysis

### Simple Presentation (Low Priority)
- `TagBadge.tsx` - Color dot display
- `TagPill.tsx` - Read-only tag pill
- `NoteCard.tsx` - Note display with actions
- `FadedNoteCard.tsx` - Soft-deleted note display
- `Footer.tsx` - Static links
- `WhisperBack.tsx` - Floating back button

### Moderately Complex (Medium Priority)
- `TagFilterBar.tsx` - Selection with scroll fade
- `TagModal.tsx` - CRUD with loading states
- `SettingsModal.tsx` - Profile, password, theme
- `LettingGoModal.tsx` - Offboarding flow
- `ChapterSection.tsx` - Collapsible masonry grid
- `ChapteredLibrary.tsx` - Temporal chapters view

### Complex with Business Logic (High Priority)
- **`Editor.tsx`** (350 lines) - Auto-save, debounce, state management
- **`Auth.tsx`** (400+ lines) - Multi-mode auth, OAuth, error sanitization
- **`App.tsx`** (750+ lines) - Main state container, subscriptions
- `ShareModal.tsx` - Share lifecycle management
- `RichTextEditor.tsx` - Tiptap with slash commands

---

## 4. Service Layer Analysis

### `src/services/notes.ts` (580 lines) - CRITICAL
**Operations:** CRUD, soft-delete, search, real-time, sharing
**Dependencies:** Supabase client
**Mocking Strategy:** Mock Supabase client methods

### `src/services/tags.ts` (209 lines) - CRITICAL
**Operations:** CRUD, validation, junction table management
**Dependencies:** Supabase client
**Mocking Strategy:** Mock Supabase client methods

---

## 5. Utility Functions - Unit Test Candidates

### `src/utils/exportImport.ts` (634 lines) - EXCELLENT
Pure functions, no external dependencies:
- `exportNotesToJSON()` / `parseImportedJSON()`
- `htmlToMarkdown()` / `markdownToHtml()`
- `parseMultiNoteMarkdown()`
- `copyNoteToClipboard()` / `copyNoteWithFormatting()`
- `getSanitizedFilename()`

### `src/utils/temporalGrouping.ts` (183 lines) - EXCELLENT
Pure date-based logic:
- `getChapterForDate()` - Time classification
- `groupNotesByChapter()` - Pinned + temporal grouping
- `getDefaultExpansionState()` - Adaptive UX by note count

### `src/utils/formatTime.ts` (70 lines) - Expand existing
Additional edge cases: midnight boundaries, leap years, timezones

### `src/utils/sanitize.ts` (90 lines) - Expand existing
Additional cases: nested payloads, CSS escaping, unicode

### `src/hooks/useNetworkStatus.ts` (67 lines) - Unit testable
Event listeners, toast notifications, cleanup verification

---

## 6. Testing Infrastructure Recommendations

### Supabase Mock
```typescript
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {...}, error: null }),
    })),
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
  }
}));
```

### Test Fixtures/Factories
```typescript
export function createMockNote(overrides?: Partial<Note>): Note {
  return {
    id: 'note-1',
    title: 'Test Note',
    content: '<p>Test content</p>',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    tags: [],
    pinned: false,
    deletedAt: null,
    ...overrides,
  };
}

export function createMockTag(overrides?: Partial<Tag>): Tag {
  return {
    id: 'tag-1',
    name: 'Test Tag',
    color: 'terracotta',
    ...overrides,
  };
}
```

### Test Utilities
```typescript
// src/test/test-utils.tsx
import { render } from '@testing-library/react';

function AllTheProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}
```

---

## 7. Implementation Progress

### Phase 1: Unit Tests - Utility Functions ✅ COMPLETED
**PR #33** | **Tests:** 35 | **Date:** 2025-12-27

| Target | Tests | Status |
|--------|-------|--------|
| `temporalGrouping.ts` | 35 | ✅ Complete |

### Phase 2: Unit Tests - Export/Import ✅ COMPLETED
**PR #34** | **Tests:** 23 | **Date:** 2025-12-27

| Target | Tests | Status |
|--------|-------|--------|
| `exportImport.ts` | 23 | ✅ Complete |

### Phase 3: Unit Tests - Services ✅ COMPLETED
**PR #35** | **Tests:** 98 | **Date:** 2025-12-27

| Target | Tests | Status |
|--------|-------|--------|
| `notes.ts` | 64 | ✅ Complete |
| `tags.ts` | 34 | ✅ Complete |

**Comprehensive Supabase mocking with:**
- All CRUD operations (create, read, update, delete)
- Soft-delete lifecycle (fade, restore, permanent delete)
- Faded notes management (fetch, count, empty, cleanup)
- Share as Letter features (create, get, update, delete, fetch public)
- Real-time subscription testing
- Error handling edge cases

### Phase 4: Component Integration Tests (NEXT)
**Tests:** ~90 | **Effort:** ~75h

| Target | Tests | Focus |
|--------|-------|-------|
| `Editor.tsx` | 20 | Auto-save, state |
| `Auth.tsx` | 25 | All auth flows |
| `TagModal.tsx` | 12 | CRUD + loading |
| `ShareModal.tsx` | 10 | Share lifecycle |
| `HeaderShell.tsx` | 10 | Layout, responsive |
| Other components | 13 | Various |

### Phase 5: E2E Tests
**Tests:** ~30 | **Effort:** ~50h

Critical user journeys:
1. Auth flow (signup → confirm → login)
2. Note lifecycle (create → edit → delete → restore)
3. Tag management & filtering
4. Export/Import roundtrip
5. Share as Letter flow
6. Multi-tab sync

---

## 8. Priority Ranking & Effort Summary

| Area | Priority | Effort | Tests | Target Coverage |
|------|----------|--------|-------|-----------------|
| Services (notes, tags) | CRITICAL | 40h | 90 | 85% |
| Export/Import utils | CRITICAL | 30h | 50 | 95% |
| Temporal grouping | HIGH | 15h | 25 | 90% |
| Auth context | HIGH | 25h | 30 | 80% |
| Editor component | HIGH | 20h | 20 | 75% |
| Modal components | MEDIUM | 30h | 32 | 80% |
| Other components | MEDIUM | 20h | 18 | 70% |
| E2E tests | MEDIUM | 50h | 30 | N/A |
| **TOTAL** | | **~210h** | **~285** | **~75%** |

---

## 9. Success Metrics

- **Unit Test Coverage:** >80% of services and utilities
- **Integration Test Coverage:** >70% of components
- **E2E Coverage:** All critical user flows
- **CI/CD:** Tests run on every PR, block merge if coverage drops
- **Maintenance:** <5% test flakiness
- **Developer Velocity:** Confident refactoring enabled

---

## 10. Quick Wins (Start Here)

1. **`temporalGrouping.ts`** - Pure functions, no mocks needed, ~25 tests
2. **`exportImport.ts`** - Pure functions, high business value, ~50 tests
3. **Expand existing tests** - formatTime edge cases, sanitize coverage

---

## Appendix: Key File Paths

```
src/services/notes.ts          # 580 lines - Note CRUD, sharing
src/services/tags.ts           # 209 lines - Tag CRUD
src/utils/exportImport.ts      # 634 lines - Export/Import
src/utils/temporalGrouping.ts  # 183 lines - Chapter grouping
src/contexts/AuthContext.tsx   # Auth state management
src/components/Editor.tsx      # 350 lines - Note editor
src/components/Auth.tsx        # 400+ lines - Auth UI
src/App.tsx                    # 750+ lines - Main app
src/test/setup.ts              # Test setup
vite.config.ts                 # Vitest config
```
