# Implementation Plan: Share as Letter

**Author:** Claude (Opus 4.5)
**Date:** 2025-12-26
**Design Doc:** `docs/analysis/collaboration-feature-analysis-claude.md` (Option A)

---

## Overview

Add one-way note sharing via temporary, read-only links. Aligns with Zenote's wabi-sabi philosophy - like sending a handwritten letter.

---

## Architecture Decision

**Create `note_shares` table** with token-based public access.

- Each share has a unique token (32-char secure random)
- Optional expiration (7 days default, embraces impermanence)
- Public RLS policy allows unauthenticated access via valid token
- No analytics/tracking (quiet, not observed)

---

## Database Migration

**File:** `supabase/migrations/add_note_shares.sql`

```sql
CREATE TABLE note_shares (
  id uuid default gen_random_uuid() primary key,
  note_id uuid references notes(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  share_token varchar(32) unique not null,
  expires_at timestamptz,
  created_at timestamptz default now() not null,
  unique(note_id)  -- One active share per note
);

-- RLS policies
ALTER TABLE note_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own shares"
  ON note_shares FOR ALL
  USING (auth.uid() = user_id);

-- Public access to shared notes via token
CREATE POLICY "Public can view notes with valid share token"
  ON notes FOR SELECT
  USING (
    id IN (
      SELECT note_id FROM note_shares
      WHERE (expires_at IS NULL OR expires_at > now())
    )
  );
```

---

## Implementation Steps

### Phase 1: Database & Types

**Files:**
- `supabase/migrations/add_note_shares.sql` (NEW)
- `src/types/database.ts` - Add NoteShare type
- `src/types.ts` - Add `'shared'` to ViewMode

```typescript
// src/types/database.ts
export interface NoteShare {
  id: string;
  note_id: string;
  user_id: string;
  share_token: string;
  expires_at: string | null;
  created_at: string;
}
```

---

### Phase 2: Service Layer

**File:** `src/services/notes.ts`

Add functions:
```typescript
// Generate share link for a note
export async function createNoteShare(noteId: string, expiresInDays?: number): Promise<NoteShare>;

// Get existing share for a note (if any)
export async function getNoteShare(noteId: string): Promise<NoteShare | null>;

// Delete a share (revoke access)
export async function deleteNoteShare(noteId: string): Promise<void>;

// Fetch shared note by token (public, no auth)
export async function fetchSharedNote(token: string): Promise<Note | null>;
```

Token generation: Use `crypto.randomUUID().replace(/-/g, '')` for 32-char token.

---

### Phase 3: ShareModal Component

**File:** `src/components/ShareModal.tsx` (NEW)

```
┌─────────────────────────────────────────┐
│            Share as Letter          ✕   │
├─────────────────────────────────────────┤
│                                         │
│  Create a gentle, read-only view        │
│  for someone to receive.                │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ https://zenote.app/?s=abc123... │   │
│  │                        [Copy]   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Expires in: [7 days ▼]                 │
│                                         │
│  [Revoke Link]           [Done]         │
│                                         │
└─────────────────────────────────────────┘
```

Props:
```typescript
interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note;
}
```

Behavior:
- On open: Check if share exists, create if not
- Copy button: Copy link to clipboard, show toast
- Expiration dropdown: 1 day, 7 days, 30 days, Never
- Revoke: Delete share and close modal

---

### Phase 4: SharedNoteView Component

**File:** `src/components/SharedNoteView.tsx` (NEW)

Read-only, public view of a shared note:

```
┌─────────────────────────────────────────┐
│ [Zenote]                          [🌙]  │
├─────────────────────────────────────────┤
│                                         │
│  Note Title                             │
│  ─────────────────────────              │
│                                         │
│  [tag] [tag]                            │
│                                         │
│  Note content displayed read-only...    │
│                                         │
│                                         │
│        ─────────────────────            │
│        Shared quietly via Zenote        │
│                                         │
└─────────────────────────────────────────┘
```

Features:
- No editing controls
- Show tags (read-only badges)
- Show note content with formatting preserved
- Minimal footer attribution
- Handle expired/invalid tokens gracefully

