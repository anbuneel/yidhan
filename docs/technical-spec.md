# Zenote - Technical Specification

**Version:** 1.0
**Last Updated:** 2025-12-29
**Status:** Living Document

---

## System Overview

Zenote is a React-based Single Page Application (SPA) with a Supabase backend providing PostgreSQL database, authentication, and real-time subscriptions.

### Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend Framework** | React | 19.2.0 |
| **Language** | TypeScript | 5.9.3 |
| **Build Tool** | Vite | 7.2.4 |
| **Styling** | Tailwind CSS | 4.1.17 |
| **Rich Text Editor** | Tiptap (ProseMirror) | 3.13.0 |
| **Layout** | react-masonry-css | 1.0.16 |
| **Backend** | Supabase | 2.86.2 |
| **Error Monitoring** | Sentry | 10.30.0 |
| **Unit Testing** | Vitest | 4.0.15 |
| **E2E Testing** | Playwright | 1.57.0 |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   React     │  │   Tiptap    │  │    react-masonry-css    │  │
│  │   19.2.0    │  │   Editor    │  │       Layout            │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                 │
│  ┌──────┴────────────────┴─────────────────────┴──────────────┐ │
│  │                    App State (App.tsx)                      │ │
│  │  • notes: Note[]  • tags: Tag[]  • view: ViewMode          │ │
│  │  • selectedNote   • searchQuery  • selectedTags            │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             │                                    │
│  ┌──────────────────────────┴──────────────────────────────────┐ │
│  │                    Service Layer                             │ │
│  │  • notes.ts (CRUD, soft-delete, shares)                     │ │
│  │  • tags.ts (CRUD, note associations)                        │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             │                                    │
│  ┌──────────────────────────┴──────────────────────────────────┐ │
│  │                 Supabase Client (supabase.ts)               │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
└─────────────────────────────┼───────────────────────────────────┘
                              │ HTTPS
┌─────────────────────────────┼───────────────────────────────────┐
│                      SUPABASE CLOUD                              │
├─────────────────────────────┼───────────────────────────────────┤
│  ┌──────────────┐  ┌────────┴───────┐  ┌─────────────────────┐  │
│  │   Auth       │  │   PostgreSQL   │  │    Real-time        │  │
│  │   (GoTrue)   │  │   Database     │  │    Subscriptions    │  │
│  └──────────────┘  └────────────────┘  └─────────────────────┘  │
│                                                                  │
│  Row Level Security (RLS) enforced on all tables                │
└──────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
App.tsx (State Container)
├── AuthProvider (Context)
│   └── AuthContext.tsx
├── ErrorBoundary
├── LandingPage (unauthenticated)
│   ├── HeaderShell
│   ├── Demo Editor
│   └── Auth Modal
├── ChapteredLibrary (authenticated - library view)
│   ├── Header
│   │   └── HeaderShell
│   ├── TagFilterBar
│   ├── ChapterNav (desktop)
│   ├── TimeRibbon (mobile)
│   └── ChapterSection[]
│       └── NoteCard[]
├── Editor (note editing view)
│   ├── HeaderShell
│   ├── EditorToolbar
│   ├── RichTextEditor
│   │   └── SlashCommand
│   ├── TagSelector
│   └── WhisperBack
├── FadedNotesView
│   ├── HeaderShell
│   └── FadedNoteCard[]
├── SharedNoteView (public, no auth)
├── ChangelogPage
├── RoadmapPage
└── Modals (lazy-loaded)
    ├── SettingsModal
    ├── TagModal
    ├── ShareModal
    └── LettingGoModal
```

---

## Data Models

### Database Schema

```sql
-- Notes table
CREATE TABLE notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',  -- HTML from Tiptap
  pinned BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL,  -- Soft-delete
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Tags table
CREATE TABLE tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'stone',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, name)
);

-- Junction table (many-to-many)
CREATE TABLE note_tags (
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (note_id, tag_id)
);

