# Yidhan UI Layout Reference

Detailed ASCII diagrams for UI components. Referenced from CLAUDE.md for detailed layout work.

## Landing Page (Split-Screen)

**Desktop (≥768px):**
```
┌─────────────────────────────────┬─────────────────────────────────────────────┐
│ Yidhan                          │                          [🌙] [Sign In]     │
├─────────────────────────────────┼─────────────────────────────────────────────┤
│                                 │  ┌─────────────┐  ┌─────────────┐          │
│  A quiet space                  │  │ Sample Note │  │ Sample Note │          │
│  for your notes.                │  │ [tag] TIME  │  │ [tag] TIME  │          │
│                                 │  └─────────────┘  └─────────────┘          │
│  The distraction-free...        │  ┌─────────────┐  ┌─────────────┐          │
│                                 │  │ Sample Note │  │ Sample Note │          │
│  [Start Writing]  For free      │  │ [tag] TIME  │  │ [tag] TIME  │          │
│                                 │  └─────────────┘  └─────────────┘          │
│  or explore without signing up→ │                                            │
│                                 │                                            │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─         │                                            │
│  ✦ Open source                  │                                            │
│  ✦ Works offline                │                                            │
│  ✦ Your data stays yours        │                                            │
└─────────────────────────────────┴─────────────────────────────────────────────┘
```

**Mobile (<768px):**
```
┌─────────────────────────────────┐
│ Yidhan            [🌙] [Sign In]│
├─────────────────────────────────┤
│                                 │
│   A quiet space                 │
│   for your notes.               │
│                                 │
│   [Start Writing]  For free     │
│                                 │
│   or explore first →            │
│                                 │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│   ✦ Open source                 │
│   ✦ Works offline               │
│   ✦ Your data stays yours       │
│                                 │
│   ┌─────────────────────────┐   │
│   │ Sample Note             │   │
│   │ [tag]            TIME   │   │
│   └─────────────────────────┘   │
│                                 │
│   Changelog · Roadmap · GitHub  │
└─────────────────────────────────┘
```

- True 50-50 split on desktop (each panel has its own header)
- Left panel: Hero + CTA + secondary "explore" link + trust signals
- Right panel: 4 static sample note cards in 2x2 grid (no interactive demo)
- Secondary CTA links to /demo (Practice Space / "Explore" mode)
- Trust signals: Open source, Works offline, Your data stays yours
- Auth opens as modal overlay (responsive, scrollable on mobile)
- Mobile: Stacked layout with single sample card

## Auth Modal (OAuth-First Layout)

```
┌─────────────────────────────────────┐
│               Yidhan                │
│           Welcome back              │
│                                     │
│  ┌─────────────┐ ┌─────────────┐    │
│  │   Google    │ │   GitHub    │    │  ← OAuth buttons FIRST
│  └─────────────┘ └─────────────┘    │
│                                     │
│  ──── or continue with email ────   │
│                                     │
│  Email                              │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Password                           │
│  ┌─────────────────────────────┐    │
│  │                             │    │  ← Forgot password? (login only)
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │         Sign In             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Don't have an account? Sign Up     │
└─────────────────────────────────────┘
```

- OAuth buttons appear first (faster signup path)
- "or continue with email" divider below OAuth
- Email form is secondary option
- Applies to login and signup modes only
- Forgot password and reset password modes show email form only

## HeaderShell (Consistent Three-Zone Layout)

All pages use `HeaderShell` component for pixel-perfect header consistency:
```
[Yidhan]        [    Center Content    ]        [☀] [JD]
  ↑                      ↑                         ↑
 Logo              Page-specific             Theme + Avatar
(fixed)             (flexible)               (fixed position)
```

**Library Header (Desktop):**
```
[Yidhan]   [  Search...  ⌘K  ] [+ New Note]   [☀] [JD ↓]
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
Row 1: [Yidhan]                    [+] [☀] [JD]
Row 2: [         Search...          ]
```
- New Note button moved to Row 1 for quick access
- Search bar gets full width on Row 2

**Editor Header (Desktop):**
```
[Yidhan / Note Title]                    [Saving.../Saved ✓] [🗑] | [☀] [JD]
     ↑                                          ↑
 Left Zone                                Right Actions
(logo + breadcrumb integrated)          (save status + delete)
```

**Editor Header (Mobile):**
```
Row 1: [Yidhan]                         [Saving...] [🗑] [☀] [JD]
Row 2: [Note Title]
```

**Landing/Public Pages:**
```
[Yidhan]                                         [☀] [Sign In]
```

**HeaderShell Props by Page:**

| Page | Left Content | Center Content | Right Actions | Menu Sections |
|------|--------------|----------------|---------------|---------------|
| Library | - (default logo) | Search bar | New Note button | Export, Import, Faded Notes |
| Editor | Logo + Breadcrumb | Mobile: Note title | Save status + Delete | - |
| Landing | - (default logo) | - | - | - |
| Changelog | - (default logo) | - | - | - |
| Roadmap | - (default logo) | - | - | - |

## Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd/Ctrl + N` | Create new note | Library |
| `Cmd/Ctrl + K` | Focus search | Library |
| `Escape` | Save and go back | Editor |
| `Cmd/Ctrl + Shift + C` | Copy note to clipboard | Editor |
| `Cmd/Ctrl + B` | Bold | Editor |
| `Cmd/Ctrl + I` | Italic | Editor |
| `Cmd/Ctrl + U` | Underline | Editor |

## Slash Commands (type `/` in editor)

| Command | Inserts |
|---------|---------|
| `/h1`, `/h2`, `/h3` | Section headings (large, medium, small) |
| `/bullet` | Bullet point list |
| `/numbered` | Numbered list |
| `/todo` | Task checklist with checkboxes |
| `/quote` | Block quote |
| `/code` | Code block |
| `/highlight` | Highlighted text |
| `/divider` | Horizontal line |
| `/date` | Current date (e.g., "Dec 16, 2024") |
| `/time` | Current time (e.g., "3:30 PM") |
| `/now` | Date and time (e.g., "Dec 16, 2024 at 3:30 PM") |

## Tag Filter Bar (below header)

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

## Note Card

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

## Temporal Chapters (Note Organization)

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

## Faded Notes View

```
┌─────────────────────────────────────────────────────────────┐
│ [Yidhan]                          [Release All] | [☀] [JD] │
├─────────────────────────────────────────────────────────────┤
│ Faded Notes                                                 │
│ Notes rest here before releasing.                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Note Title                                          │   │
│  │ Resting quietly · Releasing in 27 days              │   │
│  │ [Restore] [Release]                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```
- Uses HeaderShell for consistent header (clickable logo, theme toggle, avatar)
- Accessed via "Faded Notes" in profile menu (shows badge count)
- Cards show organic time phrases and days until release
- Restore returns note to library
- "Release" permanently removes note
- "Release All" permanently deletes all faded notes

## Footer (Library & Landing Page)

```
              Changelog  ·  Roadmap  ·  GitHub
```
- Subtle links at bottom of page
- Text: 12px, tertiary color
- Accent color on hover
- Public pages accessible without login

## Changelog Page

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

## Roadmap Page

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
