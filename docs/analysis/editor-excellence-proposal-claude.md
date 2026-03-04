# Editor Excellence: UI/UX Design Proposal

**Version:** 1.0
**Last Updated:** 2026-03-03
**Status:** Proposal
**Author:** Claude (Opus 4.6)
**Consulted:** Frontend Design Skill

---

## Original Prompt

> Use the frontend-design skill to review the current implementation and come up with a good UI/UX proposal for the "editor excellence" sprint: Focus Mode, Subtle Page Presence, and Bottom Toolbar on Mobile.

---

## Design Philosophy

Yidhan's editor is already beautiful — Cormorant Garamond titles, gold carets, warm theme palettes. But the **writing experience itself** doesn't yet match the visual design. The editor currently feels like "styled text in a container" rather than "a space designed for writing."

This sprint closes that gap through three interventions:

1. **Focus Mode** — Transform the editor into a sanctuary when deep writing demands it
2. **Subtle Page Presence** — Give the writing canvas atmosphere and spatial identity
3. **Bottom Toolbar on Mobile** — Make mobile formatting feel native and effortless

**Guiding Aesthetic:** Every change should feel like discovering a detail in a craftsman's workshop — intentional, subtle, rewarding upon closer inspection. Nothing flashy. Nothing that draws attention away from the words.

---

## Current State Analysis

### What's Working Well
- **Gold caret** (`caret-color: var(--color-accent)`) — beautiful, distinctive
- **Cormorant Garamond titles** at 2.25rem — sets the editorial tone immediately
- **Animated placeholder** rotation — adds life to empty states
- **800px max-width** — perfect reading/writing width
- **Accent-colored list markers** — subtle brand touch
- **Three-dot letter ending** in footer — lovely, on-brand detail

### What Needs Attention

**Writing Canvas (6.5/10)**
- The `<main>` content area has no visual distinction from the page background
- Writing feels like typing into a void — no sense of *place*
- The area between toolbar and footer is undifferentiated `--color-bg-primary`

**Focus & Flow (5/10)**
- No way to strip away chrome for deep writing sessions
- Header, toolbar, timestamps, tags, footer are always visible
- No visual state change when the user is "in the zone"

**Mobile Editor (6/10)**
- Top toolbar with 7 buttons + overflow works but isn't thumb-friendly
- The overflow `⋯` menu opens upward with a `right: 0` dropdown — requires hand repositioning
- Toolbar sits in the visual "reading zone" rather than the "action zone" (bottom of screen)

---

## Feature 1: Focus Mode

### Concept

Focus mode strips the editor to its essence: title and content. Everything else fades away with a graceful 300ms animation. The writing area gains a subtle atmospheric shift — a barely perceptible vignette that draws the eye inward.

### Visual Design

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│    ┌─ Fades out ──────────────────────────────┐         │
│    │ [Yidhan / Note Title]  [Save] [📤] [🗑️] │         │
│    └──────────────────────────────────────────┘         │
│                                                         │
│    ┌─ Fades out ──────────────────────────────┐         │
│    │ Created Jan 5 · Edited 2 hours ago       │         │
│    └──────────────────────────────────────────┘         │
│                                                         │
│    ┌─ Fades out ──────────────────────────────┐         │
│    │ [Journal] [+]                            │         │
│    └──────────────────────────────────────────┘         │
│                                                         │
│    ┌─ Fades out ──────────────────────────────┐         │
│    │ [B][I][U][S][H] | [H1][H2] | [•][☑] ... │         │
│    └──────────────────────────────────────────┘         │
│                                                         │
│                                                         │
│         Morning Reflections                             │
│         ───────────────────                             │
│                                                         │
│         The quiet hours before dawn have                │
│         become my favorite time to think                │
│         clearly. There's something about                │
│         the stillness that allows thoughts              │
│         to surface without the usual noise|             │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│                                         [Focus · Esc]   │
│                                                         │
│    ┌─ Fades out ──────────────────────────────┐         │
│    │         · · ·                             │         │
│    │    ← Return to notes                     │         │
│    │    Press [Esc] to save & exit             │         │
│    └──────────────────────────────────────────┘         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**After focus mode activates (300ms transition):**

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│         Morning Reflections                             │
│         ───────────────────                             │
│                                                         │
│         The quiet hours before dawn have                │
│         become my favorite time to think                │
│         clearly. There's something about                │
│         the stillness that allows thoughts              │
│         to surface without the usual noise|             │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│                                         [Focus · Esc]   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Design Details

