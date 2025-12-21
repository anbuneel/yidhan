# Soft-Delete Feature: Design Plan

## Conceptual Direction: "Faded Notes"

Rather than a utilitarian "Trash" concept, this feature embraces wabi-sabi's appreciation for impermanence and transience. Deleted notes become "faded" — still present but gently receding, like ink aging on paper. Recovery becomes an act of restoration, echoing the kintsugi philosophy of golden repair.

---

## Architecture Overview

### Database Changes

Add a `deleted_at` column to the `notes` table:

```sql
-- Migration: add_soft_delete.sql
ALTER TABLE notes ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Index for efficient filtering
CREATE INDEX idx_notes_deleted_at ON notes(deleted_at);
```

**Logic:**
- `deleted_at = NULL` → Active note (visible in library)
- `deleted_at = timestamp` → Soft-deleted (hidden, shown only in Faded Notes view)
- Auto-purge after 30 days (via scheduled function or on-demand cleanup)

---

## UI Components

### 1. Header Menu Addition

Add "Faded Notes" option to the profile dropdown menu between "Import Notes" and the separator before "Sign out":

```
┌──────────────────┐
│ ⚙ Settings       │
│──────────────────│
│ ↑ Export (JSON)  │
│ ↑ Export (MD)    │
│ ↓ Import Notes   │
│ ◐ Faded Notes    │  ← NEW (shows count badge if > 0)
│──────────────────│
│ → Sign out       │
└──────────────────┘
```

**Icon**: A faded/half-opacity circle or a feather dissolving — representing notes gently fading away.

---

### 2. Faded Notes View

A new view mode accessed from the header menu. Uses the same masonry layout as Library but with visual treatment showing these notes are in a liminal state.

```
┌─────────────────────────────────────────────────────────────┐
│ [←]  Faded Notes                              [Empty All]   │
│      Notes here will be permanently removed after 30 days   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ ░░░░░░░░░░░░░░░ │  │ ░░░░░░░░░░░░░░░ │   ← Faded cards  │
│  │ Note Title      │  │ Note Title      │     with reduced │
│  │ Preview...      │  │ Preview...      │     opacity      │
│  │                 │  │                 │                  │
│  │ [↻ Restore] [×] │  │ [↻ Restore] [×] │                  │
│  │ Deleted 2d ago  │  │ Deleted 5d ago  │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Visual Treatment for Faded Cards:**
- Reduced opacity (0.7)
- Subtle desaturation filter
- Slightly muted accent line (no hover animation)
- "Days remaining" indicator instead of "updated at"
- Warmer, aged paper tint overlay

---

### 3. Faded Note Card Component

A variant of `NoteCard` with:
- **Restore button**: Circular button with restore/undo icon (appears on hover, positioned where pin button was)
- **Permanent delete button**: Small × in bottom-right (appears on hover)
- **Time indicator**: "Deleted 2 days ago • 28 days left" format
- **Visual fade effect**: CSS filter for desaturation + reduced opacity

```tsx
// Visual styles
style={{
  opacity: 0.75,
  filter: 'saturate(0.7)',
}}
```

---

### 4. Delete Confirmation Update

Modify the existing delete confirmation to communicate soft-delete:

**Before (current):**
```
Delete "Note Title"?
[Cancel] [Delete]
```

**After:**
```
Move "Note Title" to Faded Notes?
It will be permanently removed after 30 days.
[Cancel] [Move to Faded]
```

Button text changes from "Delete" to "Move to Faded" — gentler language.

---

### 5. Empty State for Faded Notes

When no faded notes exist:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         ◐                                   │
│                                                             │
│              Nothing fading here                            │
│         Deleted notes will appear in this space             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## New Files Structure

```
src/
├── components/
│   ├── FadedNotesView.tsx      # Main faded notes page
│   ├── FadedNoteCard.tsx       # Card variant for deleted notes
│   └── ... (existing)
├── types.ts                    # Add 'faded' to ViewMode
└── services/
    └── notes.ts                # Add soft-delete functions
```

---

## Type Updates

```typescript
// types.ts
export type ViewMode = 'library' | 'editor' | 'changelog' | 'roadmap' | 'faded';

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  tags: Tag[];
  pinned: boolean;
  deletedAt?: Date | null;  // NEW
}
```

---

## Service Functions

```typescript
// services/notes.ts - New functions

// Soft delete (set deleted_at timestamp)
export async function softDeleteNote(id: string): Promise<void>

// Restore (clear deleted_at)
export async function restoreNote(id: string): Promise<void>

// Permanent delete
export async function permanentDeleteNote(id: string): Promise<void>

// Fetch only faded notes
export async function fetchFadedNotes(): Promise<Note[]>

// Empty all faded notes
export async function emptyFadedNotes(): Promise<void>

// Count faded notes (for badge)
export async function countFadedNotes(): Promise<number>
```

---

## Animation Details

### Card Fade-Out on Delete
When a note is soft-deleted from Library:
```css
@keyframes note-fade-out {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.95) translateY(10px); }
}
```

### Card Fade-In on Restore
When a note is restored:
```css
@keyframes note-restore {
  0% { opacity: 0.5; filter: saturate(0.5); }
  100% { opacity: 1; filter: saturate(1); }
}
```

---

## Color Palette for Faded State

**Light Theme (Kintsugi):**
- Card background: `rgba(255, 253, 250, 0.6)` — more transparent
- Text: `--color-text-tertiary` — muted
- Accent line: `opacity: 0.3`

**Dark Theme (Midnight):**
- Card background: `rgba(20, 30, 20, 0.4)` — more transparent
- Text: `--color-text-tertiary`
- Subtle golden hint on restore button (kintsugi reference)

---

## Implementation Priority

1. **Database migration** — Add `deleted_at` column
2. **Service layer** — Soft delete, restore, fetch faded
3. **Types update** — Add `deletedAt` to Note, `faded` to ViewMode
4. **FadedNoteCard component** — Card variant with restore/delete
5. **FadedNotesView component** — Full view with masonry grid
6. **Header menu update** — Add "Faded Notes" with count badge
7. **Update delete confirmation** — New copy and styling
8. **Animations** — Fade-out/restore transitions
9. **Auto-purge** — Supabase scheduled function (optional, can be Phase 2)

---

## Accessibility Considerations

- Restore/delete buttons have clear `aria-label` attributes
- "Days remaining" announced for screen readers
- Keyboard navigation preserved (Tab, Enter, Escape)
- Focus management when transitioning views

---

This design maintains the wabi-sabi philosophy by treating deletion as a gentle transition rather than abrupt destruction, and recovery as an act of mindful restoration.
