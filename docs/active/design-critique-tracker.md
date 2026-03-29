# Design Critique Tracker

**Version:** 2.1
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

| # | Item | Category | Source(s) | Status |
|---|------|----------|-----------|--------|
| 1 | **No skip-to-content link** | A11y (WCAG A) | Audit H4, Redesign 5b | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) |
| 2 | **No 404 page** | UX | Redesign 5a | 🔧 Decided: quiet on-brand page ("This path leads nowhere. Your notes are waiting.") |
| 3 | **Modal fixed widths break on narrow phones** | Responsive | Audit H3 | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) |
| 4 | **Dropdown menus overflow narrow viewports** | Responsive | Audit H5 | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) |

### High Priority (Performance + UX)

| # | Item | Category | Source(s) | Status |
|---|------|----------|-----------|--------|
| 5 | **Editor title auto-resize layout thrashing** | Performance | Audit H1 | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) — scroll handler already used rAF; title auto-resize batched |
| 6 | **Focus-mode animates layout properties** | Performance | Audit H2 | ✅ Closed — one-shot toggle, negligible perf impact, keep as-is |
| 7 | **Landing: manuscript preview steals CTA focus** | Conversion | Critique P1 | ✅ Closed — PR #183 redesign validated, revisit with analytics post-launch |
| 8 | **Trust badges still too subtle** | Conversion | Critique P2, Redesign 1c | ✅ Closed — already amplified once, further changes risk breaking calm tone |
| 9 | **Mobile landing: card preview disconnected** | UX | Critique P3, Redesign 3a, 5c | ✅ Closed — floating bar serves returning users, card below fold is a bonus |
| 10 | **Demo Practice Space first impression** | Onboarding | Critique P4 | 🔧 Decided: show all starters on first visit (change filter logic) |
| 11 | **Copy hierarchy below headline is flat** | Typography | Critique P5, Redesign 1a | ✅ Closed — landing page redesign hasn't been live long enough to evaluate |
| 11b | **CTA cluster needs breathing room** | Layout | Redesign 3b | 🔧 Decided: increase gap to 1rem |

### Medium Priority (Quality + Polish)

| # | Item | Category | Source(s) | Status |
|---|------|----------|-----------|--------|
| 12 | **Hardcoded colors outside theme tokens** | Theming | Audit M1, Redesign 2b | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) — App.tsx overlay + LandingPage manuscriptShadow → CSS tokens. BottomSheet/ErrorBoundary/PlaygroundPage verified as exceptions |
| 13 | **Inline style objects recreated every render** (48 in Auth.tsx) | Performance | Audit M2 | 🔧 Decided: extract to module-level constants and CSS classes |
| 14 | **Small touch targets: ChapterNav dots** | A11y | Audit M3 | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) — 24px hit area with visual dot child |
| 15 | **Small touch targets: TagPill buttons** | A11y | Audit M4 | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) — w-4 → w-7 with negative margin |
| 16 | **Missing `will-change` on key animations** | Performance | Audit M5 | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) — added to modal-enter, card-delete, focus-mode, landing-entrance |
| 17 | **TagPill missing aria-label** | A11y | Audit M6 | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) |
| 18 | **IOSInstallGuide step cards missing aria-label** | A11y | Audit M7 | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) — also added Space key + aria-current |
| 19 | **ShareModal tooltip can overflow viewport** | Responsive | Audit M8 | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) |
| 20 | **ChapterNav tooltip overflow** | Responsive | Audit M9 | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) |
| 21 | **Dark theme shadows untinted** | Theming | Redesign 2a | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) — tinted with forest green `rgba(5,20,10,...)` |
| 22 | **Delete animation uses fragile `setTimeout`** | Code quality | Redesign 4b | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) — replaced with `animationend` event |
| 23 | **Missing `text-wrap: balance` on headlines** | Typography | Redesign 1b | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) — also removed manual `<br />` |
| 24 | **Three styling approaches in one codebase** | Maintainability | Redesign 6a | 🔧 Decided: document convention in CLAUDE.md (Tailwind-first, inline for dynamic, `<style>` for complex selectors) |
| 25 | **Inconsistent icon stroke widths** | Visual consistency | Redesign 6b | 🔧 Decided: standardize to 1.5 |
| 26 | **`!important` on mobile headline** | Code quality | Redesign 6c | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) — fixed via `.landing-canvas .landing-headline` specificity bump |

### Low Priority (Nice-to-Have)

| # | Item | Category | Source(s) | Status |
|---|------|----------|-----------|--------|
| 27 | **Search placeholder generic** | Copy | Audit L4, Redesign 4c | 🔧 Decided: change to "Search your thoughts..." |
| 28 | **`--spring-bounce` naming misleading** | Code quality | Audit L3 | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) — renamed to `--ease-out-quint` (5 files) |
| 29 | **Sidebar toolbar italic icon legibility** | UX | Critique minor | ✅ Closed — recognizable in context next to B, H1, H2, H3 |
| 30 | **"Practice Space" breadcrumb label** | UX | Critique minor | ✅ Closed — italic serif is part of brand identity, label is descriptive not interactive |
| 31 | **Footer link density** | UX | Critique minor | ✅ Closed — all links serve a purpose (Privacy/Terms legally required, others functional) |
| 32 | **Dark mode card borders too opaque** | Visual | Critique minor | ✅ [PR #184](https://github.com/anbuneel/yidhan/pull/184) — reduced from 8% to 5% opacity |
| 33 | **Timestamps ALL CAPS** | Typography | Critique minor | ✅ Closed — deliberate typographic choice, changing would affect whole app |

### Creative Exploration (Revisit for design refresh)

| # | Item | Source |
|---|------|--------|
| 34 | **Post-reveal manuscript ambient effect** | Redesign 7a — subtle glow breathing after entrance animation | 📋 Backlog |
| 35 | **Theme toggle metaphor** | Redesign 7b — candle/window or dusk/dawn instead of sun/moon | ✅ Closed — sun/moon is universal, custom metaphors add learning cost |
| 36 | **Entrance stagger timing** | Redesign 7c — delays 0.08s/0.16s/0.24s → 0.12s/0.25s/0.4s for more ceremony | 📋 Backlog |
| 37 | **E2EE as hero instead of tagline** | Critique question — "Your thoughts belong only to you" as primary headline | ✅ Closed — "A quiet space" is the brand, E2EE is a supporting point |
| 38 | **Sidebar toolbar auto-hide** | Critique question — show only on hover/selection for true distraction-free | ✅ Closed — focus mode already addresses this |

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

| Priority | Total | ✅ Done/Closed | 🔧 Next PR | 📋 Backlog |
|----------|-------|---------------|-----------|-----------|
| Pre-Launch | 4 | 3 (PR #184) | 1 (#2 404 page) | 0 |
| High | 8 | 6 (1 PR #184 + 5 closed) | 2 (#10 demo starters, #11b CTA gap) | 0 |
| Medium | 15 | 11 (PR #184) | 3 (#13 inline styles, #24 doc convention, #25 stroke widths) | 0 |
| Low | 7 | 6 (2 PR #184 + 4 closed) | 1 (#27 search placeholder) | 0 |
| Creative | 5 | 3 (closed) | 0 | 2 (#34, #36) |
| Verified | 6 | 6 | 0 | 0 |
| **Total** | **39** | **29** | **7** | **2** |
| | | | + #157 (GitHub) | |

**PR #184:** 17 items implemented. **Discussion round:** 12 items closed (keep as-is). **Next PR:** 7 items decided. **Backlog:** 2 creative explorations.
