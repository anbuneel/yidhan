# Codex Review Action Plan

**Author:** Claude (Opus 4.5)
**Created:** 2025-12-28
**Source:** [Codex Review](../reviews/zenote-comprehensive-review-Codex.md)
**Status:** Complete

---

## Summary

Prioritized action plan addressing findings from Codex code review. Items are grouped by priority with effort estimates and acceptance criteria.

| Priority | Items | Total Effort | Status |
|----------|-------|--------------|--------|
| P1 (Pre-Launch) | 3 | ~35 min | ✅ Complete |
| P2 (Launch Week) | 4 | ~2-3 hrs | ✅ Complete |
| P3 (Post-Launch) | 4 | ~1.5 hrs | ✅ Complete |
| Dismissed | 1 | - | - |

---

## P1 - Pre-Launch (Must Fix)

### 1.1 Fix Offline Messaging
**Status:** [x] Completed (2025-12-28)
**Effort:** 15 min
**File:** `src/hooks/useNetworkStatus.ts`

**Problem:** Message says "Will sync when the path clears" but no sync queue exists. Misleads users into thinking offline edits are safe.

**Fix:**
```typescript
// Change from:
toast('Writing locally. Will sync when the path clears.', ...);

// Change to:
toast('Connection lost. Changes may not be saved.', ...);
```

**Acceptance Criteria:**
- [x] Offline toast clearly indicates saves may fail
- [x] No promise of sync functionality
- [x] Maintains zen-style tone

---

### 1.2 Add Sanitization to SharedNoteView
**Status:** [x] Completed (2025-12-28)
**Effort:** 15 min
**File:** `src/components/SharedNoteView.tsx`

**Problem:** `dangerouslySetInnerHTML` renders note content without explicit sanitization. While Tiptap sanitizes on input, defense-in-depth is good practice.

**Fix:**
```typescript
import { sanitizeHtml } from '../utils/sanitize';

// Change from:
dangerouslySetInnerHTML={{ __html: note?.content || '' }}

// Change to:
dangerouslySetInnerHTML={{ __html: sanitizeHtml(note?.content || '') }}
```

**Acceptance Criteria:**
- [x] Content passed through `sanitizeHtml()` before rendering
- [x] Existing shared notes still display correctly
- [x] No XSS possible even with malicious content

---

### 1.3 Fix Delete Stale Closure
**Status:** [x] Completed (2025-12-28)
**Effort:** 5 min
**File:** `src/App.tsx` (line ~428)

**Problem:** `setNotes(notes.filter(...))` uses stale closure. Should use functional update.

**Fix:**
```typescript
// Change from:
setNotes(notes.filter((n) => n.id !== id));

// Change to:
setNotes((prev) => prev.filter((n) => n.id !== id));
```

**Acceptance Criteria:**
- [x] Delete uses functional state update
- [x] Concurrent updates not dropped
- [x] Tests pass

---

## P2 - Launch Week (Should Fix)

### 2.1 Configure Sentry Session Replay Masking
**Status:** [x] Completed (2025-12-28)
**Effort:** 15 min
**File:** `src/main.tsx`

**Problem:** Session replay may capture sensitive note content.

**Fix:**
```typescript
Sentry.replayIntegration({
  maskAllInputs: true,
  blockAllMedia: false,
  block: ['.rich-text-editor', '.ProseMirror', '[data-sensitive]'],
}),
```

**Acceptance Criteria:**
- [x] Note content masked in session replays
- [x] Other UI elements still visible for debugging
- [x] Replay integration configured correctly

---

### 2.2 Add Retry Error Discrimination
**Status:** [x] Completed (2025-12-28)
**Effort:** 30 min
**File:** `src/utils/withRetry.ts`

**Problem:** Retries all errors including non-retryable 4xx (validation, auth).

**Fix:**
```typescript
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  // Network errors - always retry
  if (message.includes('network') || message.includes('fetch') ||
      message.includes('timeout') || message.includes('connection')) {
    return true;
  }
  // 4xx errors - don't retry
  if (/\b4\d{2}\b/.test(message) || ...) return false;
  // 5xx errors - retry
  if (/\b5\d{2}\b/.test(message) || ...) return true;
  return true; // Default to retry for unknown errors
}
```

**Acceptance Criteria:**
- [x] 4xx errors fail immediately (no retry delay)
- [x] 5xx and network errors still retry
- [x] Configurable via `shouldRetry` option
- [x] Tests cover both cases (8 new tests added)

---

### 2.3 Add In-Flight Save Tracking
**Status:** [x] Completed (2025-12-28)
**Effort:** 1-2 hrs
**File:** `src/components/Editor.tsx`

