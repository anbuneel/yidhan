# Zenote - Project Context for Claude Code

## Overview
Zenote is a calm, distraction-free note-taking application inspired by Japanese stationery, Muji aesthetics, and architectural journals. It features a "wabi-sabi" design with asymmetric card corners, warm colors, and elegant typography.

**Live URL:** https://zenote.vercel.app
**Repository:** https://github.com/anbuneel/zenote

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4 with CSS custom properties
- **Rich Text:** Tiptap (ProseMirror-based)
- **Layout:** react-masonry-css (Pinterest-style card grid)
- **Backend:** Supabase (PostgreSQL + Auth + Real-time)
- **Fonts:** Cormorant Garamond (display), Inter (body)

## Project Structure
```
src/
├── components/
│   ├── Auth.tsx           # Login/signup/Google OAuth/password reset UI (supports modal mode)
│   ├── ChangelogPage.tsx  # Version history page with categorized changes
│   ├── Editor.tsx         # Note editor with rich text + tag selector + save indicator
│   ├── EditorToolbar.tsx  # Formatting toolbar for rich text editor (sticky in header zone)
│   ├── ErrorBoundary.tsx  # Error boundary for graceful error handling
│   ├── Footer.tsx         # Minimal footer with changelog/roadmap/GitHub links
│   ├── ChapteredLibrary.tsx # Temporal chapters note organization (Pinned, This Week, Last Week, etc.)
│   ├── ChapterNav.tsx     # Desktop dot navigation sidebar for chapter jumping
│   ├── ChapterSection.tsx # Collapsible chapter section with masonry grid
│   ├── FadedNoteCard.tsx  # Card for soft-deleted notes (restore/permanent delete)
│   ├── FadedNotesView.tsx # View for recovering soft-deleted notes
│   ├── TimeRibbon.tsx     # Mobile chapter scrubber navigation
│   ├── Header.tsx         # Library header with search, new note button (uses HeaderShell)
│   ├── HeaderShell.tsx    # Shared header component for consistent layout across all pages
│   ├── LandingPage.tsx    # Split-screen landing page with interactive demo
│   ├── Library.tsx        # Notes masonry grid view (legacy, replaced by ChapteredLibrary)
│   ├── NoteCard.tsx       # Individual note card with tag badges
│   ├── RichTextEditor.tsx # Tiptap editor content wrapper (toolbar extracted to EditorToolbar)
│   ├── RoadmapPage.tsx    # Public roadmap with status-grouped features
│   ├── SettingsModal.tsx  # Settings modal (profile, password, theme)
│   ├── TagBadge.tsx       # Small tag badge for note cards
│   ├── TagFilterBar.tsx   # Horizontal tag filter strip with edit support
│   ├── TagModal.tsx       # Modal for creating/editing/deleting tags
│   ├── TagPill.tsx        # Tag pill component with edit button
│   ├── TagSelector.tsx    # Dropdown for assigning tags in editor
│   └── WhisperBack.tsx    # Floating back button for long notes (scroll-triggered)
├── data/
│   ├── changelog.ts       # Version history data
│   └── roadmap.ts         # Roadmap items with status
├── contexts/
│   └── AuthContext.tsx    # Auth state management (login, signup, Google OAuth, password reset, profile)
├── lib/
│   └── supabase.ts        # Supabase client instance
├── services/
│   ├── notes.ts           # CRUD operations for notes (with tags)
│   └── tags.ts            # CRUD operations for tags
├── types/
│   └── database.ts        # Supabase DB types (notes, tags, note_tags) with full schema
├── hooks/
│   └── useNetworkStatus.ts # Network connectivity monitoring hook
├── utils/
│   ├── exportImport.ts    # Export/import utilities (JSON, Markdown) with validation
│   ├── formatTime.ts      # Relative time formatting
│   ├── sanitize.ts        # HTML/text sanitization (XSS prevention)
│   └── temporalGrouping.ts # Group notes by time (Pinned, This Week, Last Week, etc.)
├── test/
│   └── setup.ts           # Vitest test setup
├── App.tsx                # Main app component with state management
├── App.css                # Additional app styles
├── index.css              # Design system + Tiptap styles
├── types.ts               # App types (Note, Tag, Theme, ViewMode, TagColor)
└── main.tsx               # Entry point with AuthProvider and ErrorBoundary
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
npm run check    # Full CI check: typecheck + lint + test + build
```