**Focus Mode Indicator**
A minimal pill in the bottom-right corner. Not top-right — that's where action buttons live and it would feel like UI chrome. Bottom-right is the "quiet information" zone.

```css
.focus-mode-indicator {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 6px 14px;
  border-radius: 20px;
  font-family: var(--font-body);
  font-size: 0.75rem;
  letter-spacing: 0.03em;
  color: var(--color-text-tertiary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--glass-border);
  opacity: 0.6;
  transition: opacity 300ms ease;
  z-index: 10;
  user-select: none;
}

/* Fade in when focus mode activates */
.focus-mode-indicator:hover {
  opacity: 0.9;
}
```

**Why bottom-right, not top-right:**
- Top-right is where save status, export, and delete buttons live — the indicator would compete
- Bottom-right mirrors the WhisperBack button pattern (which hides in focus mode)
- It sits in the peripheral vision zone — visible if you look for it, invisible when writing

**Hide/Show Animation**
The existing plan uses `max-height: 0` + `overflow: hidden`. I'd enhance this slightly:

```css
/* Elements that fade in focus mode */
.focus-mode-target {
  transition: opacity 300ms ease-out, transform 300ms ease-out, max-height 300ms ease-out;
}

.focus-mode-active .focus-mode-target {
  opacity: 0;
  transform: translateY(-8px);
  pointer-events: none;
  max-height: 0;
  overflow: hidden;
  margin-top: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}
```

**Why CSS class on a parent rather than individual `.focus-mode-hide` classes:**
Using a single `.focus-mode-active` class on the scroll container means we toggle ONE class instead of applying/removing classes to 6+ elements. The CSS cascade handles the rest. Cleaner, less React state management, fewer re-renders.

**Sticky zone handling:**
When focus mode is active, the `editor-sticky-zone` must lose its `position: sticky` to avoid consuming invisible space at the top:

```css
.focus-mode-active .editor-sticky-zone {
  position: static;
}
```

**Vignette effect (optional, subtle):**
A barely visible vignette on the scroll container creates a "looking through a window" feel:

```css
.focus-mode-active::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    transparent 60%,
    rgba(0, 0, 0, 0.06) 100%
  );
  z-index: 1;
  transition: opacity 500ms ease;
}
```

For the dark theme, bump to `rgba(0, 0, 0, 0.12)`. This is so subtle that most users won't consciously notice it, but it creates a sense of depth and focus.

### Activation

| Method | Platform | Gesture |
|--------|----------|---------|
| Keyboard | Desktop | `Ctrl+Shift+F` (or `Cmd+Shift+F`) |
| Touch | Mobile | Triple-tap on editor content area |
| Exit | Both | `Escape` (first press exits focus, second press exits editor) |

### What Stays Visible in Focus Mode
- Note title (editable)
- Note content (editable)
- Focus mode indicator pill
- Auto-save continues silently
- Formatting keyboard shortcuts still work (Ctrl+B, Ctrl+I, etc.)
- Slash commands still work

### What Hides
- Header (logo, breadcrumb, save status, export, delete)
- Timestamps
- Tag selector
- Toolbar
- Resume chip
- Footer (dots, return link, Esc hint)
- WhisperBack button

---

## Feature 2: Subtle Page Presence

### Concept

The writing canvas should feel like it has **spatial identity** — like writing on a surface rather than into emptiness. This isn't about adding a visible "page" rectangle (that would feel like Google Docs). It's about atmospheric cues that make the writing area feel *inhabited*.

### Design: The Manuscript Glow

A very subtle vertical gradient creates the sensation of light falling on a writing surface. Think of lamplight on paper — brightest in the center, gently falling off at the edges.

```
Current:
┌────────────────────────────────────────────┐
│  (uniform --color-bg-primary everywhere)   │
│                                            │
│       Title                                │
│                                            │
│       Content content content content      │
│       content content content content      │
│                                            │
│  (uniform --color-bg-primary everywhere)   │
└────────────────────────────────────────────┘

Proposed:
┌────────────────────────────────────────────┐
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░░                                ░░░░  │
│  ░░     Title                         ░░  │
│  ░                                     ░  │
│         Content content content content    │
│         content content content content    │
│  ░                                     ░  │
│  ░░░                                ░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
└────────────────────────────────────────────┘
  (░ = very subtle darkening at edges)
```

