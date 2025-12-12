# Zenote - Project Context for Claude Code

## Overview
Zenote is a calm, distraction-free note-taking application inspired by Japanese stationery, Muji aesthetics, and architectural journals. It features a "wabi-sabi" design with asymmetric card corners, warm colors, and elegant typography.

**Live URL:** https://zenote.vercel.app
**Repository:** https://github.com/anbuneel/zenote

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4 with CSS custom properties
- **Rich Text:** Tiptap (ProseMirror-based)
- **Backend:** Supabase (PostgreSQL + Auth + Real-time)
- **Fonts:** Cormorant Garamond (display), Inter (body)

## Project Structure
```
src/
├── components/
│   ├── Auth.tsx           # Login/signup/Google OAuth/password reset UI with theme toggle
│   ├── Editor.tsx         # Note editor with rich text + tag selector + save indicator
│   ├── ErrorBoundary.tsx  # Error boundary for graceful error handling
│   ├── Header.tsx         # App header with search, profile menu, settings
│   ├── Library.tsx        # Notes grid view
│   ├── NoteCard.tsx       # Individual note card with tag badges
│   ├── RichTextEditor.tsx # Tiptap editor wrapper
│   ├── SettingsModal.tsx  # Settings modal (profile, password, theme)
│   ├── TagBadge.tsx       # Small tag badge for note cards
│   ├── TagFilterBar.tsx   # Horizontal tag filter strip with edit support
│   ├── TagModal.tsx       # Modal for creating/editing/deleting tags
│   ├── TagPill.tsx        # Tag pill component with edit button
│   └── TagSelector.tsx    # Dropdown for assigning tags in editor
├── contexts/
│   └── AuthContext.tsx    # Auth state management (login, signup, Google OAuth, password reset, profile)
├── lib/
│   └── supabase.ts        # Supabase client instance
├── services/
│   ├── notes.ts           # CRUD operations for notes (with tags)
│   └── tags.ts            # CRUD operations for tags
├── types/
│   └── database.ts        # Supabase DB types (notes, tags, note_tags) with full schema
├── utils/
│   ├── exportImport.ts    # Export/import utilities (JSON, Markdown) with validation
│   ├── formatTime.ts      # Relative time formatting
│   └── sanitize.ts        # HTML/text sanitization (XSS prevention)
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
npx tsc --noEmit # Type check without emitting
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
```

## Features Implemented
- [x] Wabi-sabi design with light/dark themes (dark default)
- [x] Card-based note library with responsive grid
- [x] Rich text editor (bold, italic, underline, headers, lists, quotes, code)
- [x] User authentication (email/password + Google OAuth) with full name capture
- [x] Supabase database integration
- [x] Real-time sync across tabs/devices
- [x] Note creation, editing, deletion
- [x] Delete notes directly from card view (with confirmation)
- [x] Auto-save with debounce and visual indicator
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

## Features Not Yet Implemented
- [ ] Test coverage (Vitest + Testing Library)
- [ ] Error monitoring (Sentry)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Code splitting (lazy load Tiptap editor)
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
- Toolbar buttons are in `RichTextEditor.tsx`
- Editor styles are in `index.css` under `.rich-text-editor`
- Add new Tiptap extensions via npm and configure in the editor

### Database changes
1. Update schema in Supabase SQL Editor
2. Update types in `src/types/database.ts`
3. Update service functions in `src/services/notes.ts` or `src/services/tags.ts`
4. Update app types in `src/types.ts` if needed

### Adding new tag features
- Tag service functions are in `src/services/tags.ts`
- Tag state is managed in `App.tsx`
- Tag components: `TagPill`, `TagBadge`, `TagFilterBar`, `TagSelector`, `TagModal`

## UI Layout

### Header (Three-Zone Layout)
```
[Zenote]        [    Search notes...  ⌘K    ]        [+ New Note] | [☀] [JD]
                                                                         ↓
                                                              ┌──────────────────┐
                                                              │ ⚙ Settings       │
                                                              │──────────────────│
                                                              │ ↑ Export (JSON)  │
                                                              │ ↑ Export (MD)    │
                                                              │ ↓ Import Notes   │
                                                              │──────────────────│
                                                              │ → Sign out       │
                                                              └──────────────────┘
```

### Editor Header (Breadcrumb with Save Indicator)
```
[Zenote] / [Note Title]                        [Unsaved/Saving...]  [🗑]
```

### Tag Filter Bar (below header)
```
[All Notes]  |  [Tag 1 ✏]  [Tag 2 ✏]  [Tag 3 ✏]  [+]
                    ↑ Edit button appears on hover
```

### Note Card
```
┌─────────────────────────────────┐
│                            [🗑] │  ← Delete button (appears on hover)
│ Note Title                      │
│                                 │
│ Rich content preview with       │
│ formatting preserved:           │
│ 1. Numbered lists               │
│ 2. Bold, italic text            │
│                                 │
│ [tag] [tag]          JUST NOW   │
└─────────────────────────────────┘
```

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

## Deployment

### Production (Vercel)
- **URL:** https://zenote.vercel.app
- **Host:** Vercel (auto-deploys from `main` branch)
- **Environment Variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

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
