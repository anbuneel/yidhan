# Design Critique Tracker

**Version:** 1.0
**Last Updated:** 2026-03-07
**Status:** Living Document
**Author:** Claude (Opus 4.6)

---

## Original Prompt

> Track all design critique findings (v1 + v2), decisions made, and open items from the impeccable skill analysis sessions.

---

## Source Documents

- [Design Critique v1](../analysis/design-critique-impeccable-claude.md) — Initial holistic critique
- [Design Critique v2](../analysis/design-critique-v2-impeccable-claude.md) — Follow-up with anti-pattern focus

---

## Completed

### Priority Fixes (PR #155 + feature/design-critique-refinements)

| Item | What Changed | PR |
|------|--------------|----|
| **Top-border accent on cards** | Removed `borderTop: 2px solid` from NoteCard, ShowcaseCard, FadedNoteCard | design-critique |
| **Inter replaced with Source Sans 3** | Updated Google Fonts import, `--font-body` CSS variable, README, CLAUDE.md | design-critique |
| **Landing page CTA hierarchy** | Headline bumped to 4rem, CTA to py-4/text-lg, "or explore first" secondary link | design-critique |
| **Mobile landing page restructured** | Hidden right panel on mobile, added inline card peek, moved theme toggle + Sign In into hero header | design-critique |
| **Sign-in modal warmth** | Narrowed to 440px, removed backdrop blur, added E2EE trust line, fixed desktop close button (now inside card) | design-critique |
| **Card hover elevation** | Reduced translateY from -6px to -3px | design-critique |
| **Backdrop blur on masonry cards** | Removed `backdrop-filter: blur()` from NoteCard in masonry grid | #155 |
| **Spring bounce easing** | Replaced overshoot `cubic-bezier(0.34, 1.56, ...)` with ease-out-quint `(0.22, 1, 0.36, 1)` | #155 |
| **Chapter headers visibility** | Bumped from text-sm to text-base, changed to text-primary color | design-critique |
| **Card background opacity** | Made cards more opaque (paper feel): Kintsugi 80%->92%, Midnight 60%->88%, Washi 75%->90%, Mori 80%->90% | design-critique |
| **Light mode card shadows** | Added dual-layer shadows for Kintsugi/Washi (tight edge + ambient depth) for better card definition | design-critique |
| **Welcome note content** | Shortened from 8 bullet points to 3 concise items; demo welcome note also tightened | design-critique |
| **Sparse library state** | 4 starter notes + Recipes tag for both demo and authenticated users. Writing surface vignette on landing page. | design-critique-explorations |
| **Landing page writing surface** | Right panel: 4 staggered cards → 2 cards + full-width writing vignette (manuscript glow, ruled lines, fade-in text) | design-critique-explorations |
| **OS theme detection** | Landing page detects `prefers-color-scheme` — light-mode users see Kintsugi on first visit | design-critique-explorations |
| **Aged paper gradient** | Cards get subtle warm-to-warmer gradient (3% accent at bottom via `color-mix`) | design-critique-explorations |
| **Confident trust signals** | Landing trust signals bumped from text-sm to text-base with larger icons | design-critique-explorations |
| **Confident empty state** | "Your notes await" title bumped to text-2xl with more breathing room | design-critique-explorations |

### Verified (No Action Needed)

| Item | Verdict |
|------|---------|
| **Noise texture z-index 9999** | Safe — `pointer-events: none` + low opacity (5-18%). Intentionally covers modals to maintain paper metaphor. |
| **Tag badge colors** | Already well-curated. No changes needed. |
| **"Preparing your space..." loading** | On-brand. No changes needed. |
| **Demo "Explore" badge** | Good user orientation. No changes needed. |

---

## Design Decisions

Decisions made during critique review sessions. These are intentional choices, not deferred items.

### Dark theme remains default
**Decision:** Keep Midnight (dark) as the default theme.
**Rationale:** The forest green + antique gold palette is Yidhan's most distinctive first impression. While Kintsugi (light) aligns more closely with the physical wabi-sabi reference (Muji, Kinfolk), the dark theme is more memorable and recognizable in screenshots/demos. Users who prefer light mode will toggle immediately.

### "For free" kept as-is
**Decision:** Keep "For free" next to the CTA button. Don't change to "Free forever."
**Rationale:** "Free forever" is SaaS-speak that conflicts with Yidhan's quiet brand voice. "For free" is understated and honest — it says what it means without making promises about business models.

### Glass vs Paper: Paper wins tiebreakers
**Decision:** When glass (translucency, blur) and paper (opacity, texture, warmth) conflict, paper takes priority.
**Rationale:** The wabi-sabi philosophy is rooted in physical materials. Real paper isn't translucent. Blur was removed from masonry cards and auth modal. Card backgrounds made more opaque. The manuscript glow in the editor is the exception — it's where glass and paper work together beautifully.

### Card visual layers reduced to 3
**Decision:** Stripped from 5 layers (asymmetric corners + top border + glass bg + backdrop blur + shadow) to 3 (asymmetric corners + warm opaque bg + shadow).
**Rationale:** The asymmetric corners are the signature element and do the heavy lifting. Adding a colored top border, blur, and glass on top of that was visual noise — each layer competed instead of reinforcing.

---

## Open Items

### Actionable (GitHub Issues)

| Item | Description | Issue |
|------|-------------|-------|
| **Inline hover handler refactor** | 135 `onMouseEnter`/`onMouseLeave` inline style handlers across 23 files bypass CSS transitions and could cause jank. Should migrate to CSS `:hover` with custom properties. Large scope — separate PR. | [#157](https://github.com/anbuneel/yidhan/issues/157) |

### Future Creative Exploration

These are bigger directional ideas from the critique "Questions to Consider" sections. Worth revisiting when planning a design refresh or major version.

All creative explorations from v1/v2 critique have been addressed in the design-critique-explorations branch (v3.9.0).
