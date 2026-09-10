# Yidhan UI Layout Reference

Detailed ASCII diagrams for UI components. Referenced from CLAUDE.md for detailed layout work.

## Landing Page (Product Beside the Promise)

**Desktop (>=1024px), first screen:**
```
+--------------------------------------------------------------------------+
| Yidhan                                               [theme] [Sign In]   |
+--------------------------------------------------------------------------+
|                                  | +-----------------------------------+ |
|  A quiet home                    | | An idea for Saturday              | |
|  for your                        | | + Add tag                Just now | |
|  personal notes.                 | | [B I </> H1 List ... Quote Code ] | |
|                                  | |                                   | |
|  Capture an idea ... Nothing to  | | Leave the morning unplanned.      | |
|  set up.                         | |                                   | |
|  Each note is locked on your     | | Walk to the market. ...           | |
|  device before it syncs ...      | |                                   | |
|  Not even us.                    | | Maybe that is enough.|            | |
|                                  | |-----------------------------------| |
|  [ Try writing ]  Explore sample | | (Saved here)  A practice draft... | |
|                   notes ->       | |        [Create an account to keep] | |
|  Free to use. No account needed. | +-----------------------------------+ |
|                                                                          |
|   Encrypted before it syncs . Works offline . Free and open source .     |
|   Export any time                                                        |
+--------------------------------------------------------------------------+
```

**Below the first screen:**
```
+--------------------------------------------------------------------------+
| Small thoughts, worth keeping.          Write a little. Come back when   |
|                                         you want. Open any of these ...  |
| [What I wanted to say] [A passage worth keeping] [Tuesday, on the train] |
|                                                                          |
| Your words stay yours.        | Notes are encrypted on your device ...   |
|                               | How the locking works ->                 |
|                               | ------------------------------------     |
|                               | Yidhan is built and looked after by one  |
|                               | person. It will never carry ads ...      |
|                                                                          |
|                  Start with one note.  [ Try writing ]                   |
|                                                                          |
|        Changelog . Roadmap . GitHub . Privacy . Terms . Support          |
+--------------------------------------------------------------------------+
```

**Mobile (<1024px):** the same blocks stacked. The intro comes first, the
manuscript preview peeks under the fold, the proof facts wrap, and the sample
cards stack in one column. Below 768px the primary button spans the width.

- The manuscript is a static rendering of the real editor (title, tag row, toolbar
  labels, body, saved chip) with the `starter-saturday` note in it. An invisible
  overlay button covers it; clicking anywhere on the page opens the Practice Space
  draft. It is a picture of the editor, not an imitation of one: there is no
  in-page textarea and nothing is written to `yidhan-demo-content` from here.
- Every "Try writing" (hero, preview overlay, closing line) routes to `/demo/new` at
  every width. The account comes from inside the Practice Space ("Keep these notes")
  or from the preview's "Create an account to keep and sync", which opens sign-up.
- "Explore sample notes" is a real link to `/demo`; a plain click is routed in-app,
  a modified click is left to the browser.
- The sample cards are the Practice Space starters minus the pinned welcome and the
  hero note, rendered with the real `NoteCard` in decorative mode. Each has an
  overlay button that opens the Practice Space.
- Proof facts: "Encrypted before it syncs" and "How the locking works" open the
  security page; "Free and open source" opens GitHub; the other two are plain text.
- No scroll cue, no scroll-reveal observer, no lock illustration. The hero has one
  entrance fade and the caret blinks; both stop under `prefers-reduced-motion`.

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

## Editor Chrome

- **Toolbar** — `EditorToolbar.tsx`, with `variant: 'inline' | 'bottom'`.
- **Vertical sidebar** — `EditorSidebar.tsx`, shown at 1100px and wider. It supplements
  the toolbar rather than replacing it; every command stays reachable from the toolbar at
  every width.
- **Focus mode** — `focus-mode-active` on the scroll container fades descendant
  `.focus-mode-target` elements.

## Saving

- Autosave debounces at 800ms.
- A local checkpoint runs every 10 seconds, independently of the debounce, so a tab that
  dies mid-sentence loses at most that interval.
- "Saved here" means the local write landed. "Synced" is only shown once the server
  confirms a matching content hash.
- A failed save keeps the draft on screen with Retry and Copy, rather than discarding it.

## Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd/Ctrl + N` | Create new note | Library |
| `Cmd/Ctrl + K` | Focus search | Library |
| `Cmd/Ctrl + K` | Insert or edit a link | Editor, cursor in the note |
| `Cmd/Ctrl + K` | Focus search | Editor, cursor elsewhere |
| `Cmd/Ctrl + Shift + K` | Search all notes | Editor |
| `Cmd/Ctrl + F` | Find in this note | Editor |
| `Escape` | Close find, then exit focus mode, then save and go back | Editor |
| `Cmd/Ctrl + Shift + F` | Toggle focus mode | Editor |
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

## Arrange Row (above the chapters)

Right-aligned inside the scrolling library, above the first chapter. It scrolls away
with the notes rather than following the reader down the page.

```
                          Chapters by [Edited] [Written]   Notes by [Edited] [Written] [Title]
```

- **Chapters by** — which timestamp decides a note's chapter. `Edited` is the default;
  `Written` means an edit does not move a note out of the chapter its writing date
  earned.
- **Notes by** — the order within a chapter.
- Pinned notes are unaffected by the basis; they stay in Pinned under either choice.
- Both choices are remembered per user, per device.
- Hidden on the empty library, on a search that found nothing, and while the library is
  still loading — there is nothing to arrange.

## Search Operators (library search box)

Free-text words are ANDed. A quoted phrase is matched whole. Operators combine with each
other and with free text.

| Operator | Meaning |
|---|---|
| `word another` | Both words must appear, in title or content |
| `"exact phrase"` | The phrase, matched whole |
| `tag:journal` | Has that tag. Case-insensitive |
| `is:pinned` | Pinned notes only |
| `before:2026-03` | Edited on or before that date. Day or month precision |
| `after:2026-03-01` | Edited on or after that date |

- Dates compare `updatedAt` against the reader's local calendar, and both bounds are
  inclusive.
- An operator inside quotes is literal text: `"tag:journal"` searches for that string.
- An empty `tag:` or an unparseable date is ignored rather than shown as an error.
- Locked notes stay visible with no query, but cannot match free text — there is nothing
  decrypted to match against.

The `?` modal lists these under Library.

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
