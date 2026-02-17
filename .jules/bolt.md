## 2025-05-23 - Redundant Sorting in Child Components
**Learning:** Child components (like `ChapteredLibrary`) often re-sort data that is already sorted by the parent (`App.tsx`). This redundant O(N log N) operation on every render can be avoided by trusting the parent's sort order or memoizing the sorted data higher up.
**Action:** Verify if props are already sorted before adding sort logic in child components. If sorting is needed for display only, consider if the parent can provide it pre-sorted.

## 2025-05-23 - Date Object Creation in Loops
**Learning:** `new Date()` is expensive when called repeatedly in loops (e.g., inside `getChapterForDate` for every note).
**Action:** Pre-calculate reference dates (like "start of today") once outside the loop and pass them as primitives (timestamps) to helper functions.
