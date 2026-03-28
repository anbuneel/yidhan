# Design Critique Tracker

**Version:** 2.0
**Last Updated:** 2026-03-28
**Status:** Living Document
**Author:** Claude (Opus 4.6)

---

## Original Prompt

> Track all design critique findings (v1 + v2 + v3), decisions made, and open items from the impeccable skill analysis sessions.

---

## Source Documents

### Round 1-2 (2026-03-06)
- [Design Critique v1](../analysis/design-critique-impeccable-claude.md) — Initial holistic critique
- [Design Critique v2](../analysis/design-critique-v2-impeccable-claude.md) — Follow-up with anti-pattern focus

### Round 3 (2026-03-28, post-PR #183 landing redesign)
- [Impeccable Critique v3](../reviews/impeccable-design-critique-2026-03-28-claude.md) — Holistic design critique against live site
- [Impeccable Audit](../analysis/design-audit-impeccable-skill-claude.md) — Accessibility, performance, theming, responsive audit (20 findings)
- [Redesign Audit](../analysis/design-audit-redesign-skill-claude.md) — Anti-AI-generic checklist (8/10 overall)
- [UI Skills Taxonomy](../reference/ui-skills-taxonomy-claude.md) — Skill usage guide (reference only)

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

## Open Items — Consolidated (Round 3, 2026-03-28)

All unique findings from 3 new audit/critique documents, deduplicated against each other and against already-completed items. Items marked with multiple sources were independently flagged by separate skills.

### Already Tracked (GitHub Issues)