---

### Phase 5: Editor Integration

**File:** `src/components/Editor.tsx`

Add to export dropdown menu (after copy options, before download options):

```typescript
{/* Share divider */}
<div className="my-1 mx-3" style={{ borderTop: '1px solid var(--glass-border)' }} />

{/* Share option */}
<button onClick={() => setShowShareModal(true)} ...>
  <ShareIcon />
  Share as Letter
</button>
```

Add state:
```typescript
const [showShareModal, setShowShareModal] = useState(false);
```

Render ShareModal at end of component.

---

### Phase 6: App.tsx URL Handling

**File:** `src/App.tsx`

1. Parse share token from URL on load:
```typescript
const [shareToken, setShareToken] = useState<string | null>(() => {
  const params = new URLSearchParams(window.location.search);
  return params.get('s');
});
```

2. If share token exists, fetch and display shared note:
```typescript
if (shareToken) {
  return (
    <SharedNoteView
      token={shareToken}
      theme={theme}
      onThemeToggle={handleThemeToggle}
      onInvalidToken={() => setShareToken(null)}
    />
  );
}
```

3. Clean URL after loading (optional):
```typescript
window.history.replaceState({}, '', window.location.pathname);
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/add_note_shares.sql` | CREATE | Database migration |
| `src/types/database.ts` | MODIFY | Add NoteShare type |
| `src/types.ts` | MODIFY | Add ViewMode if needed |
| `src/services/notes.ts` | MODIFY | Add share functions |
| `src/components/ShareModal.tsx` | CREATE | Share link modal |
| `src/components/SharedNoteView.tsx` | CREATE | Public read-only view |
| `src/components/Editor.tsx` | MODIFY | Add share button to menu |
| `src/App.tsx` | MODIFY | Handle share token in URL |
| `src/data/changelog.ts` | MODIFY | Add version entry |
| `CLAUDE.md` | MODIFY | Document feature |

---

## URL Format

Share URLs: `https://zenote.vercel.app/?s=<token>`

- Short query param `s` keeps URL clean
- Token is 32 characters (UUID without dashes)
- Example: `https://zenote.vercel.app/?s=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

---

## Wabi-sabi Alignment

- **Impermanence**: Links expire (7 days default)
- **One-way**: No comments, no reactions, no tracking
- **Quiet**: No view counts, no analytics shown to author
- **Solitude preserved**: Author doesn't know when/if note is viewed

---

## Testing Checklist

- [ ] Share button appears in Editor export menu
- [ ] ShareModal opens and generates link
- [ ] Copy button works and shows toast
- [ ] Expiration dropdown changes expiry
- [ ] Revoke button deletes share
- [ ] Share URL loads SharedNoteView
- [ ] Expired links show appropriate message
- [ ] Invalid tokens show error state
- [ ] Theme toggle works on shared view
- [ ] Tags display correctly (read-only)
- [ ] Mobile responsive

---

## Implementation Summary

**Status:** Completed
**Implemented:** 2025-12-26
**Version:** 1.9.0

### Files Created
- `supabase/migrations/add_note_shares.sql` - Database migration with RLS policies
- `src/components/ShareModal.tsx` - Modal for creating/managing share links
- `src/components/SharedNoteView.tsx` - Public read-only view for shared notes

### Files Modified
- `src/types/database.ts` - Added DbNoteShare type
- `src/types.ts` - Added NoteShare interface and 'shared' ViewMode
- `src/services/notes.ts` - Added 5 share functions (create, get, update, delete, fetch)
- `src/components/Editor.tsx` - Added share button to export menu, userId prop
- `src/App.tsx` - Added share token URL handling with SharedNoteView routing
- `src/data/changelog.ts` - Added v1.9.0 entry
- `CLAUDE.md` - Updated documentation (features, schema, services)
- `README.md` - Added share feature to features list

### Notes
- All checks passed (typecheck, lint, test, build)
- Feature follows wabi-sabi philosophy with impermanent, one-way sharing
- No analytics or tracking on shared views
