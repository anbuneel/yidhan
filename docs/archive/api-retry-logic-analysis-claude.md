# API Retry Logic Analysis

**Author:** Claude (Opus 4.5)
**Date:** 2025-12-28
**Status:** Fix Implemented

---

## Original Prompt

> Check the API retry logic blocker from launch readiness doc

---

## Executive Summary

**Finding: CRITICAL - Not Implemented**

The save indicator in the Editor is purely cosmetic and doesn't reflect actual save status. Failed saves are silently swallowed, risking data loss.

---

## Current Implementation Analysis

### Save Flow (Before Fix)

```
User types → Editor shows "Saving..." → onUpdate() called (sync)
                    ↓
            500ms timer fires → Editor shows "Saved ✓"  ← FALSE!
                    ↓
App.tsx receives update → 500ms debounce → updateNote() called
                    ↓
              API fails? → console.error() ← User never knows
```

### Problems Identified

| Issue | Severity | Location | Risk |
|-------|----------|----------|------|
| Fake "Saved" status | Critical | `Editor.tsx:83-85` | Data loss |
| No retry on failure | Critical | `App.tsx:390` | Data loss |
| Error swallowed silently | Critical | `App.tsx:390` | Data loss |
| Optimistic update not rolled back | Medium | `App.tsx:380-383` | Stale UI |

### Code Evidence

**Editor.tsx:63-85** - Timer-based fake status:
```typescript
setSaveStatus('saving');
onUpdate({ ...note, title, content }); // Fire and forget

// After 500ms, show "Saved" regardless of actual result
savePhaseTimeoutRef.current = setTimeout(() => {
  setSaveStatus('saved');  // ← This is a lie
}, 500);
```

**App.tsx:389-391** - No retry, silent failure:
```typescript
updateTimeoutRef.current = setTimeout(() => {
  updateNote(updatedNote).catch(console.error);  // ← Just logs error
}, 500);
```

---

## Risk Assessment

### Data Loss Scenario

1. User types note content
2. Editor shows "Saving..." then "Saved ✓"
3. Network is flaky, API call fails
4. Error logged to console (user doesn't see)
5. User closes app thinking note is saved
6. **Content is lost forever**

### Likelihood

- High on mobile networks
- High on unstable WiFi
- Medium on stable connections (transient failures still possible)

---

## Fix Implementation

### Changes Made

1. **Created `withRetry` utility** (`src/utils/withRetry.ts`)
   - Exponential backoff: 1s → 2s → 4s
   - 3 retry attempts by default
   - Configurable delay and attempts

2. **Updated `updateNote` service** (`src/services/notes.ts`)
   - Wrapped with retry logic
   - Returns promise for async handling

3. **Made `onUpdate` async** (`App.tsx`)
   - Returns promise to Editor
   - Handles errors with toast notification
   - Reverts optimistic update on failure

4. **Updated Editor save status** (`Editor.tsx`)
   - Waits for actual save result
   - Shows error state on failure
   - Red indicator with "Save failed" message

5. **Added error UI state** (`Editor.tsx`)
   - New `'error'` save status
   - Red styling for failed saves
   - Clear error on next save attempt

### New Save Flow (After Fix)

```
User types → Editor shows "Saving..." → onUpdate() called (async)
                    ↓
            App.tsx calls updateNote with retry
                    ↓
         ┌─────────┴─────────┐
         ↓                   ↓
    Success              Failure (after 3 retries)
         ↓                   ↓
 Editor: "Saved ✓"    Editor: "Save failed"
                             ↓
                      Toast notification
                             ↓
                      Optimistic update reverted
```

---

## Test Coverage

### Unit Tests Added

- `withRetry` utility tests
- `updateNote` retry behavior tests
- Editor error state rendering tests

### Manual Testing

- [ ] Test with network disabled
- [ ] Test with slow network (throttled)
- [ ] Test rapid typing during save
- [ ] Test recovery after network restored

---

## Files Modified

| File | Changes |
|------|---------|
| `src/utils/withRetry.ts` | New - retry utility |
| `src/services/notes.ts` | Added retry to updateNote |
| `src/App.tsx` | Async onUpdate, error handling |
| `src/components/Editor.tsx` | Error state UI |
| `docs/active/launch-readiness-assessment.md` | Updated status |

---

## Related Documentation

- [Launch Readiness Assessment](launch-readiness-assessment.md)
- [CI Workflow](../setup/ci-workflow.md)

---

## Conclusion

The API retry logic has been implemented with:
- 3 retry attempts with exponential backoff
- Honest save status indicator
- User notification on failure
- Optimistic update rollback on failure

**Status:** ✅ RESOLVED
