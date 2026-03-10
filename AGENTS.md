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
- **Fonts:** Cormorant Garamond (display), Source Sans 3 (body)

## Project Structure
```
src/
├── components/
│   ├── Auth.tsx           # Login/signup/Google OAuth/password reset UI (supports modal mode)
│   ├── ChangelogPage.tsx  # Version history page with categorized changes
│   ├── Editor.tsx         # Note editor with rich text + tag selector + save/sync indicator + E2EE sharing + focus mode + mobile bottom toolbar + manuscript glow
│   ├── PassphraseSetup.tsx # First-time E2EE passphrase setup screen + 4 starter notes + Recipes tag
│   ├── PassphraseSetup.test.tsx # 10 tests: form validation, setup flow, starter notes + tag, error states
│   ├── PassphraseUnlock.tsx # Returning user E2EE unlock screen
│   ├── PassphraseUnlock.test.tsx # 12 tests: unlock flow, error states, sign-out, remember browser
│   ├── EditorToolbar.tsx  # Formatting toolbar (variant: 'inline' desktop / 'bottom' mobile, HeadingCycleButton, OverflowMenu with direction)
│   ├── EditorSidebar.tsx  # Vertical sidebar toolbar (≥1100px) — frosted glass, 10 formatting buttons + focus mode toggle
│   ├── ErrorBoundary.tsx  # Error boundary with chunk error detection (deployment handling)
│   ├── Footer.tsx         # Minimal footer with changelog/roadmap/shortcuts/GitHub links
│   ├── KeyboardShortcutsModal.tsx # Help modal showing all keyboard shortcuts and gestures
│   ├── SessionTimeoutModal.tsx # Session timeout warning modal (zen "session fading" messaging)
│   ├── ChapteredLibrary.tsx # Temporal chapters note organization (Pinned, This Week, Last Week, etc.)
│   ├── ChapterNav.tsx     # Desktop dot navigation sidebar for chapter jumping
│   ├── ChapterSection.tsx # Collapsible chapter section with masonry grid
│   ├── FadedNoteCard.tsx  # Card for soft-deleted notes (restore/permanent delete)
│   ├── FadedNotesView.tsx # View for recovering soft-deleted notes
│   ├── TimeRibbon.tsx     # Mobile chapter scrubber navigation
│   ├── Header.tsx         # Library header with search, new note button (uses HeaderShell)
│   ├── HeaderShell.tsx    # Shared header component for consistent layout across all pages
│   ├── InstallPrompt.tsx  # Zen-styled PWA install prompt (shown after engagement)
│   ├── LandingPage.tsx    # Split-screen landing page with showcase cards + writing surface vignette
│   ├── LettingGoModal.tsx # Account departure modal with keepsakes export
│   ├── LoadingFallback.tsx # Shared loading spinner for Suspense boundaries
│   ├── Logo.tsx           # SVG logo image component (public asset reference)
│   ├── NoteCard.tsx       # Individual note card with tag badges
│   ├── ShareModal.tsx     # Modal for creating/managing E2EE share links (capability-link model)
│   ├── ShareModal.test.tsx # 18 tests: rendering, create flow, revoke, modal interactions
│   ├── SharedNoteView.tsx # Public read-only view with client-side decryption for shared notes
│   ├── SyncIndicator.tsx  # Subtle offline/sync status indicator
│   ├── ConflictModal.tsx  # "Two Paths" conflict resolution modal
│   ├── ConflictModal.test.tsx # 17 tests: rendering, resolution buttons, escape, backdrop, error recovery
│   ├── ReloadPrompt.tsx   # PWA service worker update prompt (non-disruptive refresh banner)
│   ├── RichTextEditor.tsx # Tiptap editor content wrapper (toolbar extracted to EditorToolbar)
│   ├── RoadmapPage.tsx    # Public roadmap with status-grouped features
│   ├── SettingsModal.tsx  # Settings modal (profile, password, security tab, theme, offboarding)
│   ├── SlashCommand.tsx   # Tiptap slash command extension (/, timestamps, dividers)
│   ├── ReAuthModal.tsx    # Re-authentication modal for sensitive actions (step-up auth)
│   ├── TagBadge.tsx       # Small tag badge for note cards
│   ├── TagFilterBar.tsx   # Horizontal tag filter strip with edit support
│   ├── TagModal.tsx       # Modal for creating/editing/deleting tags
│   ├── TagPill.tsx        # Tag pill component with edit button
│   ├── TagSelector.tsx    # Dropdown for assigning tags in editor
│   ├── WelcomeBackPrompt.tsx # Prompt shown when departing user signs in during grace period
│   ├── WhisperBack.tsx    # Floating back button for long notes (scroll-triggered)
│   ├── IOSInstallGuide.tsx # Visual 3-step tutorial for iOS Safari PWA installation
│   ├── SwipeableNoteCard.tsx # Note card wrapper with swipe gesture (pin/unpin only)
│   ├── PullToRefresh.tsx  # Pull-to-refresh wrapper with spring physics
│   ├── GestureHint.tsx    # One-time swipe gesture tutorial overlay (mobile)
│   ├── BottomSheet.tsx    # iOS-style bottom sheet modal component
│   └── demo/              # Demo mode components (Practice Space)
│       ├── ImpermanenceRibbon.tsx # Subtle banner reminding notes aren't saved to cloud
│       └── InvitationModal.tsx    # Soft signup prompt ("A Gentle Invitation")
├── pages/
│   ├── DemoPage.tsx       # Full-featured demo experience at /demo route
│   └── LogoTestPage.tsx   # Logo preview page for testing across themes
├── data/
│   ├── changelog.ts       # Version history data
│   └── roadmap.ts         # Roadmap items with status
├── contexts/
│   ├── AuthContext.tsx    # Auth state management (login, signup, Google OAuth, password reset, profile, offboarding)
│   └── EncryptionContext.tsx # E2EE key management (derive, unlock, lock, memory-only key storage)
├── lib/
│   ├── encryption.ts      # Core E2EE crypto: Argon2id + AES-256-GCM + HMAC-SHA-256 + share encryption
│   ├── __tests__/
│   │   ├── encryption.test.ts # 12 crypto unit tests (roundtrip, tamper, wrong key/AAD)
│   │   └── shareEncryption.test.ts # 26 tests: base64url, token/key gen, encrypt/decrypt roundtrip, AAD
│   ├── supabase.ts        # Supabase client instance + fetchAllPaginated helper
│   └── offlineDb.ts       # Dexie IndexedDB schema for offline storage (v4 with encryption fields)
├── services/
│   ├── notes.ts           # CRUD operations for notes (with tags) + E2EE share functions
│   ├── notes.test.ts      # 64 tests: CRUD, search, soft-delete, share encryption, RPC
│   ├── tags.ts            # CRUD operations for tags
│   ├── offlineNotes.ts    # Offline-aware note CRUD with sync queue + realtime upserts
│   ├── offlineNotes.test.ts # 37 tests: offline CRUD, sync queue, server upsert
│   ├── offlineTags.ts     # Offline-aware tag operations
│   ├── offlineTags.test.ts  # 18 tests: create/update/delete, dedup, queue compaction
│   ├── encryptedNotes.ts  # Encrypt/decrypt wrapper over offlineNotes (E2EE service layer)
│   ├── encryptedNotes.test.ts # 25 tests: roundtrip, batch, key mismatch, AAD binding
│   ├── syncEngine.ts      # Queue processor, HMAC conflict detection, encrypted push/pull sync
│   ├── syncEngine.test.ts # 42 tests: processQueue, pause/resume, conflict, pull, fullSync
│   ├── demoStorage.ts     # localStorage operations for demo mode (4 starter notes + 3 tags, no auth required)
│   ├── demoMigration.ts   # Demo-to-account migration logic (handles tag dedup, encrypted note creation)
│   └── demoMigration.test.ts # 9 tests: empty state, encrypted notes, tag dedup, sanitization
├── types/
│   └── database.ts        # Supabase DB types (notes, tags, note_tags, note_shares, fetch_shared_note RPC)
├── hooks/
│   ├── useNetworkStatus.ts # Network connectivity monitoring (singleton pattern)
│   ├── useSyncEngine.ts    # Sync engine React integration, conflict resolution
│   ├── useSyncStatus.ts    # Sync state for UI (pending count, online status)
│   ├── useViewTransition.ts # View Transitions API wrapper for smooth page transitions
│   ├── useInstallPrompt.ts  # PWA install prompt with engagement tracking
│   ├── useShareTarget.ts    # Handle incoming shares from Share Target API
│   ├── useDemoState.ts      # React state management for demo mode (localStorage)
│   ├── useSoftPrompt.ts     # Soft prompt trigger logic (note count + time thresholds)
│   ├── useMobileDetect.ts   # Touch device detection (useMobileDetect, useTouchCapable)
│   ├── useSessionTimeout.ts # Session inactivity monitor (configurable timeout with warning)
│   ├── useSessionTimeout.test.ts # 13 tests: timeout, warning, activity reset, cleanup
│   ├── useSessionSettings.ts # Session timeout & trusted device settings (per-user localStorage)
│   ├── useSessionSettings.test.ts # 24 tests: localStorage persistence, 90-day TTL, effective timeout
│   ├── useKeyboardHeight.ts # Visual Viewport API for keyboard height tracking
│   ├── useVaultSettings.ts  # Per-user vault settings (auto-lock minutes, remember browser)
│   ├── useVaultSettings.test.ts # 11 tests: defaults, persistence, user switching, key cleanup
│   ├── useIdleTimer.ts      # Simple idle timer hook (fires onIdle after N minutes of inactivity)
│   └── useIdleTimer.test.ts # 9 tests: timer fire, disable, activity reset, cleanup
├── utils/
│   ├── editorPosition.ts  # Cross-session cursor/scroll position persistence (localStorage)
│   ├── exportImport.ts    # Export/import utilities (JSON, Markdown) with validation
│   ├── formatTime.ts      # Relative time formatting
│   ├── lazyWithRetry.ts   # Smart lazy loading with retry and auto-reload on version updates
│   ├── sanitize.ts        # HTML/text sanitization (XSS prevention)
│   ├── temporalGrouping.ts # Group notes by time (Pinned, This Week, Last Week, etc.)
│   ├── updateBanner.ts    # Persistent update banner for chunk errors / app version updates
│   ├── validation.ts      # Note title/content validation and length limits
│   ├── validation.test.ts # 17 tests: title sanitization, XSS, length limits, unicode
│   └── withRetry.ts       # Retry utility with exponential backoff and error discrimination
├── themes/
│   ├── index.ts           # Theme exports and utilities
│   ├── types.ts           # ThemeConfig type definitions
│   ├── kintsugi.ts        # Light theme: Kintsugi (current)
│   ├── midnight.ts        # Dark theme: Midnight (current)
│   ├── washi.ts           # Light theme: Washi (proposed)
│   └── mori.ts            # Dark theme: Mori (proposed)
├── test/
│   └── setup.ts           # Vitest test setup (localStorage/sessionStorage mocks, Web Crypto polyfill)
├── App.tsx                # Main app component with state management (passphrase gate, encrypted note calls)
├── App.css                # Additional app styles
├── index.css              # Design system + Tiptap styles
├── types.ts               # App types (Note, Tag, Theme, ViewMode, TagColor) + encryption fields
└── main.tsx               # Entry point with AuthProvider, EncryptionProvider, Sentry breadcrumb scrubbing

e2e/
├── fixtures.ts            # Playwright test fixtures and helpers
├── auth.spec.ts           # Authentication E2E tests
├── notes.spec.ts          # Note CRUD E2E tests
├── tags.spec.ts           # Tag management E2E tests
├── sharing.spec.ts        # Share link E2E tests
├── export-import.spec.ts  # Export/Import E2E tests
└── settings.spec.ts       # Settings E2E tests
```

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
npm run theme:generate  # Generate CSS from active themes
npm run theme:preview   # Preview theme CSS without updating
npm run icons:generate  # Generate PWA icons from SVG source
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
   - Project Structure (add new files/components)
   - UI Layout (document new UI patterns)
   - Any affected documentation sections

