## 2025-02-23 - DOMPurify Performance
**Learning:** `DOMPurify.sanitize` is synchronous and expensive (~10ms per 1KB). Running this inside a component render blocks the main thread, causing jank in lists.
**Action:** Always truncate HTML content *before* sanitizing for previews. Use `useMemo` to cache the result.
