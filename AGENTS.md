# Yidhan - Project Context for Claude Code

## Overview
Yidhan is a calm, distraction-free note-taking application — where thoughts bloom with clarity. Named from Tamil origins meaning "Bright Spring," it features a wabi-sabi design with asymmetric card corners, warm colors, and elegant typography.

**Live URL:** https://yidhan.vercel.app
**Repository:** https://github.com/anbuneel/yidhan

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4 with CSS custom properties
- **Rich Text:** Tiptap (ProseMirror-based)
- **Layout:** react-masonry-css (Pinterest-style card grid)
- **Backend:** Supabase (PostgreSQL + Auth + Real-time)
- **Native:** Capacitor (Android, iOS planned)
- **Fonts:** Cormorant Garamond (display), Source Sans 3 (body), JetBrains Mono (code) — self-hosted woff2 in `src/assets/fonts/`, declared in `src/fonts.css`

## Key Commands
```bash
npm run dev      # Start development server
npm run build    # Production build (tsc + vite build)
npm run lint     # Run ESLint
npm run preview  # Preview production build
npm run typecheck # Type check without emitting
npm run test     # Run tests in watch mode
npm run test:run # Run tests once
npm run test:coverage # Run tests with coverage report
npm run check    # Full CI check: typecheck + lint + test + build
npm run e2e      # Run Playwright E2E tests
npm run e2e:ui   # Open Playwright UI for interactive testing
npm run e2e:headed # Run E2E tests with visible browser
npm run e2e:report # View E2E test HTML report
npm run e2e:sw   # Service worker update tests (production build, real worker)
npm run theme:generate  # Generate CSS from active themes
npm run theme:preview   # Preview theme CSS without updating
npm run icons:generate  # Generate PWA icons from SVG source
npm run logo:masks      # Regenerate the theme-aware logo mark masks from images/yidhan-logo-mark-512.webp
npm run splash:generate # Generate splash screens for native apps
npm run docs:sync-agents      # Sync AGENTS.md from CLAUDE.md
npm run docs:sync-agents:check # Check if AGENTS.md is in sync (CI)
npm run cap:sync        # Build and sync to native platforms
npm run cap:android     # Build, sync, and open Android Studio
npm run cap:android:run # Build, sync, and run on Android device/emulator
```

## Development Workflow

### Feature Work (Always Use PRs)
**IMPORTANT:** For any feature work, always create a feature branch and open a PR for review.

```bash
# 1. Create a feature branch
git checkout -b feature/your-feature-name

# 2. Make changes
# 3. Run full check (mirrors CI pipeline)
npm run check

# 4. If check passes, commit
git add . && git commit -m "feat: your message"

# 5. Push to feature branch
git push -u origin feature/your-feature-name

# 6. Create PR for review
gh pr create --title "feat: your feature" --body "Description of changes"
```

### Quick Fixes (Direct to Main)
For small, low-risk changes (typos, minor doc updates), direct commits to main are acceptable:

```bash
npm run check
git add . && git commit -m "fix: your message"
git push
```

### CI Pipeline
The `check` script runs the core CI steps locally (fast, no coverage):
1. `typecheck` - TypeScript type checking
2. `lint` - ESLint
3. `test:run` - Vitest tests (no coverage)
4. `build` - Production build

GitHub Actions CI additionally enforces coverage thresholds via `test:coverage`.
Run `npm run test:coverage` locally to check thresholds before pushing.

## Documentation Updates

**IMPORTANT:** When making significant enhancements, fixes, or changes, update these files:

1. **`CLAUDE.md`** - Update relevant sections:
   - UI Layout (document new UI patterns)
   - Any affected documentation sections

2. **`README.md`** - Update if changes affect:
   - Installation instructions
   - Usage examples
   - Feature descriptions visible to users

3. **`src/data/changelog.ts`** - Add new version entry with type (`'feature' | 'improvement' | 'fix'`) and description.

4. **`docs/prd.md`** - Update when implementing key features:
   - Move features from "Planned" to "Implemented" sections
   - Add new user flows for major features
   - Update glossary with new terminology
   - Update technical constraints if architecture changes

Note: `AGENTS.md` is synced from `CLAUDE.md`. Run `npm run docs:sync-agents` (or `npm run docs:sync-agents:check` in CI). A pre-commit hook in `.githooks/pre-commit` keeps it updated when `core.hooksPath` is set to `.githooks`.