-- Share links table
CREATE TABLE note_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  share_token VARCHAR(32) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,  -- NULL = never expires
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(note_id)
);
```

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   users     │       │    notes    │       │    tags     │
│  (auth)     │       │             │       │             │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │──┐    │ id (PK)     │    ┌──│ id (PK)     │
│ email       │  │    │ user_id(FK) │←───┤  │ user_id(FK) │
│ metadata    │  │    │ title       │    │  │ name        │
└─────────────┘  │    │ content     │    │  │ color       │
                 │    │ pinned      │    │  └─────────────┘
                 │    │ deleted_at  │    │
                 │    │ created_at  │    │
                 │    │ updated_at  │    │
                 │    └──────┬──────┘    │
                 │           │           │
                 │    ┌──────┴──────┐    │
                 │    │  note_tags  │    │
                 │    ├─────────────┤    │
                 │    │ note_id(FK) │────┘
                 │    │ tag_id(FK)  │─────┘
                 │    └─────────────┘
                 │
                 │    ┌─────────────┐
                 │    │ note_shares │
                 │    ├─────────────┤
                 └───→│ user_id(FK) │
                      │ note_id(FK) │
                      │ share_token │
                      │ expires_at  │
                      └─────────────┘
```

### TypeScript Types

```typescript
// Application types (src/types.ts)
interface Note {
  id: string;
  title: string;
  content: string;  // HTML
  createdAt: Date;
  updatedAt: Date;
  tags: Tag[];
  pinned: boolean;
  deletedAt?: Date | null;
}

interface Tag {
  id: string;
  name: string;
  color: TagColor;
  createdAt: Date;
}

type TagColor =
  | 'terracotta' | 'gold' | 'forest' | 'stone'
  | 'indigo' | 'clay' | 'sage' | 'plum';

type ViewMode = 'library' | 'editor' | 'changelog' | 'roadmap' | 'faded';

interface NoteShare {
  id: string;
  noteId: string;
  userId: string;
  shareToken: string;
  expiresAt: Date | null;
  createdAt: Date;
}
```

---

## State Management

### Application State (App.tsx)

```typescript
// Core state
const [notes, setNotes] = useState<Note[]>([]);
const [tags, setTags] = useState<Tag[]>([]);
const [view, setView] = useState<ViewMode>('library');
const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

// UI state
const [searchQuery, setSearchQuery] = useState('');
const [selectedTags, setSelectedTags] = useState<string[]>([]);
const [theme, setTheme] = useState<Theme>('dark');

// Share state
const [shareToken, setShareToken] = useState<string | null>(null);
```

### Auth State (AuthContext)

```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (fullName: string) => Promise<void>;
  isPasswordRecovery: boolean;
  isDeparting: boolean;
  daysUntilRelease: number | null;
  initiateOffboarding: () => Promise<void>;
  cancelOffboarding: () => Promise<void>;
}
```

### Real-time Subscriptions

```typescript
// Notes subscription (App.tsx)
supabase
  .channel('notes-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'notes',
    filter: `user_id=eq.${userId}`,
  }, handleNoteChange)
  .subscribe();

// Tags subscription (similar pattern)
```

---

## Service Layer

### Notes Service (src/services/notes.ts)

| Function | Description |
|----------|-------------|
| `fetchNotes()` | Fetch all active notes with tags (JOIN) |
| `createNote(title, content)` | Create new note |
| `updateNote(id, title, content, tagIds)` | Update note with retry logic |
| `softDeleteNote(id)` | Set deleted_at timestamp |
| `restoreNote(id)` | Clear deleted_at |
| `permanentDeleteNote(id)` | Hard delete |
| `toggleNotePin(id, pinned)` | Toggle pin status |
| `searchNotes(query)` | Full-text search |
| `fetchFadedNotes()` | Get soft-deleted notes |
| `cleanupExpiredFadedNotes()` | Delete notes > 30 days |
| `createNoteShare(noteId, expiresInDays)` | Create share link |
| `fetchSharedNote(token)` | Public fetch by token |

### Tags Service (src/services/tags.ts)

| Function | Description |
|----------|-------------|
| `fetchTags()` | Fetch all tags for user |
| `createTag(name, color)` | Create new tag |
| `updateTag(id, name, color)` | Update tag |
| `deleteTag(id)` | Delete tag |
| `addTagToNote(noteId, tagId)` | Associate tag |
| `removeTagFromNote(noteId, tagId)` | Remove association |
| `subscribeToTags(callbacks)` | Real-time subscription |

