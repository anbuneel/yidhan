## 2026-01-28 - [React.memo with Unstable Handlers]
**Learning:** In this codebase, handler functions (onClick, onDelete) passed to list items are often unstable (recreated on every render) but their functional intent depends on stable closures or latest state via functional updates.
**Action:** When optimizing list items (like NoteCard), use `React.memo` with a custom comparison function that ignores these handlers and checks only data props (note object), provided that the handlers are safe to be stale (e.g. they use functional state updates or don't capture stale data that matters).