2. **`README.md`** - Update if changes affect:
   - Installation instructions
   - Usage examples
   - Feature descriptions visible to users

3. **`src/data/changelog.ts`** - Add new version entry with:
   - Version number (semantic versioning)
   - Date
   - Changes array with type ('feature' | 'improvement' | 'fix') and description

4. **`docs/prd.md`** - Update when implementing key features:
   - Move features from "Planned" to "Implemented" sections
   - Add new user flows for major features
   - Update glossary with new terminology
   - Update technical constraints if architecture changes

Note: `AGENTS.md` is synced from `CLAUDE.md`. Run `npm run docs:sync-agents` (or `npm run docs:sync-agents:check` in CI). A pre-commit hook in `.githooks/pre-commit` keeps it updated when `core.hooksPath` is set to `.githooks`.

Example changelog entry:
```typescript
{
  version: '1.x.0',
  date: '2025-XX-XX',
  changes: [
    { type: 'feature', text: 'Description of new feature' },
    { type: 'improvement', text: 'Description of improvement' },
    { type: 'fix', text: 'Description of bug fix' },
  ],
},
```

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
- Demo/Practice Space (`/demo`): `src/services/demoStorage.ts`, `src/hooks/useDemoState.ts`, `src/pages/DemoPage.tsx`
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
- **E2EE**: Title + content encrypted as JSON blob using AES-256-GCM with AAD (`noteId:userId`). Tags remain plaintext. Keys derived from passphrase via Argon2id (`hash-wasm` WASM). Keys held in React state + sessionStorage (survives refresh, cleared on tab close/signout/vault lock).
- Notes sync via offline-first architecture: IndexedDB (Dexie) → sync queue → Supabase (all payloads encrypted)
- Sync engine: incremental pull (cursor-based), paginated fetches, server-authoritative timestamps
- Server-side `notes_updated_at_trigger` prevents client clock skew issues
- Self-echo suppression via `pendingMutations` set prevents realtime re-applying own changes
- Realtime subscriptions update IndexedDB + React state for cross-device changes
- All note/tag operations are scoped to authenticated user via RLS
- Tags support many-to-many relationship with notes
- Tag filtering uses AND logic (notes must have ALL selected tags)
- User's full name is stored in Supabase `user_metadata.full_name`
- Password recovery detected via Supabase `PASSWORD_RECOVERY` auth event
- Google/GitHub OAuth use Supabase's `signInWithOAuth` with redirect back to app origin
- OAuth-first layout: OAuth buttons appear FIRST, then "or continue with email" divider, then email form
- Production OAuth requires Supabase Site URL and Redirect URLs to match deployment domain
- Extensive code splitting reduces initial bundle (596KB → 332KB, -44%):
  - Editor: lazy-loaded (415KB chunk)
  - Views: ChangelogPage, RoadmapPage, FadedNotesView, SharedNoteView
  - Modals: SettingsModal, LettingGoModal, TagModal
  - Vendors: Supabase (189KB), Sentry (18KB), React (4KB) in separate chunks