### CSS Implementation

**For the main editor content area** (`max-w-[800px]` wrapper):

```css
/* Manuscript glow — subtle vertical luminance shift */
.editor-canvas {
  position: relative;
}

.editor-canvas::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.4;
}

/* Dark theme: Warm glow from center */
[data-theme="midnight"] .editor-canvas::before,
[data-theme="mori"] .editor-canvas::before {
  background: radial-gradient(
    ellipse 80% 50% at 50% 40%,
    rgba(212, 175, 55, 0.03) 0%,
    transparent 70%
  );
}

/* Light theme: Subtle warm brightening */
[data-theme="kintsugi"] .editor-canvas::before,
[data-theme="washi"] .editor-canvas::before {
  background: radial-gradient(
    ellipse 80% 50% at 50% 40%,
    rgba(255, 255, 255, 0.15) 0%,
    transparent 70%
  );
}
```

**Why this works:**
- In Midnight theme: a whisper of gold light at the center — like candlelight on dark paper
- In Kintsugi theme: a subtle brightening — like sunlight falling on aged paper
- The `ellipse 80% 50% at 50% 40%` shape is vertically compressed and shifted slightly upward, mimicking natural overhead light

**Important:** The `opacity: 0.4` keeps this *extremely* subtle. Users should feel it, not see it. If anyone notices it consciously, it's too strong.

### Title Area Enhancement

Add a subtle bottom border that fades after the title, creating a gentle "horizon" between the title and content:

```css
.editor-title-separator {
  height: 1px;
  margin: 0.5rem 0 1rem;
  background: linear-gradient(
    to right,
    transparent 0%,
    var(--glass-border) 20%,
    var(--glass-border) 80%,
    transparent 100%
  );
  opacity: 0.5;
}
```

This replaces the abrupt gap between title and content with a tasteful horizontal line that fades at the edges — like a chapter divider in a printed book.

### Selection Highlight Enhancement

The current `::selection` uses `var(--color-accent-glow)`. Enhance it to feel more intentional:

```css
.rich-text-editor .ProseMirror ::selection {
  background: var(--color-accent-glow);
  text-decoration-color: var(--color-accent);
}

/* Add a subtle accent underline to focused headings */
.rich-text-editor .ProseMirror h1:has(:focus),
.rich-text-editor .ProseMirror h2:has(:focus),
.rich-text-editor .ProseMirror h3:has(:focus) {
  text-decoration: underline;
  text-decoration-color: var(--color-accent-glow);
  text-underline-offset: 6px;
}
```

### What NOT to Do

- **No visible page rectangle** — That's Google Docs. Yidhan is about open space.
- **No animated cursor trail** — Considered and rejected. It draws attention to the mechanism, not the words.
- **No first-letter styling** — The editor evaluation suggested `::first-letter` enlargement. This conflicts with Tiptap's DOM structure and would look inconsistent with headings.
- **No parallax or scroll effects on the canvas** — The writing area should feel stable and grounded.

---

## Feature 3: Bottom Toolbar on Mobile

### Concept

Move the formatting toolbar from the top of the editor (where it competes with content) to the bottom of the screen (where thumbs naturally rest). The toolbar sits above the keyboard when it's open, and docks to the bottom when the keyboard is closed.

### Current Mobile Toolbar

```
┌────────────────────────────────────┐
│ [Yidhan]  [Note Title]  [📤] [🗑️] │  ← Header (sticky)
├────────────────────────────────────┤
│ Created Jan 5 · Edited 2h ago      │  ← Timestamps
│ [Journal] [+]                      │  ← Tags
├────────────────────────────────────┤
│ [B][I] | [•][☑] | [↩][↪] | [⋯]   │  ← Toolbar (sticky, wraps awkwardly)
├────────────────────────────────────┤
│                                    │
│   Morning Reflections              │
│                                    │
│   Content...                       │
│                                    │
└────────────────────────────────────┘
```

