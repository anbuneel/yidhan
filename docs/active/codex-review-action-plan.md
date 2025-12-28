# Codex Review Action Plan

**Author:** Claude (Opus 4.5)
**Created:** 2025-12-28
**Source:** [Codex Review](../reviews/zenote-comprehensive-review-Codex.md)
**Status:** In Progress

---

## Summary

Prioritized action plan addressing findings from Codex code review. Items are grouped by priority with effort estimates and acceptance criteria.

| Priority | Items | Total Effort | Status |
|----------|-------|--------------|--------|
| P1 (Pre-Launch) | 3 | ~35 min | ✅ Complete |
| P2 (Launch Week) | 4 | ~2-3 hrs | Pending |
| P3 (Post-Launch) | 4 | ~1.5 hrs | Pending |
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
- [ ] Offline toast clearly indicates saves may fail
- [ ] No promise of sync functionality
- [ ] Maintains zen-style tone

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
- [ ] Content passed through `sanitizeHtml()` before rendering
- [ ] Existing shared notes still display correctly
- [ ] No XSS possible even with malicious content

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
- [ ] Delete uses functional state update
- [ ] Concurrent updates not dropped
- [ ] Tests pass

---

## P2 - Launch Week (Should Fix)

### 2.1 Configure Sentry Session Replay Masking
**Status:** [ ] Open
**Effort:** 15 min
**File:** `src/main.tsx`

**Problem:** Session replay may capture sensitive note content.

**Fix:**
```typescript
Sentry.init({
  // ... existing config
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      maskAllInputs: true,
      blockSelector: '.rich-text-editor, .note-content, [data-sensitive]',
    }),
  ],
});
```

**Acceptance Criteria:**
- [ ] Note content masked in session replays
- [ ] Other UI elements still visible for debugging
- [ ] Replay integration configured correctly

---

### 2.2 Add Retry Error Discrimination
**Status:** [ ] Open
**Effort:** 30 min
**File:** `src/utils/withRetry.ts`

**Problem:** Retries all errors including non-retryable 4xx (validation, auth).

**Fix:**
```typescript
interface RetryOptions {
  // ... existing
  shouldRetry?: (error: Error) => boolean;
}

// Default: retry network errors and 5xx, skip 4xx
const defaultShouldRetry = (error: Error): boolean => {
  // Check for Supabase/fetch error codes
  const message = error.message.toLowerCase();
  if (message.includes('network') || message.includes('fetch')) return true;
  if (message.includes('500') || message.includes('502') || message.includes('503')) return true;
  if (message.includes('400') || message.includes('401') || message.includes('403') || message.includes('404')) return false;
  return true; // Default to retry for unknown errors
};
```

**Acceptance Criteria:**
- [ ] 4xx errors fail immediately (no retry delay)
- [ ] 5xx and network errors still retry
- [ ] Configurable via `shouldRetry` option
- [ ] Tests cover both cases

---

### 2.3 Add In-Flight Save Tracking
**Status:** [ ] Open
**Effort:** 1-2 hrs
**Files:** `src/App.tsx`, `src/components/Editor.tsx`

**Problem:** Overlapping saves can race. Rollback may overwrite newer successful save.

**Fix:**
- Add `saveInFlightRef` to track pending save
- Cancel/ignore stale saves when new save starts
- Use version counter or timestamp for conflict detection

**Acceptance Criteria:**
- [ ] Only one save in flight at a time
- [ ] New edits cancel pending save and start fresh
- [ ] Rollback only applies if no newer save succeeded
- [ ] Tests cover race conditions

---

### 2.4 Verify Faded Notes Server Cleanup
**Status:** [ ] Open
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
**Status:** [ ] Open
**Effort:** 30 min
**File:** `src/components/Editor.tsx`

**Problem:** Navigation happens before save completes. Error toast may appear on wrong screen.

**Fix:**
- Make `handleBack` async
- Show "Saving..." state during navigation
- Only navigate after save completes or fails

**Acceptance Criteria:**
- [ ] User sees save complete before leaving editor
- [ ] Error shown in context if save fails
- [ ] No blocking spinner for fast saves

---

### 3.2 Add --color-error Design Tokens
**Status:** [ ] Open
**Effort:** 10 min
**Files:** `src/themes/*.ts`, `src/index.css`

**Problem:** Error indicator uses undefined tokens with fallback colors.

**Fix:**
```typescript
// In theme files:
'--color-error': '#DC2626',
'--color-error-light': '#FEE2E2',
```

**Acceptance Criteria:**
- [ ] Error tokens defined in both light and dark themes
- [ ] Save error indicator uses theme tokens
- [ ] Consistent error styling across app

---

### 3.3 Fix Space Key Accessibility
**Status:** [ ] Open
**Effort:** 30 min
**Files:** `src/components/TagPill.tsx`, `src/components/NoteCard.tsx`, `src/components/ChapterSection.tsx`

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
- [ ] All interactive elements respond to Space
- [ ] Keyboard navigation fully functional
- [ ] a11y audit passes

---

### 3.4 Investigate State Updates During Render
**Status:** [ ] Open
**Effort:** 30 min
**Files:** `src/components/ChapterSection.tsx`, `src/components/TimeRibbon.tsx`

**Problem:** Codex flagged potential state updates during render causing extra renders.

**Fix:**
- Review flagged lines
- Move state updates to useEffect if needed
- Verify no StrictMode warnings

**Acceptance Criteria:**
- [ ] No state updates during render
- [ ] No console warnings in StrictMode
- [ ] Performance not degraded

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

---

## Related Documents

- [Codex Review](../reviews/zenote-comprehensive-review-Codex.md)
- [Launch Readiness Assessment](./launch-readiness-assessment.md)
- [API Retry Logic Analysis](../analysis/api-retry-logic-analysis-claude.md)