## AI-Generated Documentation Standards

**IMPORTANT:** All documentation created by Claude must include the following metadata:

1. **Author:** Claude (Opus 4.6)
2. **Date/Timestamp:** YYYY-MM-DD (date of creation)
3. **Original Prompt:** The user's original request (quoted in blockquote)

**Required header format for all AI-generated docs:**
```markdown
# [Document Title]

**Version:** 1.0
**Last Updated:** YYYY-MM-DD
**Status:** [Living Document | Complete | Draft]
**Author:** Claude (Opus 4.6)

---

## Original Prompt

> [Include the user's original prompt/question here]

---

## [Document Content]
```

**File naming convention:** Use `-claude` suffix for AI-authored docs in analysis folder (e.g., `topic-claude.md`)

## Frontend Design Skill Consultations

When using the `frontend-design` skill, follow the AI-Generated Documentation Standards above and save output to `docs/analysis/` folder.

**Additional field for design consultations:**
- **Consulted:** Frontend Design Skill

**Example:** See `docs/analysis/collaboration-feature-analysis-claude.md`

## Documentation Structure

See [docs/Index.md](docs/Index.md) for the full documentation index.

**Placement guidelines for new docs:**
- **reference/**: User-facing behavior specs and feature guides
- **analysis/**: AI-authored design analysis (`*-claude.md`)
- **archive/plans/**: Implementation plans after feature is complete
- **archive/planning/**: Old planning docs, tech comparisons
- **active/**: Docs with ongoing action items
- **codebase-snapshot/**: Architecture, metrics, and timeline snapshots
- **reviews/**: External feedback (Gemini, human reviews)
- **setup/**: How-to guides for configuration

## Design System

### Themes
Active: Kintsugi (light, terracotta #C25634), Midnight (dark **default**, gold #D4AF37). Also available: Washi, Mori.
Config in `src/themes/`. Commands: `npm run theme:generate`, `npm run theme:preview`.

### CSS Variables
Defined in `src/index.css`. Use `--color-*` for colors, `--font-display`/`--font-body` for fonts.
Key convention: `--radius-card: 2px 24px 4px 24px` (asymmetric wabi-sabi corners).
Tag colors: terracotta, gold, forest, stone, indigo, clay, sage, plum.

### Fonts
Self-hosted, never loaded from Google Fonts: the woff2 subsets live in `src/assets/fonts/` and the
`@font-face` rules (with `unicode-range`, latin last) in `src/fonts.css`, imported by `index.css`.
Cormorant Garamond and Source Sans 3 are variable fonts, one file per subset. Declared ranges are
deliberately narrow — Cormorant `300 600`, Source Sans `300 500`, JetBrains Mono `400` — to match what
was previously loaded; widen them in `fonts.css` if a true bold is wanted. `index.html` preloads the two
latin faces. Vite hashes the files and the service worker precaches them (no runtime font caching, and
no `statuses: [0, 200]` cache that can pin a browser to fallback fonts). The CSP in `vercel.json` allows
`font-src 'self'` only.

### Logo Mark
`Logo.tsx` renders the wordmark as live text and the enso mark as `.brand-mark` (in `index.css`): two
CSS-masked layers filled with theme colours, so the arc takes `--color-accent` (terracotta on Kintsugi,
gold on Midnight) and the seed stays `--color-brand-gold`. The masks
(`src/assets/brand/yidhan-logo-mark-{arc,dot}.webp`) keep the watercolour texture in their alpha channel
and are generated by `npm run logo:masks` from `images/yidhan-logo-mark-512.webp`. The raster lockup in
`images/` is only used by `npm run og:generate` and is not bundled.

### Modal Backdrop
All modals use the shared `.modal-backdrop` CSS class (defined in `src/index.css`) for consistent overlay styling:
```css
.modal-backdrop { background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); }
```
**Exception:** `BottomSheet.tsx` mobile path uses inline styles (not the class) because the animated `opacity` spring from react-spring conflicts with `backdrop-filter` compositing on the CSS class.

### CTA Button Tokens
Primary action buttons MUST use `--color-cta-bg` / `--color-cta-text` (not `--color-accent` with `#fff`).
Defined in each theme's `ctaBg`, `ctaBgHover`, `ctaText` fields and mapped to CSS variables.
**Dark themes use polarity-flipped CTAs:** bright gold background + dark text (not darkened gold + white).
This prevents the "gold luminance trap" where darkening gold for white-text contrast produces dull olive tones.
Verified contrast ratios: Kintsugi 5.44:1, Washi 7.10:1, Midnight 8.55:1, Mori 7.29:1 (all exceed AA, dark themes exceed AAA).

### Button/Accent Token Taxonomy
Three semantic categories — never mix them:
- **CTA** (`--color-cta-bg`/`--color-cta-text`): Positive primary actions (Save, Submit, Create, Stay)
- **Destructive** (`--color-destructive` bg + `--color-destructive-text` text): Irreversible danger (Delete, Let go)
- **On-accent** (`--color-accent` bg + `--color-on-accent` text): Toggle/active indicators (toolbar bold/italic/H1)

`onAccent` is per-theme: `#fff` in light themes, dark bg-primary in dark themes.
Kintsugi `onAccent` is 4.49:1 (best achievable on `#C25634` — documented intentional tradeoff).

## Database Schema
See `docs/technical-spec.md` for full schema (notes, tags, note_tags, note_shares). Types in `src/types/database.ts`.
RLS enabled on all tables — users can only access their own data.

## Environment Variables
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx  # Optional - leave empty to disable
```

## Features
See `src/data/changelog.ts` for full feature history. See `src/data/roadmap.ts` for planned features.

## Common Tasks

### Adding a new feature
1. Check existing patterns in similar components
2. Use CSS variables for theming (never hardcode colors)
3. Match the wabi-sabi aesthetic (subtle animations, warm tones)
4. Use asymmetric border-radius: `2px 12px 4px 12px` for small elements

### Styling convention
Three approaches coexist — use the right tool for the job:
- **Tailwind classes** (preferred default): layout, spacing, responsive breakpoints, common utilities
- **Inline `style` props**: only for dynamic values that depend on state/props, or one-off CSS variable references not worth a class (e.g., `style={{ boxShadow: 'var(--shadow-manuscript)' }}`)
- **CSS-in-JSX `<style>` blocks**: complex selectors, keyframes, or media queries that Tailwind can't express (e.g., LandingPage entrance animations)

Avoid: creating new inline `style={{}}` objects for static values that could be a Tailwind class or a CSS class in `index.css`. Inline SVGs use `strokeWidth={1.5}` consistently.

### Modifying the editor
- Toolbar buttons are in `EditorToolbar.tsx` with `variant` prop: `'inline'` (desktop, sticky in header zone) or `'bottom'` (mobile, fixed at thumb zone)
- Vertical sidebar toolbar in `EditorSidebar.tsx`: curated 10-button subset (bold, italic, highlight, H1-H3, lists, quote, code block) + focus mode. Visible at ≥1100px, supplements (not replaces) the inline toolbar.
- Mobile toolbar uses `HeadingCycleButton` (¶→H1→H2→H3→¶) and `OverflowMenu` with `direction="up"` prop
- Focus mode uses parent-class CSS strategy: `focus-mode-active` on scroll container triggers descendant `.focus-mode-target` elements to fade out
- Editor content is in `RichTextEditor.tsx` (exposes editor via `onEditorReady` callback)
- Editor styles are in `index.css` under `.rich-text-editor`
- Add new Tiptap extensions via npm and configure in `RichTextEditor.tsx`
- `useKeyboardHeight` hook sets `--keyboard-height` CSS variable for keyboard-aware positioning
- Manuscript glow: viewport-following radial gradient in `.editor-manuscript-glow`, positioned via `requestAnimationFrame` scroll handler (ref-based, zero re-renders)

### Database changes
1. Update schema in Supabase SQL Editor
2. Update types in `src/types/database.ts`
3. Update service functions in `src/services/notes.ts` or `src/services/tags.ts`
4. Update app types in `src/types.ts` if needed

### Adding new tag features
- Tag service functions are in `src/services/tags.ts`
- Tag state is managed in `App.tsx`
- Tag components: `TagPill`, `TagBadge`, `TagFilterBar`, `TagSelector`, `TagModal`

### Soft-delete, sharing, and demo mode
- Soft-delete (Faded Notes) functions are in `src/services/notes.ts`
- Share as Letter (E2EE) functions are in `src/services/notes.ts` — uses capability-link model with per-share keys
- Account offboarding ("Letting Go") is enabled via `ACCOUNT_OFFBOARDING_ENABLED = true` after production verification, a scheduler smoke test, and a throwaway-account deletion drill passed. The server-owned workflow creates a 14-day deletion request, supports cancellation during the grace period, and deletes app data plus the Supabase Auth user through the service-role worker.
- Legacy plaintext repair tooling was removed after the pre-launch repair and `launch_security_hardening.sql` verification. Do not reintroduce plaintext-note compatibility for launch builds.
- Demo/Practice Space (`/demo`): `src/services/demoStorage.ts`, `src/hooks/useDemoState.ts`, `src/pages/DemoPage.tsx`
- Landing hero drafts save to `DEMO_CONTENT_STORAGE_KEY` (`yidhan-demo-content`) before signup; `App.tsx` migrates them into an encrypted "My first note" after auth/unlock
- Demo-to-account migration runs on signup in `App.tsx` via `migrateDemoToAccount()` (creates encrypted notes)

## UI Layout

See [docs/ui-layout.md](docs/ui-layout.md) for detailed ASCII diagrams of all UI components including:
- Landing page layouts (desktop/mobile)
- HeaderShell three-zone layout
- Note cards, temporal chapters, faded notes view
- Keyboard shortcuts and slash commands

## Copy & Export
Functions in `src/utils/exportImport.ts`. Batch insert via `createNotesBatch()` in `src/services/notes.ts`.

Markdown export format (used by all export/import):
```markdown
---
# Note Title
Tags: tag1, tag2
---

content...
```

## Key Component Locations
- **Auth:** `src/contexts/AuthContext.tsx` (login, signup, OAuth, offboarding, password reset)
- **Encryption:** `src/contexts/EncryptionContext.tsx` (key derivation, unlock/lock, memory-only key storage)
- **Settings:** `src/components/SettingsModal.tsx` (profile, password, security tabs + offboarding link)

## Notes
- Content is stored as HTML (from Tiptap's `getHTML()`), encrypted client-side before storage
- **E2EE**: Title + content encrypted as JSON blob using AES-256-GCM with AAD (`noteId:userId`). Tags remain plaintext. Keys derived from passphrase via Argon2id (`hash-wasm` WASM). Keys held in React state + sessionStorage (survives refresh, cleared on tab close/signout/vault lock). Encrypted reads, realtime upserts, sync pulls, conflict resolution, and authenticated imports fail closed on plaintext note payloads.
- **Blocked sync recovery:** Sync queue entries now use `pending` / `blocked` state so repeated failures remain recoverable instead of being dropped. Note writes use `.maybeSingle()`: a zero-row update rebuilds the row from the local encrypted record rather than blocking on PGRST116. `add_tag` treats a foreign-key violation (`23503`) as ordering and retries. `lastError` keeps the Postgres code and is surfaced in the sync indicator.
- **Safe hydration:** Startup hydration uses local metadata and merge behavior to avoid clearing queued local work during recovery paths.
- Notes sync via offline-first architecture: IndexedDB (Dexie) → sync queue → Supabase (all payloads encrypted)
- Legacy plaintext offline note write helpers are disabled in non-test builds; launch code must use `encryptedNotes` so plaintext never enters IndexedDB or the sync queue.
- Sync engine: incremental pull (cursor-based), paginated fetches, server-authoritative timestamps. Import timestamps (`createdAt`/`updatedAt`) are forwarded through the sync queue to Supabase INSERT to preserve note chronology. Queue processing uses `buildQueueBatches()` for parallel execution with bounded concurrency (`SYNC_BATCH_CONCURRENCY_LIMIT = 6`); noteTag entries force batch barriers. Stale entries (>24h, 3+ retries, non-create) are auto-blocked to prevent permanent "pending" state. Typed `SyncConflictError` enables clean conflict routing without retry logic.
- Server-side `notes_updated_at_trigger` prevents client clock skew issues (fires on UPDATE only; INSERT preserves client-supplied timestamps)
- Self-echo suppression via `pendingMutations` set prevents realtime re-applying own changes
- Realtime subscriptions update IndexedDB + React state for cross-device changes
- All note/tag operations are scoped to authenticated user via RLS
- Launch database hardening (`supabase/migrations/launch_security_hardening.sql`) resets core RLS policies, removes public table-read share policies, enforces encrypted-only note rows, caps share writes at 30 days, and revokes normal-client access to global SECURITY DEFINER cleanup/migration functions
- Tags support many-to-many relationship with notes
- Tag filtering uses AND logic (notes must have ALL selected tags)
- **Search**: Filters `displayNotes` by debounced query (title + plaintext content). Tag toggle preserves search query. Progressive rendering suspends during search so all matches render at once. Search-empty state shows "No thoughts found" (distinct from library-empty "Your notes await"). `Ctrl+Shift+K` focuses search bar.
- **Progressive rendering**: Each `ChapterSection` shows 6 cards initially (`INITIAL_CARD_COUNT`), loads 6 more via IntersectionObserver sentinel with drain loop for tall viewports. Fingerprint-based reset (`notes.map(id).join`). Chapters force-expand during search.
- User's full name is stored in Supabase `user_metadata.full_name`
- Password recovery detected via Supabase `PASSWORD_RECOVERY` auth event
- Google/GitHub OAuth use Supabase's `signInWithOAuth` with redirect back to app origin
- Account deletion re-auth for Google/GitHub accounts uses a server-verified email OTP before minting the deletion confirmation token; typed-email confirmation is not valid proof.
- OAuth-first layout: OAuth buttons appear FIRST, then "or continue with email" divider, then email form
- Production OAuth requires Supabase Site URL and Redirect URLs to match deployment domain
- Current production build sizing (2026-06-21): main bundle 778.61KB (240.48KB gzip), Editor lazy chunk 443.26KB (133.96KB gzip), views/modals in separate chunks. Treat the main-bundle regression as a performance follow-up, not a launch security blocker.
- Auth component supports modal mode (`isModal` prop) for landing page overlay

## Deployment

### Service Worker Updates
`registerType` in `vite.config.ts` must stay `'autoUpdate'`. Under `'prompt'` a new worker
parks in `waiting` until the page posts `SKIP_WAITING` — and a client running stale code
cannot post it, so browsers stay pinned to an old precached shell indefinitely (this is what
stranded clients on pre-hardening code against a migrated database).
Registration is explicit in `src/utils/serviceWorkerUpdates.ts`, not vite-plugin-pwa's
injected script, so the update path is testable. `npm run e2e:sw` guards it against a
real build in a real browser: it installs a worker, swaps in a new deployment with the
tab still open, and asserts the client moves to it. The main `npm run e2e` suite cannot
cover this — it runs against the dev server, which produces no service worker, which is
why the original breakage went unnoticed. Mid-session activation can invalidate lazy
chunk URLs; `lazyWithRetry` plus the `unhandledrejection` handler in `main.tsx` recover with
one cooldown-guarded reload.

### Production (Vercel)
- **URL:** https://yidhan.vercel.app
- **Host:** Vercel (auto-deploys from `main` branch)
- **Config:** `vercel.json` — rewrites for `/s/*` share routes, app-wide security headers (CSP, Referrer-Policy, frame/object restrictions), and no-store cache headers on shared note pages
- **Environment Variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN` (optional)

### Supabase Auth Configuration (for OAuth)
When deploying to a new domain, update in Supabase Dashboard → Authentication → URL Configuration:
1. **Site URL:** Set to your production domain (e.g., `https://yidhan.vercel.app`)
2. **Redirect URLs:** Add your production domain (keep localhost for local dev)

### Native App (Capacitor)

Yidhan can be built as a native Android app using Capacitor. The same React codebase is wrapped in a native WebView.

**Requirements:** Android Studio (Android builds), Xcode on macOS (iOS builds — not available on Windows)

```bash
npm run cap:android     # Open in Android Studio
npm run cap:android:run # Run on connected device/emulator
npm run cap:sync        # Sync web assets after code changes
```

- `capacitor.config.ts` - Capacitor configuration
- `android/` - Android Studio project (gitignore excludes build artifacts)

See `docs/plans/capacitor-implementation-plan.md` for detailed setup guide.

## Security

### Input Validation
- **File imports:** Max 10MB file size, max 1000 notes per import
- **Tag names:** 1-20 characters, validated client and server-side
- **JSON imports:** Strict schema validation with `ValidationError` class
- **Note titles:** Sanitized with DOMPurify to prevent XSS

### Sanitization Functions (`src/utils/sanitize.ts`)
- `sanitizeHtml(html)` - Sanitize rich HTML content (allows safe tags), strips arbitrary classes and unsafe inline styles, preserves safe `text-align` on supported block elements, and adds `rel="noopener noreferrer"` to external links
- `sanitizeText(text)` - Strip HTML and escape special characters
- `escapeHtml(text)` - Escape HTML special characters only

### Error Handling
- Auth errors are sanitized in `Auth.tsx` to prevent information disclosure
- Technical error messages are mapped to user-friendly messages
- Generic fallback for unrecognized errors

### End-to-End Encryption (E2EE)
- **Key derivation:** Argon2id via `hash-wasm` (parallelism=1, iterations=3, memory=64MB, hashLength=64)
- **Encryption:** AES-256-GCM with AAD (`noteId:userId`) prevents note-swapping attacks
- **Conflict detection:** HMAC-SHA-256 content hash replaces plaintext comparison in sync engine
- **Key storage:** React state in `EncryptionContext` + sessionStorage for tab-refresh persistence (raw key bytes exported/imported via `exportSessionKeys`/`importSessionKeys`). Optional localStorage persistence via "Remember this browser" (opt-in, default off). `SessionKeyBlob` v2 includes FNV-1a checksum for corruption detection (not a cryptographic MAC — `verifyKeyCheck()` is the security gate). Legacy v1 blobs accepted and auto-upgraded to v2 on successful restore.
- **Remember this browser:** When enabled, persists `SessionKeyBlob` in localStorage (survives browser restarts). All restore paths, including refresh-time `sessionStorage`, verify `encryption_key_check` before unlocking to detect stale keys after passphrase change. Key-check metadata is versioned; v2 binds the ciphertext to `userId` via AES-GCM AAD, and legacy key-checks auto-upgrade after a successful verify. Activity-gated restore after auto-lock keeps keys out of memory during idle. Cleared on manual lock, sign-out, or user switch. **Fails closed:** if localStorage is unavailable (quota exceeded, privacy mode), the preference is not enabled and the user sees an inline error.
- **Vault lock:** Manual lock button + configurable auto-lock timer (0/15/60 min idle). Lock reason differentiates behavior: `auto-lock` preserves localStorage (silent re-unlock on user return), `manual`/`sign-out` clears all storage.
- **Passphrase entry hardening:** Returning-user unlock applies a short client-side lockout after repeated failures, and first-time setup enforces a 12-character minimum plus strength policy in both UI and `EncryptionContext`.
- **Reliability telemetry:** Sentry breadcrumbs/reports track hydration starts/failures, blocked sync entries, vault restore issues, note decryption failures, and shared-link decryption failures.
- **What's encrypted:** Title + content as JSON blob in `encrypted_payload`
- **What's NOT encrypted:** Tags (plaintext), metadata (timestamps, pinned)
- **Salt + key-check:** Stored in Supabase `user_metadata` for passphrase verification
- **Sentry:** Breadcrumb scrubber strips encrypted fields before sending to Sentry
- **Share as Letter:** E2EE-compatible sharing via capability links. Per-share random AES-256-GCM key in URL fragment (`#k=<base64url>`). Server stores only ciphertext via `fetch_shared_note` RPC. Max 30-day TTL, soft-delete revocation. URL format: `/s/<token>/<slug>#k=<key>`
- **Database enforcement:** Public launch hardening requires server note rows to contain encrypted payload metadata and empty plaintext `title`/`content` columns. The launch migration intentionally fails if existing rows still violate that invariant.
- **Legacy repair status:** Pre-launch plaintext rows were repaired or removed before hardening. If preflight ever reports unsafe rows again, treat that as a data incident; the launch app should fail closed rather than expose a repair UI.
- **Account offboarding:** Self-serve "Letting Go" is enabled after production verification, a scheduler smoke test, and a throwaway-account deletion drill passed. Email/password users verify by password and Google/GitHub users verify by server-checked email OTP before a deletion request can be created. The scheduled service-role worker processes due requests, re-checks cancellation state, deletes app data, deletes the Supabase Auth user, and writes the audit trail.

### Password Policy
- Account passwords: minimum 8 characters (enforced in Auth.tsx and SettingsModal.tsx). E2EE passphrases: minimum 12 characters plus strength policy (enforced in PassphraseSetup.tsx and EncryptionContext.tsx).

### Database Security
- Row Level Security (RLS) enabled on all tables
- Users can only access their own notes and tags
- Core RLS policies are captured in `supabase/migrations/launch_security_hardening.sql`; public share access goes through the ciphertext-only `fetch_shared_note` RPC, not public table SELECT policies
- See `supabase/migrations/security_audit_checklist.sql` for audit queries

## Design Context

### Users
Reflective writers and minimalist professionals (age 25-50) who value aesthetics as much as functionality. They write for personal reflection, not productivity optimization. They're overwhelmed by feature-rich apps (Notion, Obsidian) and seek a calm, intentional digital space. Their context: capturing thoughts quickly, organizing naturally, accessing from any device.

### Brand Personality
**Calm, Intentional, Warm.** Yidhan speaks softly — never shouts, never sells. The voice is like a well-worn notebook: familiar, trustworthy, unpretentious. Language is organic ("Faded Notes" not "Trash", "Release" not "Delete"). The app recedes into the background, letting thoughts take center stage.

### Emotional Goals
Opening Yidhan should feel like:
1. **Relief & exhale** — walking into a quiet room after a noisy day
2. **Curiosity & delight** — discovering a beautifully crafted object you want to explore
3. **Trust & safety** — opening a personal journal that is private, secure, and yours

### Aesthetic Direction
- **Visual tone:** Japanese-inspired minimalism with warmth — think Muji store interiors, Kinfolk magazine spreads. Natural materials, generous whitespace, subtle texture.
- **References:** Muji (restraint, material honesty), Kinfolk (warm minimalism, editorial typography)
- **Anti-references:** Popular note-taking/writing apps (Notion, Obsidian, Bear, iA Writer, Apple Notes). Yidhan should NOT look or feel like any of them. No sidebar-heavy layouts, no feature density, no tech-forward aesthetics.
- **Signature elements:** Paper noise texture overlay, asymmetric wabi-sabi corners (`2px 24px 4px 24px`), manuscript glow on editor, aged-paper gradient on cards (3% accent warmth at bottom), spring-physics animations
- **Color philosophy:** Earthy, natural palette drawn from Japanese craft — terracotta, gold, forest, stone, sage, plum. Never neon, never cold blue. Dark themes use deep forest green (not pure black) with antique gold accents.

### Design Principles
1. **Restraint over features** — Every element must earn its place. When in doubt, leave it out. The app competes on restraint, not features.
2. **Warmth over precision** — Prefer organic, imperfect forms (asymmetric corners, textured surfaces) over pixel-perfect geometric rigidity. Wabi-sabi: beauty in imperfection.
3. **Calm over engagement** — No notifications, no gamification, no dark patterns. The interface should lower the user's heart rate, not raise it.
4. **Craft over convention** — Sweat the details that others skip: custom animations, thoughtful transitions, curated color palettes. Quality of execution signals respect for the user.
5. **Honesty over decoration** — Empty states are honest, not hidden. Surfaces feel like real materials (paper, glass). Elements have physical presence (shadows, depth) without gratuitous ornamentation.

### Accessibility Baseline
- **WCAG AA** across all themes (verified contrast ratios on all CTA/accent combinations)
- `prefers-reduced-motion` respected globally (animations collapse to 0.01ms)
- Focus-visible rings on all interactive elements
- iOS safe-area insets for notched devices
- 16px minimum font on mobile inputs (prevents iOS zoom)

## Database Migrations

SQL migrations are stored in `supabase/migrations/`:
- `create_welcome_note_trigger.sql`
- `security_audit_checklist.sql`
- `add_pinned_column.sql`
- `add_soft_delete.sql`
- `add_note_shares.sql`
- `add_shared_note_public_access.sql`
- `add_faded_notes_cleanup_cron.sql`
- `add_tags_updated_at.sql`
- `add_notes_updated_at_trigger.sql`
- `add_updated_at_indexes.sql`
- `expire_shares_for_e2ee.sql`
- `enable_e2ee_sharing.sql`
- `disable_welcome_note_trigger.sql` — replaced by client-side encrypted welcome
- `add_encryption_columns.sql`
- `add_restore_timestamps_rpc.sql`
- `fix_note_shares_rls_ownership.sql`
- `update_notes_display_updated_at.sql`
- `launch_security_hardening.sql`
- `add_account_deletion_workflow.sql`
- `default_user_id_to_auth_uid.sql` — **required.** Clients stopped sending `user_id` on note/tag inserts; without this default every create fails RLS (`42501`) or NOT NULL (`23502`) and blocks in the sync queue.
- `verify_migration_state.sql` — drift check. Run in the SQL editor after deploying; every row should read `applied`. Migrations are applied by hand, so a client shipped ahead of its migration fails silently on writes only.