**Problems:**
- Toolbar takes up prime reading real estate at the top
- `sticky` top position means it's always visible but not where thumbs are
- Overflow menu opens downward from `right: 0` — requires top-of-screen reach

### Proposed Mobile Layout

```
┌────────────────────────────────────┐
│ [Yidhan]  [Note Title]  [📤] [🗑️] │  ← Header (sticky, unchanged)
├────────────────────────────────────┤
│ Created Jan 5 · Edited 2h ago      │
│ [Journal] [+]                      │
├────────────────────────────────────┤
│                                    │
│   Morning Reflections              │
│                                    │
│   Content content content          │  ← More content visible now!
│   content content content          │
│   content content content...       │
│                                    │
├────────────────────────────────────┤
│ [B] [I] [H] │ [•] [☑] │ [↩] [⋯]  │  ← Bottom toolbar (fixed)
└────────────────────────────────────┘
      ┌──── keyboard ────┐
```

**When keyboard is open, toolbar sits directly above it:**

```
┌────────────────────────────────────┐
│                                    │
│   Morning Reflections              │
│                                    │
│   Content content content          │
│   content content content|         │  ← cursor here
│                                    │
├────────────────────────────────────┤
│ [B] [I] [H] │ [•] [☑] │ [↩] [⋯]  │  ← Above keyboard
├────────────────────────────────────┤
│           KEYBOARD                 │
│                                    │
│   q w e r t y u i o p             │
│   a s d f g h j k l               │
│   z x c v b n m ⌫                 │
│   [123]  [space]  [return]         │
└────────────────────────────────────┘
```

### Design Details

**Toolbar Container:**

```css
.editor-toolbar-mobile-bottom {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  padding: 6px 12px;
  padding-bottom: max(6px, env(safe-area-inset-bottom));
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  gap: 2px;
  transition: transform 200ms ease;
}
```

**Keyboard awareness** via `useKeyboardHeight` hook (already exists at `src/hooks/useKeyboardHeight.ts`):

```css
/* When keyboard is visible, toolbar moves up with it */
.editor-toolbar-mobile-bottom {
  /* The bottom offset is set via inline style using visualViewport */
  /* See useKeyboardHeight.ts */
}
```

**Overflow menu direction flips:**
Since the toolbar is at the bottom, the overflow menu must open **upward** instead of downward:

```css
/* Bottom toolbar overflow opens upward */
.editor-toolbar-mobile-bottom .overflow-menu {
  bottom: 100%;
  top: auto;
  margin-bottom: 4px;
  margin-top: 0;
}
```

**Button sizing:**
Mobile buttons should be slightly larger than desktop for thumb targets:

```css
.editor-toolbar-mobile-bottom button {
  min-width: 36px;
  min-height: 36px;
}
```

### Button Selection for Bottom Toolbar

Keep the same 7-button + overflow layout, but reorder for thumb ergonomics:

| Position | Button | Why |
|----------|--------|-----|
| 1 | **Bold** | Most-used formatting |
| 2 | **Italic** | Second most-used |
| 3 | **Heading** (cycles H1→H2→H3→P) | Single button instead of H1/H2/H3 |
| 4 | Divider | — |
| 5 | **Bullet list** | Common for quick notes |
| 6 | **Task list** | Second most common list type |
| 7 | Divider | — |
| 8 | **Undo** | Quick mistake correction |
| 9 | **Overflow ⋯** | Everything else |

**Heading Cycle Button** — A single button that shows "H1", "H2", or "H3" based on current state, and cycles through heading levels on tap. Saves 2 button slots and reduces visual noise. Long-press could show a small popover to jump directly to a level.

```
Tap sequence: Normal → H1 → H2 → H3 → Normal → ...
Visual:       [¶]    [H1]  [H2]  [H3]  [¶]   → ...
```

### Conditional Rendering

The bottom toolbar renders ONLY on mobile. Desktop keeps the current inline toolbar:

```tsx
// In Editor.tsx
{isMobile ? (
  /* Bottom toolbar is rendered as fixed positioned, outside the main flow */
  <div className="editor-toolbar-mobile-bottom">
    <EditorToolbar editor={editor} variant="bottom" />
  </div>
) : (
  /* Desktop: inline toolbar in normal flow, becomes sticky */
  <div className="editor-toolbar-sticky">
    <EditorToolbar editor={editor} />
  </div>
)}
```