### Retry Logic (src/utils/withRetry.ts)

```typescript
const result = await withRetry(
  () => saveNote(note),
  {
    maxAttempts: 3,
    baseDelay: 1000,
    shouldRetry: (error) => isRetryableError(error),
  }
);
```

**Error Discrimination:**
- 4xx errors: Fail fast (client error)
- 5xx errors: Retry with backoff
- Network errors: Retry with backoff

---

## Security Architecture

### Row Level Security (RLS)

```sql
-- Notes policy
CREATE POLICY "Users can only access own notes"
ON notes FOR ALL
USING (auth.uid() = user_id);

-- Tags policy
CREATE POLICY "Users can only access own tags"
ON tags FOR ALL
USING (auth.uid() = user_id);

-- Share tokens (public read)
CREATE POLICY "Anyone can read shares by token"
ON note_shares FOR SELECT
USING (true);
```

### Input Sanitization

| Function | Location | Purpose |
|----------|----------|---------|
| `sanitizeHtml()` | src/utils/sanitize.ts | Clean HTML (DOMPurify) |
| `sanitizeText()` | src/utils/sanitize.ts | Strip HTML, escape chars |
| `escapeHtml()` | src/utils/sanitize.ts | Escape special chars |

### Auth Error Sanitization

```typescript
// Prevent information disclosure
const sanitizeAuthError = (error: string): string => {
  if (error.includes('rate limit')) return 'Too many attempts';
  if (error.includes('network')) return 'Network error';
  if (error.includes('already registered')) return 'Account exists';
  return 'Authentication failed';
};
```

---

## Performance Optimizations

### Code Splitting

```typescript
// Lazy-loaded components (App.tsx)
const Editor = lazy(() => import('./components/Editor'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const TagModal = lazy(() => import('./components/TagModal'));
const ShareModal = lazy(() => import('./components/ShareModal'));
const FadedNotesView = lazy(() => import('./components/FadedNotesView'));
const SharedNoteView = lazy(() => import('./components/SharedNoteView'));
const ChangelogPage = lazy(() => import('./components/ChangelogPage'));
const RoadmapPage = lazy(() => import('./components/RoadmapPage'));
```

### Bundle Analysis

| Chunk | Size | Load |
|-------|------|------|
| Initial (index) | 333 KB | Immediate |
| Editor | 407 KB | Lazy |
| Vendor Supabase | 185 KB | Lazy |
| Vendor Sentry | 18 KB | Lazy |
| Vendor React | 4 KB | Lazy |
| **Total** | **994 KB** | |

### Auto-Save Optimization

```typescript
// Debounced save (1.5s after typing stops)
const debouncedSave = useMemo(
  () => debounce((note) => saveNote(note), 1500),
  []
);
```

---

## Authentication Flows

### Email/Password Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────→│ Supabase │────→│  Email   │
│  Signup  │     │   Auth   │     │  Verify  │
└──────────┘     └──────────┘     └──────────┘
                       │
                       ↓
              ┌──────────────┐
              │   Session    │
              │   Created    │
              └──────────────┘
```

### OAuth Flow (Google/GitHub)

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────→│ Supabase │────→│ Provider │
│  Button  │     │ Redirect │     │  Consent │
└──────────┘     └──────────┘     └──────────┘
                                       │
                       ┌───────────────┘
                       ↓
              ┌──────────────┐
              │   Callback   │
              │   + Session  │
              └──────────────┘
```

### Password Recovery Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Forgot  │────→│ Supabase │────→│  Email   │
│ Password │     │   Auth   │     │  Link    │
└──────────┘     └──────────┘     └──────────┘
                                       │
                       ┌───────────────┘
                       ↓
              ┌──────────────┐
              │ PASSWORD_    │
              │ RECOVERY     │
              │ Event        │
              └──────────────┘
                       │
                       ↓
              ┌──────────────┐
              │  New Pass    │
              │  Form        │
              └──────────────┘
