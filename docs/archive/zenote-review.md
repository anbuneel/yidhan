Zenote Code Review — 2025-12-15

Overall assessment: Conditional Pass (strong styling and feature breadth, but multi-tenant safety, testing, and scalability need work).

Key strengths
- Cohesive wabi-sabi theming with defined tokens, textures, and reduced-motion fallback (src/index.css).
- Security-conscious defaults: DOMPurify sanitization for note content/title rendering (src/utils/sanitize.ts) and import validation (src/utils/exportImport.ts), plus Sentry hooks and error boundary coverage.
- Real-time sync and tagging workflows are wired end-to-end (notes + tags services, UI flow in src/App.tsx, TagModal/TagSelector components).

Critical issues (fix immediately)
1) Client queries are not scoped by user id
- fetchNotes/searchNotes in src/services/notes.ts and fetchTags in src/services/tags.ts never filter by auth user; they rely entirely on RLS. If a service-role key or misconfigured RLS is used, the client will read or search every user’s data and incur larger scans. Explicitly add `.eq('user_id', user.id)` (and similar filters in search) before ordering, and ensure the auth token is attached on every request.

High priority
2) Accessibility gaps in primary navigation and library
- Header search input has no accessible label or described-by helper; only a placeholder exists (src/components/Header.tsx). Masonry grid cards have custom hover/focus visuals but no focus-visible states on some interactive elements inside cards (pin/delete) and no skip links. Add `aria-label`/`aria-describedby`, ensure focus outlines for all actionable controls, and consider an a11y check (jest-axe/pa11y) to backstop regressions.
3) Test coverage is minimal and misses critical paths
- Only TagBadge/ErrorBoundary/utils are tested; App flows, services, auth, import/export, and TagModal are untested. Add Vitest+RTL coverage for note CRUD, tagging, search debounce, import validation failures, and Auth flows (mock Supabase). Track coverage to meet the 60–80% target.
4) Scalability/performance: unbounded lists and searches
- Notes and tags are fetched in full and sorted client-side; Masonry renders all items with no pagination or virtualization (src/components/Library.tsx). Searching hits the DB on every debounce without caching and without user scoping. Introduce pagination or virtualized list rendering, cache recent search results, and limit payload fields to reduce bundle and query costs.

Medium priority
5) No offline or conflict strategy for note edits
- useNetworkStatus only shows toasts, but edits rely on live Supabase writes without local queueing or conflict resolution (src/App.tsx, src/hooks/useNetworkStatus.ts). Define offline UX (queue + retry or disable editing) and consider last-writer-wins/versioning to avoid silent overwrites across tabs/devices.
6) Markdown export/import UX gaps
- `downloadMarkdownZip` writes a single combined .md file instead of an actual zip archive (src/utils/exportImport.ts), which diverges from the filename and expectations. Either bundle real zips (JSZip) or adjust copy/filenames to match behavior.
7) Error handling lacks user feedback in critical flows
- Service calls log to console but surface no UI feedback for fetch/create/update failures (e.g., createNote/updateNote/deleteNote in src/App.tsx and services). Add toast/error banners and optimistic update rollback for consistency.

Security
- Confirm RLS policies from supabase/migrations/security_audit_checklist.sql are applied in production; missing RLS would compound the critical issue above.
- Ensure CSP, X-Frame-Options, and source map policies are set at hosting (Vercel) since Vite defaults don’t add them. Review Sentry Replay sampling vs. privacy requirements.

Zenote-specific observations
- Wabi-sabi visual language is strong (tokens, asymmetric radii, paper noise), but responsive touch targets on mobile could use validation (48x48 min) and some controls are hidden behind hover states that don’t exist on touch (pin/delete in NoteCard).
- No search/tag analytics or backup/export scheduling; consider a lightweight backup reminder or cron.

Recommended next steps (order)
1) Add user scoping to all Supabase queries and verify RLS policies; add regression tests for data isolation.
2) Ship a11y fixes (labels/focus states/skip links) and run an automated WCAG pass.
3) Add pagination/virtualization for library and cache-aware search.
4) Expand test suite to cover auth, notes/tags flows, import/export validation, and optimistic updates.
5) Clarify export UX (real zip vs combined markdown) and document offline/conflict expectations.