### Scroll Padding Adjustment

Remove the old 140px scroll-padding-top for mobile (toolbar is no longer at the top):

```css
@media (max-width: 640px) {
  .editor-sticky-zone + main {
    scroll-padding-top: 70px; /* Only header now, no toolbar */
  }

  .ProseMirror:focus {
    scroll-margin-top: 70px;
    scroll-margin-bottom: 60px; /* Account for bottom toolbar */
  }
}
```

### Focus Mode Interaction

When focus mode is active on mobile, the bottom toolbar hides with the same fade transition:

```css
.focus-mode-active .editor-toolbar-mobile-bottom {
  opacity: 0;
  transform: translateY(100%);
  pointer-events: none;
  transition: opacity 300ms ease-out, transform 300ms ease-out;
}
```

---

## Implementation Sequence

The three features have dependencies — build in this order:

### Day 1-2: Focus Mode
1. Add `isFocusMode` state to `Editor.tsx`
2. Add `focus-mode-active` class to scroll container
3. Add CSS transitions for `.focus-mode-target` elements
4. Add `Ctrl+Shift+F` keyboard shortcut
5. Add triple-tap detection for mobile
6. Add focus mode indicator pill
7. Add vignette effect (optional)
8. Update `KeyboardShortcutsModal.tsx`

### Day 3: Subtle Page Presence
1. Add `editor-canvas` class to the content wrapper `<div>`
2. Add the radial gradient `::before` pseudo-element
3. Add title separator line
4. Test in both Kintsugi and Midnight themes
5. Tune opacity values until the effect is felt but not seen

### Days 4-6: Bottom Toolbar on Mobile
1. Add `variant` prop to `EditorToolbar` (default `"inline"` | `"bottom"`)
2. Create heading cycle button component
3. Render bottom toolbar conditionally based on `isMobile`
4. Wire up `useKeyboardHeight` for keyboard-aware positioning
5. Flip overflow menu direction for bottom layout
6. Update scroll padding values
7. Test on iOS Safari and Android Chrome
8. Ensure focus mode correctly hides the bottom toolbar

---

## Theme Compatibility Matrix

| Element | Midnight (Dark) | Kintsugi (Light) |
|---------|----------------|-------------------|
| Focus vignette | `rgba(0,0,0,0.12)` | `rgba(0,0,0,0.06)` |
| Page presence glow | Gold `rgba(212,175,55,0.03)` | White `rgba(255,255,255,0.15)` |
| Title separator | `var(--glass-border)` at 0.5 opacity | Same |
| Focus indicator pill | `--color-bg-secondary` + `--glass-border` | Same |
| Bottom toolbar bg | `--color-bg-secondary` | Same |
| Bottom toolbar border | `--glass-border` | Same |

All elements use existing CSS variables — no new color tokens needed.

---

## What This Sprint Does NOT Include

| Excluded | Why |
|----------|-----|
| Typewriter mode (scroll lock to current line) | Phase 3 item, separate effort |
| Custom body font (Literata/Source Serif 4) | Requires font loading strategy, separate evaluation |
| Writing session stats (word count) | Nice-to-have, separate scope |
| Floating selection toolbar | Explicitly rejected — doesn't fit Yidhan's calm aesthetic |

---

## Success Criteria

| Feature | Metric |
|---------|--------|
| Focus Mode | Ctrl+Shift+F/triple-tap works, all chrome fades smoothly, Escape exits correctly |
| Page Presence | Effect is visible in both themes, does NOT distract from writing |
| Bottom Toolbar | All formatting buttons work, keyboard-aware positioning works, overflow opens upward |
| Cross-feature | Focus mode hides bottom toolbar on mobile, page presence visible in focus mode |
| Performance | No layout shift, no jank during focus mode transition |

---

## Related Documents

- [Focus Mode Plan](../../.claude/plans/calm-honking-mist.md) — Original implementation plan
- [Editor UX Evaluation](editor-ux-evaluation-claude.md) — Scoring and recommendations
- [Unified Roadmap](../roadmap.md) — Phase 1 sprint context

---

*This proposal refines the existing focus mode plan and adds design direction for the page presence and bottom toolbar features. Implementation should follow the sequence outlined above to manage dependencies correctly.*
