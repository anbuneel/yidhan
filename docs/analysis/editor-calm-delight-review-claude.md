# Editor Calm & Delight Review

**Version:** 1.1
**Last Updated:** 2026-03-09
**Status:** Decisions Made — Ready for Implementation
**Author:** Claude (Opus 4.6)
**Consulted:** Frontend Design Skill

---

## Original Prompt

> Review the note editor capability and suggest improvements and polish. The editor is not hitting the mark yet for calm and delightful UI/UX.

---

## What's Genuinely Working

The editor has some beautiful touches that are distinctly "Yidhan":

- **The manuscript glow** (radial gradient `::after` on `.editor-writing-area`) — warm, atmospheric, creates a sense of candlelight on paper
- **The organic footer** with three dots, "Return to notes", and the Esc hint — this is the single best-designed moment in the editor. It feels like the end of a letter. More of this energy everywhere.
- **Accent-colored carets and list markers** — these tiny details reward attention
- **The focus mode vignette** with the pulsing dot indicator — conceptually great
- **Wabi-sabi corners on the writing surface** — `2px 24px 4px 24px` is a signature detail

---

## Decisions (2026-03-09)

### 1. Collapse metadata stack — YES (Option B)
**Decision:** Hover-reveal timestamps, always-visible inline tag pills.
- **Desktop:** Timestamps appear on hover/focus-within of the title zone
- **Mobile:** Timestamps toggle on tap of the title area
- **Tags:** Always-visible inline pills with a subtle `+ tag` button that opens the existing dropdown

**Rationale:** Removes 2 of 4 horizontal bands between title and body. Timestamps are transient info that doesn't need permanent real estate. Tags stay visible because they're part of the note's identity.

### 2. Vertical left sidebar toolbar — YES
**Decision:** Replace the persistent horizontal toolbar with a slim, ghostly vertical column of icons in the left margin. Focus mode toggle sits at the bottom of the sidebar, separated by a gap. Mobile keeps the existing bottom toolbar unchanged.
- Sidebar hides in focus mode (like all other chrome)
- Keyboard shortcuts and slash commands still work as primary formatting paths

**Rationale:** Frees the writing surface from horizontal chrome entirely. Feels like a painter's palette rather than a form control bar. The sidebar is persistent (not transient like a floating bubble) which maintains discoverability.

### 3. Generous spacing + decorative gradient line — YES
**Decision:** `mt-8` whitespace before body content, plus a thin gradient line between the title zone and body that fades at both edges (accent color, low opacity).

**Rationale:** With the metadata collapse (#1) and toolbar sidebar (#2), only the title zone and tags remain above the body. The gradient line creates a visual "bridge" — a chapter divider feel.

### 4. Frosted glass on left sidebar — YES
**Decision:** Semi-transparent background with `backdrop-filter: blur` on the vertical sidebar.

**Rationale:** Reinforces the "slim, ghostly" character. Lets the manuscript glow bleed through the sidebar.

### 5. Ghost-writing placeholder — YES
**Decision:** Use Cormorant Garamond (display font), slightly larger than body text, very low opacity for the rotating placeholder messages. Should feel like faded handwriting on the page, not input field hints.

### 6. Decorative horizontal rule — YES (Option A: three dots)
**Decision:** Replace `1px solid` horizontal rule with three centered dots (`· · ·`), matching the existing editor footer motif.

**Rationale:** Consistency — the three-dot pattern already exists at the end of every note. Reusing it for dividers creates a cohesive visual language.

### 7. Editorial blockquote — YES
**Decision:** Blockquotes use Cormorant Garamond italic, slightly larger font size. Magazine pull-quote feel rather than standard left-border treatment.

### 8. Delete dialog brand voice — YES
**Decision:** Change "Delete this note?" to "Let this note fade?" with description "It will rest in Faded Notes for 30 days."

**Rationale:** Matches existing brand language (Faded Notes, Letting Go).

### 9. Viewport-following manuscript glow — YES
**Decision:** The radial gradient glow follows the viewport via scroll listener, so it always illuminates where the user is currently writing.

**Rationale:** On long notes, the current fixed glow at `50% 40%` means users write in darkness at the bottom. The glow should follow them.

### 10. First-paragraph `::first-line` treatment — SKIP
**Decision:** Not implementing. CSS `::first-line` has limited browser support for font properties, and the editorial payoff is low relative to the other changes.

---

## Implementation Summary

| # | Change | Impact | Effort | Status |
|---|--------|--------|--------|--------|
| 1 | Collapse metadata stack (hover timestamps, inline tag pills) | High | Medium | Pending |
| 2 | Vertical left sidebar toolbar (slim, ghostly, frosted glass) | High | High | Pending |
| 3 | Generous spacing + gradient line between title zone and body | High | Low | Pending |
| 4 | Frosted glass on left sidebar | Medium | Low | Pending (merged with #2) |
| 5 | Ghost-writing placeholder (Cormorant, larger, low opacity) | Medium | Low | Pending |
| 6 | Decorative horizontal rule (three dots `· · ·`) | Medium | Low | Pending |
| 7 | Editorial blockquote (Cormorant italic, larger) | Medium | Low | Pending |
| 8 | Delete dialog brand voice ("Let this note fade?") | Medium | Low | Pending |
| 9 | Viewport-following manuscript glow | Medium | Medium | Pending |
| 10 | First-paragraph `::first-line` | — | — | **Skipped** |

---

## Core Insight

The core tension is that **the editor's chrome (toolbar, metadata, tag selector) competes with the writing surface for attention**. The best moments in Yidhan's editor (the manuscript glow, the footer, the focus mode) are the ones where the app gets out of the way. The worst moments are where it acts like every other rich-text editor. The path to "calm and delightful" is subtractive — remove visual layers, reduce persistent UI, and let the writing surface breathe.

---

## Files Reviewed

- `src/components/Editor.tsx` — Main editor container, header, layout, focus mode
- `src/components/EditorToolbar.tsx` — Formatting toolbar (inline + bottom variants)
- `src/components/RichTextEditor.tsx` — Tiptap wrapper, placeholder, cursor persistence
- `src/components/SlashCommand.tsx` — Slash command extension and dropdown
- `src/components/TagSelector.tsx` — Tag assignment dropdown
- `src/components/WhisperBack.tsx` — Scroll-to-top floating button
- `src/index.css` — Editor CSS (writing area, focus mode, toolbar, ProseMirror styles)

---

## Related Documents

- [editor-excellence-proposal-claude.md](editor-excellence-proposal-claude.md) — Previous sprint (Focus Mode, Page Presence, Bottom Toolbar) — **Complete, shipped v3.6.0**
- [editor-ux-evaluation-claude.md](editor-ux-evaluation-claude.md) — Earlier editor evaluation with 15 quick wins
