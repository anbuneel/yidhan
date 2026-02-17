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
- **Fonts:** Cormorant Garamond (display), Inter (body)

## Project Structure
```
src/
├── components/
│   ├── Auth.tsx           # Login/signup/Google OAuth/password reset UI (supports modal mode)
│   ├── ChangelogPage.tsx  # Version history page with categorized changes
│   ├── Editor.tsx         # Note editor with rich text + tag selector + save/sync indicator
│   ├── EditorToolbar.tsx  # Formatting toolbar for rich text editor (sticky in header zone)
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
│   ├── LandingPage.tsx    # Split-screen landing page with interactive demo
│   ├── LettingGoModal.tsx # Account departure modal with keepsakes export
│   ├── LoadingFallback.tsx # Shared loading spinner for Suspense boundaries
│   ├── Logo.tsx           # SVG logo image component (public asset reference)
│   ├── NoteCard.tsx       # Individual note card with tag badges
│   ├── ShareModal.tsx     # Modal for creating/managing share links
│   ├── SharedNoteView.tsx # Public read-only view for shared notes
│   ├── SyncIndicator.tsx  # Subtle offline/sync status indicator
│   ├── ConflictModal.tsx  # "Two Paths" conflict resolution modal
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
│   ├── SwipeableNoteCard.tsx # Note card wrapper with swipe gestures (delete/pin)
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
│   └── AuthContext.tsx    # Auth state management (login, signup, Google OAuth, password reset, profile, offboarding)
├── lib/
│   ├── supabase.ts        # Supabase client instance
│   └── offlineDb.ts       # Dexie IndexedDB schema for offline storage
├── services/
│   ├── notes.ts           # CRUD operations for notes (with tags)
│   ├── tags.ts            # CRUD operations for tags
│   ├── offlineNotes.ts    # Offline-aware note CRUD with sync queue
│   ├── offlineTags.ts     # Offline-aware tag operations
│   ├── syncEngine.ts      # Queue processor, conflict detection, sync
│   ├── demoStorage.ts     # localStorage operations for demo mode (no auth required)
│   └── demoMigration.ts   # Demo-to-account migration logic (handles tag dedup, note creation)
├── types/
│   └── database.ts        # Supabase DB types (notes, tags, note_tags, note_shares) with full schema
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
│   ├── useSessionSettings.ts # Session timeout & trusted device settings (per-user localStorage)
│   └── useKeyboardHeight.ts # Visual Viewport API for keyboard height tracking
├── utils/
│   ├── editorPosition.ts  # Cross-session cursor/scroll position persistence (localStorage)
│   ├── exportImport.ts    # Export/import utilities (JSON, Markdown) with validation
│   ├── formatTime.ts      # Relative time formatting
│   ├── lazyWithRetry.ts   # Smart lazy loading with retry and auto-reload on version updates
│   ├── sanitize.ts        # HTML/text sanitization (XSS prevention)
│   ├── temporalGrouping.ts # Group notes by time (Pinned, This Week, Last Week, etc.)
│   ├── updateBanner.ts    # Persistent update banner for chunk errors / app version updates
│   ├── validation.ts      # Note title/content validation and length limits
│   └── withRetry.ts       # Retry utility with exponential backoff and error discrimination
├── themes/
│   ├── index.ts           # Theme exports and utilities
│   ├── types.ts           # ThemeConfig type definitions
│   ├── kintsugi.ts        # Light theme: Kintsugi (current)
│   ├── midnight.ts        # Dark theme: Midnight (current)
│   ├── washi.ts           # Light theme: Washi (proposed)
│   └── mori.ts            # Dark theme: Mori (proposed)
├── test/
│   └── setup.ts           # Vitest test setup
├── App.tsx                # Main app component with state management
├── App.css                # Additional app styles
├── index.css              # Design system + Tiptap styles
├── types.ts               # App types (Note, Tag, Theme, ViewMode, TagColor)
└── main.tsx               # Entry point with AuthProvider and ErrorBoundary

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
The `check` script runs the same steps as GitHub Actions CI:
1. `typecheck` - TypeScript type checking
2. `lint` - ESLint
3. `test:run` - Vitest tests
4. `build` - Production build

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

1. **Author:** Claude (Opus 4.5)
2. **Date/Timestamp:** YYYY-MM-DD (date of creation)
3. **Original Prompt:** The user's original request (quoted in blockquote)

**Required header format for all AI-generated docs:**
```markdown
# [Document Title]

**Version:** 1.0
**Last Updated:** YYYY-MM-DD
**Status:** [Living Document | Complete | Draft]
**Author:** Claude (Opus 4.5)

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
- Toolbar buttons are in `EditorToolbar.tsx` (rendered in sticky zone by `Editor.tsx`)
- Editor content is in `RichTextEditor.tsx` (exposes editor via `onEditorReady` callback)
- Editor styles are in `index.css` under `.rich-text-editor`
- Add new Tiptap extensions via npm and configure in `RichTextEditor.tsx`

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
- Share as Letter functions are in `src/services/notes.ts`
- Demo/Practice Space (`/demo`): `src/services/demoStorage.ts`, `src/hooks/useDemoState.ts`, `src/pages/DemoPage.tsx`
- Demo-to-account migration runs on signup in `App.tsx` via `createNotesBatch()`

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
- **Settings:** `src/components/SettingsModal.tsx` (profile, password, security tabs + offboarding link)

## Notes
- Content is stored as HTML (from Tiptap's `getHTML()`)
- Notes sync in real-time via Supabase subscriptions
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
- `sanitizeHtml(html)` - Sanitize rich HTML content (allows safe tags)
- `sanitizeText(text)` - Strip HTML and escape special characters
- `escapeHtml(text)` - Escape HTML special characters only

### Error Handling
- Auth errors are sanitized in `Auth.tsx` to prevent information disclosure
- Technical error messages are mapped to user-friendly messages
- Generic fallback for unrecognized errors

### Password Policy
- Minimum 8 characters (enforced in Auth.tsx and SettingsModal.tsx)

### Database Security
- Row Level Security (RLS) enabled on all tables
- Users can only access their own notes and tags
- See `supabase/migrations/security_audit_checklist.sql` for audit queries

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
