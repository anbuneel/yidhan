# Yidhan Design Audit — Impeccable Audit Skill

**Version:** 1.0
**Last Updated:** 2026-03-28
**Status:** Living Document
**Author:** Claude (Opus 4.6)
**Consulted:** Impeccable Audit Skill + Impeccable Frontend-Design Skill

---

## Original Prompt

> Run impeccable:audit to see if it catches the same issues as the redesign-existing-projects skill audit.

---

## Anti-Patterns Verdict

**Pass.** This does NOT look AI-generated. Checked against the frontend-design skill's DON'T list:

| Anti-Pattern | Status |
|---|---|
| AI color palette (cyan-on-dark, purple-blue gradients) | **Pass** — Earthy terracotta/gold palette |
| Gradient text for impact | **Pass** — No gradient text anywhere |
| Glassmorphism everywhere | **Pass** — `backdrop-filter` only on modal backdrop (purposeful) |
| Hero metric layout template | **Pass** — No metrics on landing page |
| Three equal card columns | **Pass** — Masonry layout with variable heights |
| Generic fonts (Inter, Roboto, Arial) | **Pass** — Cormorant Garamond + Source Sans 3 |
| Bounce/elastic easing | **Pass** — `--spring-bounce` is named misleadingly but uses `cubic-bezier(0.22, 1, 0.36, 1)` (smooth ease-out-quint) |
| Nested cards inside cards | **Pass** — Flat hierarchy |
| Dark mode with glowing accents by default | **Borderline** — Dark IS default, accent has glow, but the forest-green-with-gold palette is distinctive enough to not feel generic |
| Modals for everything | **Borderline** — Settings, Tags, Share, Conflict, Delete confirmation are modals. BottomSheet on mobile helps, but there are a lot of modals |

**Verdict: If someone said "AI made this," you'd push back.** The wabi-sabi corners, paper noise, editorial typography, and copy voice are too intentional.

---

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 5 |
| Medium | 9 |
| Low | 6 |
| **Total** | **20** |

**Top 5 issues:**
1. Layout thrashing in Editor scroll handler (Performance)
2. Focus-mode animates layout properties (Performance)
3. Modal fixed widths break on narrow viewports (Responsive)
4. No skip-to-content link (Accessibility)
5. 8 files with hardcoded colors outside theme tokens (Theming)

**Overall quality: Strong.** The codebase has good accessibility foundations, intentional design, and solid architecture. Issues are mostly performance optimization and responsive edge cases — not fundamental gaps.

---

## Detailed Findings by Severity

### High-Severity Issues

**H1. Layout thrashing in Editor scroll handler**
- **Location:** `src/components/Editor.tsx` ~lines 293-310
- **Category:** Performance
- **Description:** Scroll handler reads `scrollTop`, `offsetTop`, `scrollHeight`, `clientHeight` then immediately writes to `glowEl.style.top` in the same synchronous block. Same pattern at lines ~580 and ~626 with `scrollHeight` → `style.height` for title auto-resize.
- **Impact:** Forces browser to recalculate layout mid-frame. On lower-powered devices (mobile, older Android), causes jank during scrolling.
- **Recommendation:** Wrap measurement+write in `requestAnimationFrame`. Title auto-resize should batch reads before writes.
- **Suggested command:** `/optimize`

**H2. Focus-mode animates layout properties**
- **Location:** `src/index.css` ~lines 1348-1373
- **Category:** Performance
- **Description:** `.focus-mode-target` transitions `max-height`, `margin`, and `padding` — all of which trigger layout recalculation on every animation frame.
- **Impact:** Animating from `max-height: 200px` to `0` forces the browser to recalculate the layout of every element below it on every frame. On a library with many notes visible, this is expensive.
- **Recommendation:** Replace with `transform: scaleY()` + `clip-path` approach, or use `grid-template-rows: 1fr → 0fr` transition (the frontend-design skill specifically recommends this).
- **Suggested command:** `/animate`

**H3. Modal fixed widths break on narrow viewports**
- **Location:** `ShareModal.tsx:221` (`w-[420px]`), `TagModal.tsx:108` (`w-[400px]`), `Editor.tsx:1409` (delete dialog `w-[400px]`)
- **Category:** Responsive
- **Description:** Modals use fixed pixel widths without responsive constraints. On phones <420px wide, these overflow or get clipped.
- **Impact:** Modals become unusable on small phones. Share and Tag features break.
- **Recommendation:** Change to `w-full max-w-[420px]` with parent padding.
- **Suggested command:** `/adapt`

**H4. No skip-to-content link**
- **Location:** Missing from all layout components
- **Category:** Accessibility (WCAG 2.1 SC 2.4.1 — Level A)
- **Description:** No skip navigation link exists. Keyboard users must tab through the entire header on every page load.
- **Impact:** WCAG A violation. Screen reader users especially impacted.
- **Recommendation:** Add a visually hidden `<a>` at the top of the layout that becomes visible on focus, linking to `#main-content`.
- **Suggested command:** `/harden`