```

---

## Error Handling

### Error Boundary

```typescript
// Catches React errors + chunk loading failures
class ErrorBoundary extends Component {
  componentDidCatch(error) {
    if (isChunkLoadError(error)) {
      // New deployment - auto refresh
      window.location.reload();
    } else {
      // Log to Sentry
      Sentry.captureException(error);
    }
  }
}
```

### Toast Notifications

```typescript
// Success/error feedback
toast.success('Note saved');
toast.error('Failed to save. Please try again.');
```

### Network Status

```typescript
// useNetworkStatus hook
const { isOnline } = useNetworkStatus();

// Show zen-style messages
if (!isOnline) {
  toast('Taking a moment offline...', { icon: '🌿' });
}
```

---

## Testing Strategy

### Unit Tests (Vitest)

| Category | Coverage |
|----------|----------|
| Components | Auth, Editor, HeaderShell, ChapteredLibrary, ShareModal, TagModal, TagBadge, ErrorBoundary |
| Utilities | formatTime, sanitize, temporalGrouping, exportImport, withRetry |
| Services | notes, tags |
| Hooks | useNetworkStatus |

### E2E Tests (Playwright)

| Spec File | Coverage |
|-----------|----------|
| auth.spec.ts | Login, signup, OAuth, password reset |
| notes.spec.ts | CRUD, pin, delete, search |
| tags.spec.ts | Create, edit, delete, filter |
| sharing.spec.ts | Create share, copy link, view shared |
| export-import.spec.ts | JSON/MD export, import |
| settings.spec.ts | Profile, password, theme |

### Test Commands

```bash
npm run test        # Watch mode
npm run test:run    # Single run
npm run e2e         # Playwright headless
npm run e2e:ui      # Playwright UI
npm run check       # Full CI: typecheck + lint + test + build
```

---

## Deployment Architecture

### Infrastructure

```
┌─────────────────────────────────────────────────────────┐
│                      VERCEL                              │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Edge      │  │   Build     │  │   Preview       │  │
│  │   CDN       │  │   Cache     │  │   Deployments   │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│                                                          │
│  Auto-deploy from main branch                           │
│  Preview deployments for PRs                            │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────┐
│                     SUPABASE                             │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  PostgreSQL │  │    Auth     │  │   Real-time     │  │
│  │  Database   │  │   (GoTrue)  │  │   (Phoenix)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────┐
│                      SENTRY                              │
├─────────────────────────────────────────────────────────┤
│  Error tracking, session replay (content masked)        │
└─────────────────────────────────────────────────────────┘
```

### Environment Variables

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx  # Optional
```

### CI/CD Pipeline (GitHub Actions)

```yaml
jobs:
  fast-checks:
    - npm run typecheck
    - npm run lint

  full-tests:
    - npm run test:run
    - npm run build

  claude-review:
    - AI code review
```

---

## PWA Configuration

### Capabilities

| Feature | Status |
|---------|--------|
| Installable | Yes |
| Offline App Shell | Yes |
| Background Sync | No (planned) |
| Push Notifications | No |

### Service Worker

```javascript
// Workbox configuration (vite-plugin-pwa)
{
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com/,
        handler: 'CacheFirst',
      },
    ],
  },
}
```

---

## Appendix

### File Structure

```
src/
├── components/          # React components (28)
├── contexts/            # React contexts (1)
├── data/                # Static data (changelog, roadmap)
├── hooks/               # Custom hooks (1)
├── lib/                 # External lib config (supabase)
├── services/            # API service layer (2)
├── test/                # Test setup
├── themes/              # Theme configurations (4)
├── types/               # TypeScript types
├── utils/               # Utility functions (5)
├── App.tsx              # Main component
├── App.css              # App styles
├── index.css            # Design system + Tiptap
├── main.tsx             # Entry point
└── types.ts             # Core types
```

### Key Metrics

| Metric | Value |
|--------|-------|
| Lines of Code | 20,178 |
| React Components | 34 |
| Unit Tests | 453 |
| E2E Specs | 6 |
| Bundle (initial) | 333 KB |
| Bundle (total) | 994 KB |

---

*This specification is reverse-engineered from the implemented system and serves as living documentation.*
