# Yidhan

A calm, distraction-free note-taking app — where thoughts bloom with clarity.

**Live Demo:** [https://yidhan.vercel.app](https://yidhan.vercel.app)

![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)

## Features

- **Landing Page** - Split-screen design with sample note cards and "Explore" link to full Practice Space
- **Practice Space** - Full-featured demo at `/demo` without signup; notes persist in localStorage
- **Seamless Onboarding** - Demo content auto-saves after signup, email confirmation with resend options
- **Rich Text Editor** - Format your notes with bold, italic, headers, lists, quotes, code blocks, and task lists with checkboxes
- **Tag Organization** - Organize notes with colorful tags and filter by multiple tags
- **Tag Management** - Create, edit, and delete tags with a beautiful color picker
- **Beautiful Design** - Warm, paper-like aesthetics with asymmetric "wabi-sabi" card corners
- **Light & Dark Themes** - Kintsugi (warm light) and Midnight (forest green dark) themes
- **Cloud Sync** - Notes sync across devices via Supabase
- **Real-time Updates** - Changes appear instantly across tabs and devices
- **Export/Import** - Backup notes to JSON or Markdown, restore from backups
- **Rich Card Previews** - Note cards show formatted content (lists, bold, etc.)
- **Quick Delete** - Delete notes directly from card view with confirmation
- **Personalized Avatar** - Profile shows your initials from name or email
- **Settings Page** - Update display name, change password, toggle theme
- **Password Reset** - Forgot password flow with email recovery
- **Smart Auto-save** - Auto-saves 1.5s after you stop typing with "Saving..." → "Saved ✓" indicator
- **Google Sign-In** - Quick authentication via Google OAuth
- **Secure** - User authentication with row-level security
- **Error Boundary** - Graceful error handling with user-friendly recovery UI
- **Welcome Note** - New users receive a helpful onboarding note automatically
- **Security Hardened** - XSS prevention, input validation, sanitized error messages
- **Pin Notes** - Pin important notes to the top of your library
- **Toast Notifications** - Modern, non-intrusive feedback for all actions
- **Network Detection** - Alerts when you go offline or come back online
- **Error Monitoring** - Optional Sentry integration with privacy-aware session replay
- **Resilient Saves** - Auto-retry with exponential backoff, smart error handling (4xx fail fast, 5xx/network retry)
- **Test Coverage** - Comprehensive tests with Vitest, React Testing Library, and Playwright E2E tests
- **CI/CD Pipeline** - Automated testing and builds via GitHub Actions
- **Code Splitting** - Lazy-loaded editor for faster initial page loads
- **Sticky Toolbar** - Formatting toolbar stays visible while scrolling long notes
- **Slash Commands** - Type `/` for quick formatting: headings, lists, quotes, code blocks, timestamps, and more
- **Keyboard Shortcuts** - `Cmd/Ctrl+N` for new note, `Cmd/Ctrl+K` for search, `Escape` to go back
- **Note Timestamps** - Created and edited dates displayed in the editor
- **Public Changelog** - Browse version history and recent updates
- **Public Roadmap** - See what's coming next and features being explored
- **Footer Navigation** - Quick links to Changelog, Roadmap, and GitHub
- **PWA Support** - Install to home screen for app-like experience, offline UI shell loads instantly
- **Share Target** - Share text from other apps directly to Yidhan (Android/Chrome)
- **Install Prompt** - Friendly reminder to install after using the app
- **Offline Editing** - Notes persist locally with IndexedDB, automatic sync when back online
- **Conflict Resolution** - "Two Paths" modal for resolving concurrent edits across devices
- **Share as Letter** - Create temporary, read-only share links for your notes (1 day, 7 days, 30 days, or never expiring)
- **Swipe Gestures** - Swipe left to delete, right to pin/unpin notes (mobile)
- **Pull-to-Refresh** - Pull down on note list to sync notes (mobile)
- **iOS Install Guide** - Visual 3-step tutorial for iOS Safari PWA installation
- **iOS Spring Animations** - Native-feeling bouncy transitions on cards and modals
- **Card Entrance Animation** - Beautiful cascading reveal when notes load
- **Apple Splash Screens** - Branded launch images for all iOS devices (no white flash)

## Mobile & PWA

Yidhan is designed mobile-first with progressive enhancement toward native-like experiences:

| Platform | Status | Install Method |
|----------|--------|----------------|
| **Android (PWA)** | ✅ Fully supported | Chrome → Install prompt |
| **Android (Native)** | ✅ Capacitor ready | APK available |
| **iOS (PWA)** | ⚠️ Safari limitations | Safari → Add to Home Screen |
| **iOS (Native)** | 🚧 Planned | App Store (requires macOS build) |

**Current capabilities:**
- Offline editing with IndexedDB persistence
- Background sync when connection restored
- Share Target API (receive shared content on Android)
- View Transitions for smooth navigation
- Touch-optimized with 48px minimum targets

See [Mobile Gap Analysis](docs/analysis/mobile-ios-gap-analysis-claude.md) for detailed roadmap.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS v4
- **Rich Text:** Tiptap (ProseMirror)
- **Backend:** Supabase (PostgreSQL, Auth, Real-time)
- **Native:** Capacitor (Android ready, iOS planned)
- **Fonts:** Cormorant Garamond, Inter

## Documentation

- **[Product Requirements Document](docs/prd.md)** - Product vision, user personas, feature requirements, user flows, and success metrics
- **[Technical Specification](docs/technical-spec.md)** - System architecture, database schema, state management, security, and deployment

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/anbuneel/yidhan.git
   cd yidhan
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up Supabase
   - Create a new project at [supabase.com](https://supabase.com)
   - Run the SQL schema (see [Database Setup](#database-setup))
   - Copy your project URL and anon key

4. Configure environment variables
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Start the development server
   ```bash
   npm run dev
   ```

### Database Setup

Run this SQL in your Supabase SQL Editor:

```sql
-- Create notes table
create table notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default '',
  content text not null default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Create tags table
create table tags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text not null default 'stone',
  created_at timestamptz default now() not null,
  unique(user_id, name)
);

-- Create junction table for notes <-> tags
create table note_tags (
  note_id uuid references notes(id) on delete cascade not null,
  tag_id uuid references tags(id) on delete cascade not null,
  primary key (note_id, tag_id)
);

-- Enable Row Level Security
alter table notes enable row level security;
alter table tags enable row level security;
alter table note_tags enable row level security;

-- Notes policies
create policy "Users can view own notes" on notes for select using (auth.uid() = user_id);
create policy "Users can insert own notes" on notes for insert with check (auth.uid() = user_id);
create policy "Users can update own notes" on notes for update using (auth.uid() = user_id);
create policy "Users can delete own notes" on notes for delete using (auth.uid() = user_id);

-- Tags policies
create policy "Users can manage their own tags" on tags for all using (auth.uid() = user_id);

-- Note_tags policies
create policy "Users can manage their own note_tags" on note_tags for all using (
  exists (select 1 from notes where notes.id = note_tags.note_id and notes.user_id = auth.uid())
);

-- Indexes for performance
create index notes_user_id_idx on notes(user_id);
create index notes_updated_at_idx on notes(updated_at desc);
create index tags_user_id_idx on tags(user_id);
create index note_tags_note_id_idx on note_tags(note_id);
create index note_tags_tag_id_idx on note_tags(tag_id);
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Type check without emitting |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run check` | **Run before committing** - Full CI check (typecheck + lint + test + build) |
| `npm run e2e` | Run Playwright E2E tests |
| `npm run e2e:ui` | Open Playwright UI for interactive testing |
| `npm run e2e:headed` | Run E2E tests with visible browser |
| `npm run e2e:report` | View E2E test HTML report |

## Project Structure

```
src/
├── components/        # React components
│   ├── Auth.tsx           # Login/signup/Google OAuth/password reset
│   ├── ChangelogPage.tsx  # Public version history page
│   ├── Editor.tsx         # Note editor with rich text + tags
│   ├── EditorToolbar.tsx  # Sticky formatting toolbar
│   ├── ErrorBoundary.tsx  # Error boundary for graceful error handling
│   ├── Footer.tsx         # Footer with changelog/roadmap/GitHub links
│   ├── LandingPage.tsx    # Split-screen landing with interactive demo
│   ├── Header.tsx         # App header with search, profile menu
│   ├── Library.tsx        # Notes grid view
│   ├── SimpleHeader.tsx   # Simple header with clickable logo
│   ├── NoteCard.tsx       # Individual note card
│   ├── RichTextEditor.tsx # Tiptap editor wrapper
│   ├── RoadmapPage.tsx    # Public feature roadmap page
│   ├── SlashCommand.tsx   # Slash commands extension (headings, lists, formatting)
│   ├── SettingsModal.tsx  # Settings modal (profile, password, theme)
│   ├── TagBadge.tsx       # Small tag badge for note cards
│   ├── TagFilterBar.tsx   # Horizontal tag filter strip
│   ├── TagModal.tsx       # Modal for creating/editing tags
│   ├── TagPill.tsx        # Tag pill component
│   └── TagSelector.tsx    # Dropdown for assigning tags
├── contexts/          # React contexts (Auth)
├── data/              # Static data (changelog, roadmap)
├── hooks/             # Custom React hooks (useNetworkStatus)
├── lib/               # Supabase client
├── services/          # API services (notes, tags CRUD)
├── test/              # Test setup files
├── types/             # TypeScript types
├── utils/             # Utility functions (time formatting, export/import, sanitization)
└── index.css          # Design system & styles
```

## Export & Import

### Export Options (via Profile menu)
- **JSON** - Full backup including notes, tags, and metadata. Can be re-imported.
- **Markdown** - Human-readable combined `.md` file with all notes.

### Import Options
- **JSON** (`.json`) - Restore from backup, automatically creates missing tags
- **Markdown** (`.md`) - Import single note, extracts title from first `# Heading`

### Import Limits
- Maximum file size: 10MB
- Maximum notes per import: 1,000

## Design Philosophy

Yidhan embraces **wabi-sabi** - finding beauty in imperfection:

- **Asymmetric corners** on cards (`2px 24px 4px 24px`)
- **Warm, organic colors** - terracotta and antique gold accents
- **Curated tag palette** - 8 muted, earthy colors
- **Serif typography** for display text (Cormorant Garamond)
- **Subtle paper texture** overlay
- **Gentle animations** that feel natural

## Tag Colors

Tags use a curated wabi-sabi color palette:

| Color | Hex |
|-------|-----|
| Terracotta | `#C25634` |
| Gold | `#D4AF37` |
| Forest | `#3D5A3D` |
| Stone | `#8B8178` |
| Indigo | `#4A5568` |
| Clay | `#A67B5B` |
| Sage | `#87A878` |
| Plum | `#6B4C5A` |

## Deployment

This app is deployed on [Vercel](https://vercel.com). To deploy your own instance:

1. Fork this repository
2. Import to Vercel
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SENTRY_DSN` (optional - for error monitoring)
4. Update Supabase Auth settings:
   - Set **Site URL** to your Vercel domain
   - Add your Vercel domain to **Redirect URLs**

## Security

Yidhan implements several security measures:

- **XSS Prevention** - All user content (titles, imported data) is sanitized using DOMPurify
- **Input Validation** - File size limits, JSON schema validation, tag name length limits
- **Error Sanitization** - Technical errors are mapped to user-friendly messages
- **Password Policy** - Minimum 8 character passwords required
- **Row-Level Security** - Database policies ensure users can only access their own data

For security audits, see `supabase/migrations/security_audit_checklist.sql`.

## License

MIT