- Auth component supports modal mode (`isModal` prop) for landing page overlay

## Deployment

### Production (Vercel)
- **URL:** https://yidhan.vercel.app
- **Host:** Vercel (auto-deploys from `main` branch)
- **Config:** `vercel.json` — rewrites for `/s/*` share routes, security headers (CSP, Cache-Control, Referrer-Policy) on shared note pages
- **Environment Variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN` (optional)

### Supabase Auth Configuration (for OAuth)
When deploying to a new domain, update in Supabase Dashboard → Authentication → URL Configuration:
1. **Site URL:** Set to your production domain (e.g., `https://yidhan.vercel.app`)
2. **Redirect URLs:** Add your production domain (keep localhost for local dev)

### Native App (Capacitor)

Yidhan can be built as a native Android app using Capacitor. The same React codebase is wrapped in a native WebView.

**Requirements:**
- Android Studio (for Android builds)
- Xcode on macOS (for iOS builds - not available on Windows)

**Development:**
```bash
npm run cap:android     # Open in Android Studio
npm run cap:android:run # Run on connected device/emulator
npm run cap:sync        # Sync web assets after code changes
```

**Project structure:**
- `capacitor.config.ts` - Capacitor configuration
- `android/` - Android Studio project (gitignore excludes build artifacts)