| Item | Description | Issue |
|------|-------------|-------|
| **Inline hover handler refactor** | 135 `onMouseEnter`/`onMouseLeave` inline style handlers across 23 files. | [#157](https://github.com/anbuneel/yidhan/issues/157) |

### Already in Landing Page Backlog

These items are tracked in [landing-page-backlog.md](landing-page-backlog.md) — not duplicated here.

- Proof rail links (plain text → verifiable proof links)
- Modal visual DNA (shadow/glow matches manuscript)
- Below-the-fold "second act" (scroll-revealed sections)
- 6 deferred signature details (paper fold, breathing cursor, etc.)

---

### Pre-Launch (Accessibility + Core UX)

| # | Item | Category | Source(s) | Fix |
|---|------|----------|-----------|-----|
| 1 | **No skip-to-content link** | A11y (WCAG A) | Audit H4, Redesign 5b | Add visually hidden `<a>` linking to `#main-content`, visible on focus |
| 2 | **No 404 page** | UX | Redesign 5a | Create a brand-appropriate 404 component |
| 3 | **Modal fixed widths break on narrow phones** | Responsive | Audit H3 | ShareModal `w-[420px]`, TagModal `w-[400px]`, Editor delete `w-[400px]` → `w-full max-w-[420px]` |
| 4 | **Dropdown menus overflow narrow viewports** | Responsive | Audit H5 | TagSelector, HeaderShell, Editor dropdowns need `max-w-[calc(100vw-2rem)]` |

### High Priority (Performance + UX)

| # | Item | Category | Source(s) | Fix |
|---|------|----------|-----------|-----|
| 5 | **Layout thrashing in Editor scroll handler** | Performance | Audit H1 | Reads `scrollTop`/`offsetTop` then writes `style.top` synchronously. Wrap in `requestAnimationFrame` |
| 6 | **Focus-mode animates layout properties** | Performance | Audit H2 | `max-height`, `margin`, `padding` transitions → use `grid-template-rows: 1fr → 0fr` |
| 7 | **Landing: manuscript preview steals CTA focus** | Conversion | Critique P1 | Cards are too readable — blur/fade/mask to make them atmosphere not content. **Not in landing-page-backlog** (noted as "not a landing page item" but never placed elsewhere) |
| 8 | **Trust badges still too subtle** | Conversion | Critique P2, Redesign 1c | Previously bumped text-sm→text-base (completed). Critique v3 says still insufficient — consider pill treatment, closer CTA proximity. Also in landing-page-backlog |
| 9 | **Mobile landing: card preview disconnected** | UX | Critique P3, Redesign 3a, 5c | Sign In + theme toggle bar between content and cards creates visual break. Consider hiding cards on mobile or adding scroll affordance. Also in landing-page-backlog |
| 10 | **Demo Practice Space first impression** | Onboarding | Critique P4 | 4 starter notes exist in code but `demoStorage.ts:420` filters out unedited ones — first visit shows 1 welcome card + 80% void. Show all starters on first visit or change filtering logic |
| 11 | **Copy hierarchy below headline is flat** | Typography | Critique P5, Redesign 1a | Size/weight stepping insufficient: headline → value prop → E2EE line → badges all similar weight. Also: headline `font-weight: 300` is too thin for Cormorant Garamond — bump to 400 or 500 for physical presence. Also in landing-page-backlog |
| 11b | **CTA cluster needs breathing room** | Layout | Redesign 3b | `gap: 0.6rem` between "Start Writing" button and trust lines below is too tight — button doesn't feel like a primary action. Increase to at least `1rem` |

### Medium Priority (Quality + Polish)

| # | Item | Category | Source(s) | Fix |
|---|------|----------|-----------|-----|
| 12 | **Hardcoded colors outside theme tokens** (8 files) | Theming | Audit M1, Redesign 2b | `App.tsx`, `BottomSheet.tsx`, `main.tsx`, `IOSInstallGuide.tsx`, `LandingPage.tsx` (incl. `manuscriptShadow`), `PlaygroundPage.tsx`, `ErrorBoundary.tsx`, `LogoTestPage.tsx` — create `--color-overlay`, `--color-border-subtle` tokens |
| 13 | **Inline style objects recreated every render** (20+ instances) | Performance | Audit M2 | `Auth.tsx` (6+), `TagFilterBar.tsx`, `NoteCard.tsx`, `Header.tsx` — extract to module-level constants |
| 14 | **Small touch targets: ChapterNav dots** | A11y | Audit M3 | `w-2 h-2` (8px) → ensure clickable `<button>` wrapper is ≥44×44px |
| 15 | **Small touch targets: TagPill buttons** | A11y | Audit M4 | `w-4 h-4` (16px) edit/remove → increase to `w-8 h-8` with `p-2` |
| 16 | **Missing `will-change` on key animations** | Performance | Audit M5 | Only `landing-text-reveal` declares it. Add to modal-enter, rising-wave, card-delete, focus-mode. Remove after animation completes |
| 17 | **TagPill missing aria-label** | A11y | Audit M6 | `<div role="button">` needs `aria-label={`Filter by ${tag.name}`}` |
| 18 | **IOSInstallGuide step cards missing aria-label** | A11y | Audit M7 | Interactive `role="button"` divs lack accessible names |
| 19 | **ShareModal tooltip can overflow viewport** | Responsive | Audit M8 | `w-64` with `absolute left-0` → add `max-w-[calc(100vw-2rem)]` |
| 20 | **ChapterNav tooltip overflow** | Responsive | Audit M9 | `whitespace-nowrap` without truncation → add `max-w-[200px] truncate` |
| 21 | **Dark theme shadows untinted** | Theming | Redesign 2a | Light theme correctly tints shadows warm. Dark theme uses `rgba(0,0,0,...)` — tint with forest green `rgba(5,20,10,...)` |
| 22 | **Delete animation uses fragile `setTimeout`** | Code quality | Redesign 4b | `setTimeout(() => onDelete(note.id), 300)` → use `onAnimationEnd` or `onTransitionEnd` |
| 23 | **Missing `text-wrap: balance` on headlines** | Typography | Redesign 1b | Prevents orphaned words at certain breakpoints. One CSS property |
| 24 | **Three styling approaches in one codebase** | Maintainability | Redesign 6a | Tailwind + inline styles + CSS-in-JSX `<style>` blocks (LandingPage ~350 lines). Document preferred approach, migrate incrementally |
| 25 | **Inconsistent icon stroke widths** | Visual consistency | Redesign 6b | Some SVGs use `strokeWidth={1.5}`, others `{2}`. Standardize |
| 26 | **`!important` on mobile headline** | Code quality | Redesign 6c | `.landing-headline { font-size: clamp(...) !important; }` — investigate specificity conflict root cause |

### Low Priority (Nice-to-Have)

| # | Item | Category | Source(s) | Fix |
|---|------|----------|-----------|-----|
| 27 | **Search placeholder generic** | Copy | Audit L4, Redesign 4c | "Search..." → "Search your thoughts..." or "Find a note..." |
| 28 | **`--spring-bounce` naming misleading** | Code quality | Audit L3 | Variable name suggests bounce but uses ease-out-quint. Rename to `--ease-out-quint` |
| 29 | **Sidebar toolbar italic icon legibility** | UX | Critique minor | `I` at 14px is hard to distinguish from a vertical line |
| 30 | **"Practice Space" breadcrumb label** | UX | Critique minor | Italic serif treatment is aesthetically nice but harder to parse as navigation |
| 31 | **Footer link density** | UX | Critique minor | 7 links high for a "calm, minimal" app — consider grouping |
| 32 | **Dark mode card borders too opaque** | Visual | Critique minor | Gold-tinted borders on dark mode landing → reduce 10-20% |
| 33 | **Timestamps ALL CAPS** | Typography | Critique minor | Uppercase small caps feels loud. Lowercase + letterspacing might be calmer |

### Creative Exploration (Revisit for design refresh)

| # | Item | Source |
|---|------|--------|
| 34 | **Post-reveal manuscript ambient effect** | Redesign 7a — subtle glow breathing after entrance animation |
| 35 | **Theme toggle metaphor** | Redesign 7b — candle/window or dusk/dawn instead of sun/moon |
| 36 | **Entrance stagger timing** | Redesign 7c — delays 0.08s/0.16s/0.24s → 0.12s/0.25s/0.4s for more ceremony |
| 37 | **E2EE as hero instead of tagline** | Critique question — "Your thoughts belong only to you" as primary headline |
| 38 | **Sidebar toolbar auto-hide** | Critique question — show only on hover/selection for true distraction-free |

### Verified (No Change Needed — Round 3)

| Item | Verdict |
|------|---------|
| **Anti-patterns: AI slop test** | **Pass** — all 3 audits confirm Yidhan does not look AI-generated |
| **"For free" next to CTA** | Decided in Round 1 — keep as-is (brand voice) |
| **ErrorBoundary hardcoded colors** | Acceptable as crash-state fallbacks (Audit L1) |
| **LogoTestPage hardcoded colors** | Dev-only test page (Audit L2) |
| **TagFilterBar DOM measurements** | Safely wrapped in effect with guards (Audit L6) |
| **Editor export dropdown min-width** | Less critical — editor is wider context (Audit L5) |

---

## Item Count Summary

| Priority | Count | Status |
|----------|-------|--------|
| Pre-Launch | 4 | New — accessibility + responsive gaps |
| High | 8 | Mix of new + re-flagged items (incl. 11b CTA breathing room) |
| Medium | 15 | New from audit + redesign |
| Low | 7 | Nice-to-have polish |
| Creative | 5 | Future exploration |
| Verified (no action) | 6 | Confirmed OK |
| **Total unique items** | **39** | (+ 1 tracked in GitHub, + 4 in landing-page-backlog) |