## Development Workflow
**IMPORTANT:** Always run `npm run check` before committing to ensure CI will pass.

```bash
# 1. Make changes
# 2. Run full check (mirrors CI pipeline)
npm run check

# 3. If check passes, commit
git add . && git commit -m "your message"

# 4. Push
git push
```

The `check` script runs the same steps as GitHub Actions CI:
1. `typecheck` - TypeScript type checking
2. `lint` - ESLint
3. `test:run` - Vitest tests
4. `build` - Production build

## Documentation Updates

**IMPORTANT:** When making significant enhancements, fixes, or changes, update these files:

1. **`CLAUDE.md`** - Update relevant sections:
   - Features Implemented (add new features)
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

## Design System

### Themes
- **Light (Kintsugi):** Warm paper backgrounds, terracotta accent (#C25634)
- **Dark (Midnight):** Deep forest green, antique gold accent (#D4AF37) - **DEFAULT**

### CSS Variables (defined in index.css)
- `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary`
- `--color-text-primary`, `--color-text-secondary`
- `--color-accent`, `--color-accent-hover`, `--color-accent-glow`
- `--font-display` (Cormorant Garamond), `--font-body` (Inter)
- `--radius-card: 2px 24px 4px 24px` (asymmetric wabi-sabi corners)

### Tag Color Palette (Wabi-sabi)
- `terracotta` (#C25634), `gold` (#D4AF37), `forest` (#3D5A3D)
- `stone` (#8B8178), `indigo` (#4A5568), `clay` (#A67B5B)
- `sage` (#87A878), `plum` (#6B4C5A)

## Database Schema (Supabase)
```sql
-- Notes table
create table notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default '',
  content text not null default '',  -- Stores HTML from Tiptap
  pinned boolean default false not null,  -- Pin notes to top of library
  deleted_at timestamptz default null,  -- Soft-delete timestamp (null = active, set = faded)
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Tags table
create table tags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text not null default 'stone',
  created_at timestamptz default now() not null,
  unique(user_id, name)
);

-- Junction table for many-to-many (notes <-> tags)
create table note_tags (
  note_id uuid references notes(id) on delete cascade not null,
  tag_id uuid references tags(id) on delete cascade not null,
  primary key (note_id, tag_id)
);

-- Row Level Security on all tables
-- Users can only access their own notes and tags
```

## Environment Variables
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx  # Optional - leave empty to disable
```

## Features Implemented
- [x] Wabi-sabi design with light/dark themes (dark default)
- [x] Card-based note library with responsive grid
- [x] Rich text editor (bold, italic, underline, headers, lists, quotes, code, task lists)
- [x] User authentication (email/password + Google OAuth) with full name capture
- [x] Supabase database integration
- [x] Real-time sync across tabs/devices
- [x] Note creation, editing, deletion
- [x] Delete notes directly from card view (with confirmation)
- [x] Auto-save with debounce (1.5s after typing stops) and "Saving..." → "Saved ✓" indicator
- [x] Search functionality (Cmd/Ctrl+K)
- [x] Tag-based organization (multiple tags per note)
- [x] Tag filtering (filter bar below header, clears search)
- [x] Tag creation, editing, and deletion with color picker
- [x] Profile avatar with user initials (from name or email)
- [x] Export notes (JSON backup, Markdown)
- [x] Import notes (JSON restore, Markdown files) with loading overlay
- [x] Rich HTML preview in note cards (preserves formatting)
- [x] Breadcrumb navigation in editor (Zenote / Note Title)
- [x] Password reset flow (forgot password + email recovery)
- [x] Settings modal (display name, password change, theme toggle)
- [x] Loading states for tag operations (create/update/delete)
- [x] Duplicate tag name prevention (client-side validation)
- [x] Error boundary for graceful error handling
- [x] Production deployment on Vercel
- [x] Welcome note for new users (via database trigger)
- [x] Security hardening (XSS prevention, input validation, error sanitization)
- [x] Pin notes to top of library (pin button top-left, delete moved to bottom-right)
- [x] Test coverage (Vitest + Testing Library)
- [x] CI/CD pipeline (GitHub Actions)
- [x] Code splitting (lazy load Tiptap editor)
- [x] Error monitoring (Sentry)
- [x] Toast notifications (react-hot-toast)
- [x] Network connectivity detection (offline/online alerts)
- [x] Landing page with interactive demo (split-screen, localStorage persistence)
- [x] Mobile responsive landing page and auth modal
- [x] Sticky formatting toolbar in editor (stays visible while scrolling)
- [x] Created/edited timestamps displayed below note title
- [x] Smart cursor focus (title for new notes, end of content for existing, position preserved on tab switch)
- [x] Slash commands (/date, /time, /now, /divider) for quick inserts
- [x] Keyboard shortcut Cmd/Ctrl+N to create new note
- [x] Public changelog page (version history with categorized changes)
- [x] Public roadmap page (status-grouped feature plans)
- [x] Footer navigation (Changelog · Roadmap · GitHub links)
- [x] Soft-delete notes ("Faded Notes" - 30-day recovery window)
- [x] Faded Notes view with restore and permanent delete options
- [x] Temporal Chapters (automatic grouping: Pinned, This Week, Last Week, This Month, Earlier, Archive)
- [x] Collapsible chapter sections with note counts and preview titles
- [x] Chapter navigation: Desktop dot sidebar + Mobile time ribbon scrubber
- [x] Mobile-responsive header (compact search bar, reduced spacing)
- [x] Tag filter bar with dynamic scroll fade indicators
- [x] Compact tag pills on mobile screens
- [x] Global overflow prevention for mobile devices
- [x] Integrated editor breadcrumb (logo + note title in same zone for visual continuity)
- [x] Organic footer in editor ("Return to notes" link at end of content)
- [x] WhisperBack floating button (appears when scrolled, thumb-friendly on mobile)

## Features Not Yet Implemented
- [ ] Additional OAuth providers (GitHub, etc.)
- [ ] Offline support / PWA
- [ ] Image attachments
- [ ] Virtual scrolling for large note lists
- [ ] Analytics

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

### Soft-delete (Faded Notes) service functions
Located in `src/services/notes.ts`:
- `softDeleteNote(id)` - Set deleted_at timestamp (moves to Faded Notes)
- `restoreNote(id)` - Clear deleted_at (restores to library)
- `permanentDeleteNote(id)` - Hard delete from database
- `fetchFadedNotes()` - Get all soft-deleted notes for current user
- `countFadedNotes()` - Get count for badge display
- `emptyFadedNotes()` - Permanently delete all faded notes

## UI Layout

### Landing Page (Split-Screen)

**Desktop (≥768px):**
```
┌─────────────────────────────────┬─────────────────────────────────────────────┐
│ Zenote                          │                          [🌙] [Sign In]     │
├─────────────────────────────────┼─────────────────────────────────────────────┤
│                                 │  ┌─────────────┐  ┌─────────────┐          │
│  A quiet space                  │  │ Sample Note │  │ Sample Note │          │
│  for your mind.                 │  │ [tag] TIME  │  │ [tag] TIME  │          │
│                                 │  └─────────────┘  └─────────────┘          │
│  The distraction-free...        │  ┌─────────────────────────────────┐       │
│                                 │  │ Try it here              [DEMO] │       │
│  [Start Writing]  For free      │  │                                 │       │
│                                 │  │ Start typing...                 │       │
│                                 │  └─────────────────────────────────┘       │
└─────────────────────────────────┴─────────────────────────────────────────────┘
```

**Mobile (<768px):**
```
┌─────────────────────────────┐
│ Zenote          [🌙] [In]   │  ← Unified header
├─────────────────────────────┤
│                             │
│   A quiet space             │
│   for your mind.            │
│                             │
│   [Start Writing]  For free │
│                             │
├─────────────────────────────┤
│   Try it here        [DEMO] │
│                             │
│   Start typing...           │
│                             │
└─────────────────────────────┘
```

- Left panel (45%): Hero section with value prop and CTA
- Right panel (55%): Sample note cards + interactive demo editor
- Demo content persists to localStorage (zenote-demo-content)
- Auth opens as modal overlay (responsive, scrollable on mobile)
- Mobile: Stacked layout, sample cards hidden, unified header

### HeaderShell (Consistent Three-Zone Layout)

All pages use `HeaderShell` component for pixel-perfect header consistency:
```
[Zenote]        [    Center Content    ]        [☀] [JD]
  ↑                      ↑                         ↑
 Logo              Page-specific             Theme + Avatar
(fixed)             (flexible)               (fixed position)
```

**Library Header (Desktop):**
```
[Zenote]   [  Search...  ⌘K  ] [+ New Note]   [☀] [JD ↓]
                                                    │
                                          ┌─────────┴─────────┐
                                          │ ⚙ Settings        │
                                          │───────────────────│
                                          │ ↑ Export (JSON)   │
                                          │ ↑ Export (MD)     │
                                          │ ↓ Import Notes    │
                                          │ ⏱ Faded Notes     │
                                          │───────────────────│
                                          │ → Sign out        │
                                          └───────────────────┘
```

**Library Header (Mobile - Two Rows):**
```
Row 1: [Zenote]                    [+] [☀] [JD]
Row 2: [         Search...          ]
```
- New Note button moved to Row 1 for quick access
- Search bar gets full width on Row 2

**Editor Header (Desktop):**
```
[Zenote / Note Title]                    [Saving.../Saved ✓] [🗑] | [☀] [JD]
     ↑                                          ↑
 Left Zone                                Right Actions
(logo + breadcrumb integrated)          (save status + delete)
```

**Editor Header (Mobile):**
```
Row 1: [Zenote]                         [Saving...] [🗑] [☀] [JD]
Row 2: [Note Title]
```

**Landing/Public Pages:**
```
[Zenote]                                         [☀] [Sign In]
```

**HeaderShell Props by Page:**

| Page | Left Content | Center Content | Right Actions | Menu Sections |
|------|--------------|----------------|---------------|---------------|
| Library | - (default logo) | Search bar | New Note button | Export, Import, Faded Notes |
| Editor | Logo + Breadcrumb | Mobile: Note title | Save status + Delete | - |
| Landing | - (default logo) | - | - | - |
| Changelog | - (default logo) | - | - | - |
| Roadmap | - (default logo) | - | - | - |

### Keyboard Shortcuts
| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd/Ctrl + N` | Create new note | Library |
| `Cmd/Ctrl + K` | Focus search | Library |
| `Escape` | Save and go back | Editor |
| `Cmd/Ctrl + B` | Bold | Editor |
| `Cmd/Ctrl + I` | Italic | Editor |
| `Cmd/Ctrl + U` | Underline | Editor |

### Slash Commands (type `/` in editor)
| Command | Inserts |
|---------|---------|
| `/date` | Current date (e.g., "Dec 16, 2024") |
| `/time` | Current time (e.g., "3:30 PM") |
| `/now` | Date and time (e.g., "Dec 16, 2024 at 3:30 PM") |
| `/divider` | Horizontal line |

### Tag Filter Bar (below header)

**Desktop (2 rows collapsed, expandable):**
```
[All Notes]  |  [Tag 1 ✏]  [Tag 2 ✏]  [Tag 3 ✏]  [Tag 4 ✏]  [Tag 5 ✏]
              [Tag 6 ✏]  [Tag 7 ✏]  [+]  [+3 ▼]
                                          ↑ Expand button (if >2 rows)
```

**Mobile (all tags visible, wrapped):**
```
[All Notes]  |  [Tag 1]  [Tag 2]
              [Tag 3]  [Tag 4]  [+]
```
- Mobile shows all tags in wrapping layout (no collapse)
- Desktop shows 2 rows by default with expand/collapse if more tags exist
- Edit button appears on hover (desktop only)

### Note Card
```
┌─────────────────────────────────┐
│ Note Title                  [📌]│  ← Pin button (top-right, appears on hover)
│                                 │
│ Rich content preview with       │
│ formatting (4-line clamp)...    │
│                                 │
│ [tag] [tag]    JUST NOW    [🗑] │  ← Delete button (appears on hover)
└─────────────────────────────────┘

Card design: Compact "editorial index card" style
- Padding: 24px sides, 20px bottom (p-6 pb-5)
- Title: 1.25rem serif font
- Preview: CSS line-clamp (4 lines)
- Grid: Masonry-style (items-start) - cards size to content

Pinned notes:
- Pin icon is always visible and filled with accent color
- Sorted to appear first in the library
```

### Temporal Chapters (Note Organization)
```
┌─────────────────────────────────────────────────────────────┐
│ ▼ Today                                            2 notes  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐                          │
│  │ Note Card   │  │ Note Card   │                          │
│  └─────────────┘  └─────────────┘                          │
├─────────────────────────────────────────────────────────────┤
│ ▶ This Week                                        5 notes  │
│   Note A · Note B · Note C ...                              │
├─────────────────────────────────────────────────────────────┤
│ ▶ This Month                                       8 notes  │
│   Note X · Note Y · Note Z ...                              │
└─────────────────────────────────────────────────────────────┘
```
- Notes automatically grouped by time (Pinned, This Week, Last Week, This Month, Earlier, Archive)
- Empty chapters are not rendered ("Honest Presence" pattern)
- Collapsed state shows first 3 note titles as preview
- Each chapter has its own masonry grid

### Faded Notes View
```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Notes                              [Empty All]    │
├─────────────────────────────────────────────────────────────┤
│                      Faded Notes                            │
│           Notes here will be permanently                    │
│           removed after 30 days                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Note Title                                          │   │
│  │ Deleted 3 days ago · 27 days left                   │   │
│  │ [Restore] [Delete Forever]                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```
- Accessed via "Faded Notes" in profile menu (shows badge count)
- Cards show deletion time and days remaining
- Restore returns note to library
- "Delete Forever" permanently removes note
- "Empty All" permanently deletes all faded notes

### Footer (Library & Landing Page)
```
              Changelog  ·  Roadmap  ·  GitHub
```
- Subtle links at bottom of page
- Text: 12px, tertiary color
- Accent color on hover
- Public pages accessible without login

### Changelog Page
```
┌─────────────────────────────────────────────────────────────┐
│ ← Back                                                      │
├─────────────────────────────────────────────────────────────┤
│                      What's New                             │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ v1.3.0                               Dec 18, 2024     │  │
│  │ ✦ Feature: Public changelog and roadmap pages        │  │
│  │ ↑ Improvement: Enhanced descriptions                  │  │
│  │ ✓ Fix: Bug fixes                                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│              Changelog  ·  Roadmap  ·  GitHub               │
└─────────────────────────────────────────────────────────────┘
```
- Change icons: ✦ (feature), ↑ (improvement), ✓ (fix)
- Data stored in `src/data/changelog.ts`

### Roadmap Page
```
┌─────────────────────────────────────────────────────────────┐
│ ← Back                                                      │
├─────────────────────────────────────────────────────────────┤
│                       Roadmap                               │
│       What we're building and exploring next                │
│                                                             │
│  Coming Soon ─────────────────────────────────────────────  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Feature Title                         [Coming Soon]   │  │
│  │ Description of the feature                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│              Changelog  ·  Roadmap  ·  GitHub               │
└─────────────────────────────────────────────────────────────┘
```
- Status badges: In Progress (gold), Coming Soon (terracotta), Exploring (stone)
- Data stored in `src/data/roadmap.ts`

## Export/Import

### Export Formats
- **JSON**: Full backup with notes, tags, and metadata. Can be re-imported.
- **Markdown**: Combined `.md` file with all notes (human-readable)

### Import Formats
- **JSON** (`.json`): Restore full backup, creates missing tags automatically
- **Markdown** (`.md`): Import single note, extracts title from `# Heading`

### Utilities
Export/import functions are in `src/utils/exportImport.ts`:
- `exportNotesToJSON()` / `parseImportedJSON()`
- `htmlToMarkdown()` / `markdownToHtml()`
- `downloadFile()` / `readFileAsText()`

## AuthContext API
The `AuthContext` provides these functions:
- `signIn(email, password)` - Log in with email/password
- `signInWithGoogle()` - Log in with Google OAuth (redirects to Google)
- `signUp(email, password, fullName)` - Create account with display name
- `signOut()` - Log out current user
- `resetPassword(email)` - Send password reset email
- `updatePassword(newPassword)` - Update password (after recovery or authenticated)
- `updateProfile(fullName)` - Update display name in user metadata
- `isPasswordRecovery` - Boolean indicating if user arrived via recovery link
- `clearPasswordRecovery()` - Clear recovery state after password update

## Settings Modal
The Settings modal (`SettingsModal.tsx`) has two tabs:
- **Profile Tab:** Email (read-only), display name input, theme toggle button
- **Password Tab:** New password + confirmation with validation (min 8 chars)

## Notes
- Content is stored as HTML (from Tiptap's `getHTML()`)
- Theme preference persists in localStorage (`zenote-theme`)
- Notes sync in real-time via Supabase subscriptions
- All note/tag operations are scoped to authenticated user via RLS
- Tags support many-to-many relationship with notes
- Tag filtering uses AND logic (notes must have ALL selected tags)
- Tag filtering clears active search to avoid confusion
- User's full name is stored in Supabase `user_metadata.full_name`
- Profile avatar shows initials (first+last name, or first letter of email)
- Password recovery detected via Supabase `PASSWORD_RECOVERY` auth event
- TagModal shows loading spinners during async create/update/delete operations
- Import operations show a loading overlay with spinner
- Google OAuth uses Supabase's `signInWithOAuth` with redirect back to app origin
- Google sign-in button appears on login and signup screens with "or" divider
- ErrorBoundary wraps the entire app to catch and display runtime errors gracefully
- Production OAuth requires Supabase Site URL and Redirect URLs to match deployment domain
- Toast notifications use react-hot-toast with theme-aware styling
- Network status monitored via useNetworkStatus hook (shows offline/online toasts)
- Sentry error monitoring enabled when VITE_SENTRY_DSN is configured
- Editor component is lazy-loaded to reduce initial bundle size (~384KB saved)
- Landing page shows for unauthenticated users with interactive demo
- Auth component supports modal mode (`isModal` prop) for landing page overlay

## Deployment

### Production (Vercel)
- **URL:** https://zenote.vercel.app
- **Host:** Vercel (auto-deploys from `main` branch)
- **Environment Variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN` (optional)

### Supabase Auth Configuration (for OAuth)
When deploying to a new domain, update in Supabase Dashboard → Authentication → URL Configuration:
1. **Site URL:** Set to your production domain (e.g., `https://zenote.vercel.app`)
2. **Redirect URLs:** Add your production domain (keep localhost for local dev)

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