**Distribution options:**
- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Play Store: Requires $25 one-time Google Play Developer fee
- App Store (iOS): Requires $99/year Apple Developer fee + Mac

See `docs/plans/capacitor-implementation-plan.md` for detailed setup guide.

## Security

### Input Validation
- **File imports:** Max 10MB file size, max 1000 notes per import
- **Tag names:** 1-20 characters, validated client and server-side
- **JSON imports:** Strict schema validation with `ValidationError` class
- **Note titles:** Sanitized with DOMPurify to prevent XSS

### Sanitization Functions (`src/utils/sanitize.ts`)
- `sanitizeHtml(html)` - Sanitize rich HTML content (allows safe tags), adds `rel="noopener noreferrer"` to external links
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
- **Key storage:** React state in `EncryptionContext` + sessionStorage for tab-refresh persistence (raw key bytes exported/imported via `exportSessionKeys`/`importSessionKeys`). Optional localStorage persistence via "Remember this browser" (opt-in, default off).
- **Remember this browser:** When enabled, persists `SessionKeyBlob` in localStorage (survives browser restarts). Keys verified against `encryption_key_check` on restore to detect stale keys after passphrase change. Activity-gated restore after auto-lock (keys stay out of memory during idle). Cleared on manual lock, sign-out, or user switch.
- **Vault lock:** Manual lock button + configurable auto-lock timer (0/15/60 min idle). Lock reason differentiates behavior: `auto-lock` preserves localStorage (silent re-unlock on user return), `manual`/`sign-out` clears all storage.
- **What's encrypted:** Title + content as JSON blob in `encrypted_payload`
- **What's NOT encrypted:** Tags (plaintext), metadata (timestamps, pinned)
- **Salt + key-check:** Stored in Supabase `user_metadata` for passphrase verification
- **Sentry:** Breadcrumb scrubber strips encrypted fields before sending to Sentry
- **Share as Letter:** E2EE-compatible sharing via capability links. Per-share random AES-256-GCM key in URL fragment (`#k=<base64url>`). Server stores only ciphertext via `fetch_shared_note` RPC. Max 30-day TTL, soft-delete revocation. URL format: `/s/<token>/<slug>#k=<key>`