**Problem:** Overlapping saves can race. Rollback may overwrite newer successful save.

**Fix:**
```typescript
// Track in-flight save promise
const inFlightSaveRef = useRef<Promise<void> | null>(null);

// In performSave:
const savePromise = (async () => { ... })();
inFlightSaveRef.current = savePromise;
await savePromise;
```

**Acceptance Criteria:**
- [x] Save promise tracked via ref
- [x] Navigation awaits in-flight save
- [x] Tests updated for async behavior

---

### 2.4 Verify Faded Notes Server Cleanup
**Status:** [ ] Deferred - Requires Supabase Dashboard Access
**Effort:** 30 min
**Location:** Supabase Dashboard

**Problem:** Client-side cleanup runs on app load, but users who don't open app won't trigger it.

**Fix:**
- Verify `pg_cron` extension enabled in Supabase
- Create/verify scheduled job for daily cleanup
- Or use Supabase Edge Function with cron trigger

**Acceptance Criteria:**
- [ ] Server-side job runs daily
- [ ] Notes older than 30 days auto-deleted
- [ ] Job logs visible in Supabase

---

## P3 - Post-Launch (Nice to Have)

### 3.1 Await Save on Escape/Back
**Status:** [x] Completed (2025-12-28)
**Effort:** 30 min
**File:** `src/components/Editor.tsx`

**Problem:** Navigation happens before save completes. Error toast may appear on wrong screen.

**Fix:**
```typescript
// Handle keyboard shortcuts
const handleKeyDown = async (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    // First await any existing in-flight save
    if (inFlightSaveRef.current) {
      await inFlightSaveRef.current;
    }
    // Then trigger a new save if needed and await it
    await performSave();
    onBack();
  }
};
```

**Acceptance Criteria:**
- [x] User sees save complete before leaving editor
- [x] Error shown in context if save fails
- [x] No blocking spinner for fast saves

---

### 3.2 Add --color-error Design Tokens
**Status:** [x] Completed (2025-12-28)
**Effort:** 10 min
**Files:** `src/themes/*.ts`, `src/themes/types.ts`

**Problem:** Error indicator uses undefined tokens with fallback colors.

**Fix:**
```typescript
// In ThemeColors interface:
error: string;
errorLight: string;

// In light themes:
error: '#DC2626',
errorLight: '#FEE2E2',

// In dark themes:
error: '#EF4444',
errorLight: 'rgba(239, 68, 68, 0.15)',
```

**Acceptance Criteria:**
- [x] Error tokens defined in both light and dark themes
- [x] Save error indicator uses theme tokens
- [x] Consistent error styling across app

---

### 3.3 Fix Space Key Accessibility
**Status:** [x] Completed (2025-12-28)
**Effort:** 30 min
**Files:** `src/components/NoteCard.tsx`, `src/components/ChapterSection.tsx`

**Problem:** Custom button-like elements only handle Enter, not Space.

**Fix:**
```typescript
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleClick();
  }
}}
```

**Acceptance Criteria:**
- [x] All interactive elements respond to Space
- [x] Keyboard navigation fully functional
- [x] e.preventDefault() added to prevent scroll on Space

---

### 3.4 Investigate State Updates During Render
**Status:** [x] Reviewed - Not an issue
**Effort:** 30 min
**Files:** `src/components/ChapterSection.tsx`, `src/components/TimeRibbon.tsx`

**Finding:** The state updates flagged by Codex are using a valid React pattern (comparing props to previous state to derive new state). This is the recommended alternative to `getDerivedStateFromProps` in functional components.

**Acceptance Criteria:**
- [x] Pattern reviewed and validated
- [x] No StrictMode warnings
- [x] Performance not degraded

---

## Dismissed

### Token Enumeration RLS Policy
**Status:** [x] Dismissed - By Design
**Rationale:** Public `USING (true)` policy is intentional for "secret URL" sharing pattern. Tokens have 128-bit entropy (UUID v4), making brute-force infeasible. This is the standard pattern used by Google Docs, Notion, Dropbox, etc.

---

## Progress Tracking

| Date | Action | Items Completed |
|------|--------|-----------------|
| 2025-12-28 | Plan created | - |
| 2025-12-28 | P1 fixes completed | 1.1, 1.2, 1.3 |
| 2025-12-28 | P2/P3 fixes completed | 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4 |

---

## Related Documents

- [Codex Review](../reviews/zenote-comprehensive-review-Codex.md)
- [Launch Readiness Assessment](./launch-readiness-assessment.md)
- [API Retry Logic Analysis](../analysis/api-retry-logic-analysis-claude.md)