**H5. Dropdown menus overflow narrow viewports**
- **Location:** `TagSelector.tsx:42` (`min-w-[200px]`), `HeaderShell.tsx:191` (`min-w-[200px]`), `Editor.tsx:929` (`min-w-[180px]`)
- **Category:** Responsive
- **Description:** Dropdown menus have fixed `min-width` and absolute positioning. On narrow viewports, they overflow the screen edge.
- **Impact:** Menu items get cut off or cause horizontal scroll on mobile.
- **Recommendation:** Add `max-w-[calc(100vw-2rem)]` or use viewport-aware positioning.
- **Suggested command:** `/adapt`

---

### Medium-Severity Issues

**M1. Hardcoded colors outside theme tokens** (8 files)
- **Locations:** `App.tsx`, `BottomSheet.tsx`, `main.tsx`, `IOSInstallGuide.tsx`, `LandingPage.tsx`, `PlaygroundPage.tsx`, `ErrorBoundary.tsx`, `LogoTestPage.tsx`
- **Category:** Theming
- **Description:** Raw RGBA/hex values used instead of CSS custom properties. Includes overlay backdrops (`rgba(0,0,0,0.6)`), toast icon colors (`#fff`), borders, and shadows.
- **Impact:** These values won't respond to theme changes. If a new theme is added, these surfaces will look wrong.
- **Recommendation:** Create tokens for `--color-overlay`, `--color-border-subtle`, and map existing values.
- **Suggested command:** `/normalize`

**M2. Inline style objects recreated every render** (20+ instances)
- **Locations:** `Auth.tsx` (6+ instances), `TagFilterBar.tsx`, `NoteCard.tsx`, `Header.tsx`
- **Category:** Performance
- **Description:** `style={{ fontFamily: 'var(--font-body)', background: '...' }}` creates a new object on every render, triggering unnecessary reconciliation.
- **Impact:** Minor on desktop, measurable on mobile with many cards. NoteCard is `React.memo`'d but the style objects are inside the render function.
- **Recommendation:** Extract static style objects to module-level constants (like Auth.tsx already does for `inputBaseStyles`).
- **Suggested command:** `/optimize`

**M3. Small touch targets on ChapterNav dots**
- **Location:** `ChapterNav.tsx:126` — `w-2 h-2` (8px) inactive, `w-3 h-3` (12px) active
- **Category:** Accessibility (WCAG 2.5.8 — Target Size)
- **Description:** Visual dots are well below 44x44px. Parent button may provide a larger hit area, but needs verification.
- **Impact:** Difficult to tap on touch devices. Frustrating navigation.
- **Recommendation:** Keep visual dots small but ensure the clickable `<button>` wrapper is at least 44x44px with padding.
- **Suggested command:** `/harden`

**M4. Small touch targets on TagPill buttons**
- **Location:** `TagPill.tsx:76, 102` — `w-4 h-4` (16px) edit/remove buttons
- **Category:** Accessibility
- **Description:** Edit and remove buttons on tag pills are 16x16px.
- **Impact:** Nearly impossible to tap accurately on mobile.
- **Recommendation:** Increase to at least `w-8 h-8` with `p-2` padding around the icon.
- **Suggested command:** `/harden`

**M5. Missing `will-change` on key animations**
- **Location:** `src/index.css` — modal-enter, rising-wave, card-delete, focus-mode, view transitions
- **Category:** Performance
- **Description:** Only `landing-text-reveal` declares `will-change`. Other animations lack it.
- **Impact:** Browser can't pre-promote layers, causing first-frame jank on animation start.
- **Recommendation:** Add `will-change: transform, opacity` to elements that animate frequently. Remove after animation completes to free memory.
- **Suggested command:** `/optimize`

**M6. TagPill role="button" div without aria-label**
- **Location:** `TagPill.tsx:18`
- **Category:** Accessibility
- **Description:** `<div role="button">` without explicit aria-label. Text content is visible but screen readers benefit from explicit labeling.
- **Impact:** Screen reader users hear the tag name but don't know it's a filter action.
- **Recommendation:** Add `aria-label={`Filter by ${tag.name}`}`.
- **Suggested command:** `/harden`

**M7. IOSInstallGuide step cards without aria-label**
- **Location:** `IOSInstallGuide.tsx:262`
- **Category:** Accessibility
- **Description:** Interactive step selection divs with `role="button"` lack accessible names.
- **Impact:** Screen reader users can't identify which step to select.
- **Suggested command:** `/harden`

**M8. ShareModal tooltip can overflow viewport**
- **Location:** `ShareModal.tsx:446` — `w-64` with `absolute left-0`
- **Category:** Responsive
- **Description:** Fixed-width tooltip positioned absolutely can extend past viewport edge on mobile.
- **Recommendation:** Add `max-w-[calc(100vw-2rem)]` or use a popover with viewport-aware positioning.
- **Suggested command:** `/adapt`