### Password Policy
- Minimum 8 characters (enforced in Auth.tsx and SettingsModal.tsx)

### Database Security
- Row Level Security (RLS) enabled on all tables
- Users can only access their own notes and tags
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
- `create_welcome_note_trigger.sql` - Auto-creates welcome note for new users
- `security_audit_checklist.sql` - RLS audit queries and rate limiting docs
- `add_pinned_column.sql` - Add pinned column to notes table
- `add_soft_delete.sql` - Add deleted_at column for soft-delete feature
- `add_note_shares.sql` - Add note_shares table for "Share as Letter" feature
- `add_shared_note_public_access.sql` - RLS policy for unauthenticated shared note viewing
- `add_faded_notes_cleanup_cron.sql` - Cron job for auto-deleting expired faded notes (requires Pro plan)
- `add_tags_updated_at.sql` - Add updated_at column to tags table for incremental sync
- `add_notes_updated_at_trigger.sql` - Server-side trigger enforcing updated_at on notes (clock-skew prevention)
- `add_updated_at_indexes.sql` - Composite indexes on (user_id, updated_at) for incremental sync queries
- `expire_shares_for_e2ee.sql` - Delete all share links (E2EE prerequisite)
- `enable_e2ee_sharing.sql` - Re-enable sharing with E2EE: encrypted_payload, iv, encryption_version, revoked_at columns + fetch_shared_note RPC
- `disable_welcome_note_trigger.sql` - Remove server-side welcome note trigger (replaced by client-side encrypted welcome)
- `add_encryption_columns.sql` - Add encrypted_payload, encryption_iv, encryption_version, content_hash columns
- `add_restore_timestamps_rpc.sql` - RPC to restore note timestamps after E2EE migration (bypasses updated_at trigger)
- `fix_note_shares_rls_ownership.sql` - Add WITH CHECK to enforce note ownership on note_shares INSERT/UPDATE (prevents DoS via UNIQUE constraint)