**M9. ChapterNav tooltip overflow**
- **Location:** `ChapterNav.tsx:96` — `whitespace-nowrap` without viewport constraint
- **Category:** Responsive
- **Description:** Tooltip for long chapter labels uses `whitespace-nowrap` without truncation or max-width.
- **Recommendation:** Add `max-w-[200px] truncate`.
- **Suggested command:** `/adapt`

---

### Low-Severity Issues

**L1.** `ErrorBoundary.tsx` uses hardcoded fallback colors in `var()` — acceptable as crash-state fallbacks, but could be consolidated.

**L2.** `LogoTestPage.tsx` uses hardcoded hex colors — acceptable as a dev-only test page.

**L3.** `--spring-bounce` naming — the variable name suggests bounce easing but it's actually `ease-out-quint`. Misleading but cosmetic.

**L4.** Search input placeholder "Search..." — generic, could match the app's voice ("Search your thoughts...").

**L5.** Editor export dropdown `min-w-[180px]` — less critical than header/tag dropdowns since the editor is wider.

**L6.** `TagFilterBar.tsx` DOM measurements in loop — safely wrapped in effect with guards, not a real problem.

---

## Patterns & Systemic Issues

1. **Modal fixed widths** — 3 modals use `w-[Xpx]` without `w-full max-w-[Xpx]`. Systemic pattern that needs a single fix pattern applied to all modals.
2. **Inline style objects** — 20+ instances of `style={{}}` creating new objects every render. Most use the same `fontFamily` and `background` patterns — a candidate for shared CSS classes.
3. **Touch targets below 44px** — ChapterNav dots and TagPill action buttons are both below minimum. Pattern: small visual elements need larger hit areas.

---

## Positive Findings

These are strong and should be maintained:

- **ARIA usage is excellent.** `aria-label` on buttons, `aria-expanded` on dropdowns, `aria-live="polite"` on search results, `role="alertdialog"` on delete confirmation.
- **Heading hierarchy is clean.** No skipped levels across all pages.
- **Focus rings are consistent.** `.focus-ring:focus-visible` pattern applied throughout.
- **`prefers-reduced-motion` is comprehensive.** All animations collapse globally.
- **Images have proper alt text.** Logo handles decorative vs meaningful images correctly with `aria-hidden`.
- **No bounce/elastic easing.** All animation curves are smooth, natural deceleration.
- **No gradient text.** No AI-slop gradient text anywhere.
- **No glassmorphism abuse.** Backdrop blur is used purposefully (modal overlay only).
- **Form inputs are properly labeled.** PassphraseSetup, TagModal, Auth all have `<label>` elements.
- **Spring-like cubic-beziers** feel weighty and intentional — not the default `ease` everywhere.

---

## Recommendations by Priority

### Immediate (before launch)
1. Fix skip-to-content link (H4) — WCAG A requirement
2. Fix modal responsive widths (H3) — core features break on mobile

### Short-term (this sprint)
3. Fix layout thrashing in Editor (H1) — `requestAnimationFrame` wrap
4. Fix dropdown overflow on mobile (H5) — viewport-aware positioning
5. Fix touch targets (M3, M4) — larger hit areas

### Medium-term (next sprint)
6. Replace focus-mode layout animations (H2) — `grid-template-rows` approach
7. Extract inline style objects to constants (M2)
8. Add theme tokens for hardcoded colors (M1)
9. Add `will-change` to key animations (M5)
10. Fix ARIA labels on TagPill and IOSInstallGuide (M6, M7)

### Long-term (nice-to-haves)
11. Tooltip viewport overflow protection (M8, M9)
12. Rename `--spring-bounce` variable (L3)
13. Update search placeholder copy (L4)

---

## Suggested Commands for Fixes

| Command | Issues addressed | Count |
|---------|-----------------|-------|
| `/adapt` | H3, H5, M8, M9 — responsive/viewport issues | 4 |
| `/optimize` | H1, M2, M5 — performance issues | 3 |
| `/harden` | H4, M3, M4, M6, M7 — accessibility gaps | 5 |
| `/animate` | H2 — replace layout property animations | 1 |
| `/normalize` | M1 — hardcoded colors to tokens | 1 |
| `/clarify` | L4 — search placeholder copy | 1 |

---

## Comparison: Redesign Skill vs Impeccable Audit

### Overlapping findings (6)
Both audits caught: skip-to-content link missing, dark theme shadows untinted, thin headline weight, mobile layout centering, inline JS hover pattern, search placeholder.

### Redesign-only findings
404 page missing, three styling approaches, icon strokeWidth inconsistency, `!important` specificity issue, theme toggle metaphor, entrance stagger timing, proof rail size, CTA breathing room.

### Impeccable-only findings
Layout thrashing in Editor, focus-mode expensive animations, modal fixed widths, dropdown overflow, touch targets, hardcoded colors (8 files), missing will-change, inline style objects, ARIA labels on TagPill/IOSInstallGuide.

### Key insight
The redesign skill is stronger on **taste and originality**. The impeccable audit is stronger on **technical quality and compliance**. Together they give near-complete coverage. Neither alone would have been sufficient.
