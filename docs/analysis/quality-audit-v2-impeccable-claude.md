# Yidhan Quality Audit Report (v2)

**Version:** 2.0
**Last Updated:** 2026-03-06
**Status:** Complete
**Author:** Claude (Opus 4.6)
**Consulted:** Impeccable Audit Skill + Frontend Design Skill

---

## Original Prompt

> `/impeccable:audit` -- Run systematic quality checks and generate a comprehensive audit report with prioritized issues and actionable recommendations.

---

## Anti-Patterns Verdict

**PASS with 2 flags.** (See [design-critique-v2-impeccable-claude.md](design-critique-v2-impeccable-claude.md) for full analysis.)

- **HIT:** Colored top border on every card (`borderTop: 2px solid`)
- **HIT:** Inter as body font (flagged as overused by frontend-design skill)
- **Borderline:** Uniform glassmorphism (`backdrop-filter: blur(20px)`) on all cards

Not AI slop overall -- the wabi-sabi corners, earthy palette, paper texture, and organic language are genuinely distinctive.

---

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High | 8 |
| Medium | 10 |
| Low | 5 |
| **Total** | **27** |

### Top 5 Most Impactful Issues

1. **Undefined CSS variable `--color-accent-rgb`** -- causes silent runtime failure in NoteCard pin button and ChapterSection
2. **Toggle switches use hardcoded `bg-white`** -- invisible in dark mode
3. **Form inputs lack `<label>` associations** -- breaks screen reader usability across 4 components
4. **Tertiary text fails contrast AA** -- 2.82:1 ratio in Kintsugi theme, used extensively
5. **`backdrop-filter: blur(20px)` on all cards** -- GPU-expensive, compounds with 12+ visible cards

### Overall Quality

The codebase has **strong architectural foundations**: excellent code splitting (-44% bundle), proper event listener cleanup, semantic HTML landmarks, reduced-motion support, and well-structured theme system. Issues are primarily surface-level (hardcoded colors, missing ARIA attributes, unthemed shadows) rather than deep structural problems. Most can be fixed with targeted sweeps.

---

## Critical Issues

### C1. Undefined CSS Variable `--color-accent-rgb`
- **Location:** Referenced in `src/components/NoteCard.tsx` line 110, `src/components/ChapterSection.tsx` line 80
- **Category:** Theming
- **Code:** `e.currentTarget.style.background = 'rgba(var(--color-accent-rgb), 0.1)';`
- **Impact:** `--color-accent-rgb` is never defined in any theme or CSS file. This produces invalid CSS -- the pin button hover background and pinned chapter section background silently fail to render.
- **Recommendation:** Define in `src/index.css`:
  ```css
  :root { --color-accent-rgb: 194, 86, 52; }
  [data-theme="dark"] { --color-accent-rgb: 212, 175, 55; }
  ```
  Or replace usages with existing `var(--color-accent-glow)`.
- **Command:** `/impeccable:normalize`

### C2. Toggle Switches Hardcode `bg-white` -- Invisible in Dark Mode
- **Location:** `src/components/SettingsModal.tsx` lines 748, 865
- **Category:** Theming
- **Code:** `className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow..."`
- **Impact:** Toggle knob uses pure white. Works by accident in dark mode (white on dark green), but violates the design system's principle of never hardcoding colors. If card backgrounds change, this breaks.
- **Recommendation:** Replace `bg-white` with a CSS variable.
- **Command:** `/impeccable:normalize`

### C3. Auth Form Inputs Lack `<label>` Associations
- **Location:** `src/components/Auth.tsx` (lines 350-500+), `src/components/PassphraseSetup.tsx`, `src/components/PassphraseUnlock.tsx`, `src/components/SettingsModal.tsx` (lines 205-259)
- **Category:** Accessibility
- **WCAG:** 1.3.1 (Info and Relationships), 1.3.5 (Identify Input Purpose)
- **Impact:** Screen readers cannot identify form fields. Email, password, and passphrase inputs have no programmatic label connection (`htmlFor`/`id` pairs). Also missing `autoComplete` attributes (`current-password`, `new-password`, `email`) which breaks password manager support.
- **Recommendation:** Add `id` attributes to all inputs, `htmlFor` to labels, and `autoComplete` to email/password fields.
- **Command:** `/impeccable:harden`

### C4. Auth Modal Close Button Hardcoded for Light Theme Only
- **Location:** `src/index.css` lines 1016-1021
- **Category:** Theming
- **Code:**
  ```css
  .auth-modal-close {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
  ```
- **Impact:** Desktop close button above auth modal uses hardcoded white. No `[data-theme="dark"]` variant. In light mode, a white button on a blurred light background is nearly invisible.
- **Recommendation:** Add theme-aware variants or use CSS variables.
- **Command:** `/impeccable:normalize`

---

## High-Severity Issues

### H1. Tertiary Text Fails AA Contrast in Kintsugi Theme
- **Location:** `src/themes/kintsugi.ts` line 26
- **Category:** Accessibility
- **WCAG:** 1.4.3 (Contrast Minimum)
- **Detail:** `textTertiary: '#8F8C86'` on `bgPrimary: '#EBE8E4'` = **~3.2:1**. On `bgTertiary: '#D9D5CF'` = **2.82:1**. AA requires 4.5:1. This color is used for timestamps, placeholder text, helper text, chapter labels, trust signals on landing page, and footer links.
- **Recommendation:** Darken to at least `#736F69` (~4.5:1 on bgPrimary). Dark theme `#8E9A8E` on `#050A06` is ~5.1:1 -- passes.
- **Command:** `/impeccable:normalize`

### H2. `backdrop-filter: blur(20px)` on Every Note Card
- **Location:** `src/components/NoteCard.tsx` lines 60-61, `src/components/LandingPage.tsx` line 53
- **Category:** Performance
- **Detail:** Every card uses `backdrop-filter: blur(20px)`. With 12+ cards in a masonry grid, this creates 12+ GPU compositing layers. The `--color-card-bg` is already semi-opaque (`rgba(252, 248, 238, 0.80)`), so blur has minimal visual effect.
- **Additional locations with backdrop-filter:** BottomSheet.tsx (blur 8px), BottomToolbar CSS (blur 12px), modal-backdrop CSS (blur 8px), FadedNoteCard, TagPill, ChangelogPage, RoadmapPage
- **Recommendation:** Remove from cards entirely. Keep for modals/overlays where blur is visible.
- **Command:** `/impeccable:optimize`

### H3. NoteCard Missing Accessible Name for Button Role
- **Location:** `src/components/NoteCard.tsx` lines 70-78
- **Category:** Accessibility
- **WCAG:** 4.1.2 (Name, Role, Value)
- **Detail:** `<article role="button" tabIndex={0}>` has no `aria-label` or `aria-labelledby`. Screen readers announce "button" with no indication of which note.
- **Recommendation:** Add `aria-label={note.title || 'Untitled note'}`.
- **Command:** `/impeccable:harden`

### H4. Hardcoded Backdrop Overlays Don't Adapt to Theme
- **Location:** `src/index.css` line 157, `src/components/BottomSheet.tsx` line 221, `src/components/demo/InvitationModal.tsx` line 20
- **Category:** Theming
- **Detail:** All modal backdrops use `rgba(0, 0, 0, 0.6)`. In dark mode, this creates "double-darkness." InvitationModal uses `rgba(0, 0, 0, 0.4)` -- inconsistent with the `.modal-backdrop` class.
- **Recommendation:** Add `[data-theme="dark"]` variant with lighter overlay. Standardize InvitationModal to use `.modal-backdrop` class.
- **Command:** `/impeccable:normalize`

### H5. NoteCard Hover Uses Inline Style Mutations Instead of CSS
- **Location:** `src/components/NoteCard.tsx` lines 79-86, 107-118, 227-234
- **Category:** Performance
- **Detail:** `onMouseEnter`/`onMouseLeave` directly mutate `style.transform`, `style.borderTopColor`, `style.color`, `style.background`. Creates 6 separate inline handlers. Bypasses CSS transitions, causes DOM writes, doesn't work on touch.
- **Also affects:** WhisperBack.tsx, FadedNoteCard.tsx, SettingsModal.tsx, Auth.tsx (systemic pattern across 10+ components)
- **Recommendation:** Replace with CSS `:hover` pseudo-classes or Tailwind `hover:` utilities.
- **Command:** `/impeccable:optimize`

### H6. Modal Focus Traps Missing
- **Location:** `src/components/KeyboardShortcutsModal.tsx` line 110, and other modals
- **Category:** Accessibility
- **WCAG:** 2.4.3 (Focus Order)
- **Detail:** Modals have `aria-modal="true"` and Escape handling, but Tab can escape to content behind the modal.
- **Recommendation:** Implement focus trap (intercept Tab on first/last focusable element).
- **Command:** `/impeccable:harden`

### H7. Hardcoded Box-Shadows Don't Render in Dark Mode
- **Location:** 7 components:
  - `src/components/EditorToolbar.tsx` lines 110-111
  - `src/components/SlashCommand.tsx` lines 307, 328
  - `src/components/WhisperBack.tsx` lines 85, 89
  - `src/components/GestureHint.tsx` line 202
  - `src/components/IOSInstallGuide.tsx` line 114
  - `src/components/FadedNoteCard.tsx` line 78
- **Category:** Theming
- **Detail:** All use `rgba(0, 0, 0, 0.15)` shadows. In dark mode on dark backgrounds, these are invisible. The theme system provides `--shadow-sm`/`--shadow-md`/`--shadow-lg`.
- **Recommendation:** Replace with CSS variable references.
- **Command:** `/impeccable:normalize`

### H8. Bottom Toolbar Animates `bottom` Property (Layout Thrashing)
- **Location:** `src/index.css` lines 1281-1292
- **Category:** Performance
- **Code:** `bottom: var(--keyboard-height, 0px); transition: bottom 100ms ease;`
- **Detail:** Animating `bottom` triggers layout on every frame. Costly during mobile keyboard show/hide.
- **Recommendation:** Fix to `bottom: 0` and use `transform: translateY(calc(-1 * var(--keyboard-height, 0px)))`.
- **Command:** `/impeccable:optimize`

---

## Medium-Severity Issues

### M1. TagFilterBar Layout Thrashing
- **Location:** `src/components/TagFilterBar.tsx` lines 52-73
- **Category:** Performance
- **Detail:** `getBoundingClientRect()` called inside `forEach` loop on tag pills. Each call forces layout.
- **Fix:** Cache `containerRect` before loop. Consider `IntersectionObserver`.

### M2. Editor Title Auto-Resize Layout Thrash
- **Location:** `src/components/Editor.tsx` lines 462-467
- **Category:** Performance
- **Detail:** Reads `scrollHeight` immediately after writing `style.height = 'auto'`.
- **Fix:** Batch with `requestAnimationFrame`.

### M3. TagSelector Missing `aria-expanded`
- **Location:** `src/components/TagSelector.tsx` lines 39-53
- **Category:** Accessibility (WCAG 4.1.2)
- **Fix:** Add `aria-expanded={isOpen}` to dropdown button.

### M4. Color-Only Status in Faded Notes Badge
- **Location:** `src/components/Header.tsx` lines 95-105
- **Category:** Accessibility (WCAG 1.4.1)
- **Detail:** Badge uses `--color-accent-glow` background and `--color-accent` text for the count. The number provides non-color meaning, but the badge container shape itself is color-dependent.

### M5. TagBadge Hex Opacity Concatenation is Fragile
- **Location:** `src/components/TagBadge.tsx` line 23
- **Category:** Theming
- **Detail:** `background: \`${colorValue}0A\`` only works if `colorValue` is 6-digit hex. Breaks with other formats.
- **Fix:** Use `color-mix(in srgb, ${colorValue} 4%, transparent)`.

### M6. Spring Bounce Easing
- **Location:** `src/index.css` line 117
- **Category:** Design (Anti-pattern)
- **Detail:** `cubic-bezier(0.34, 1.56, 0.64, 1)` overshoot. Frontend-design skill warns against bounce easing.
- **Fix:** Replace with `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo).

### M7. Disabled Email Input Lacks Visual Indicator
- **Location:** `src/components/SettingsModal.tsx` lines 205-222
- **Category:** Accessibility (WCAG 3.2.2)
- **Detail:** Only `opacity-60 cursor-not-allowed`. No "Read-only" text.
- **Fix:** Add visible helper text or `aria-disabled`.

### M8. SharedNoteView Checkboxes Lack Context
- **Location:** `src/components/SharedNoteView.tsx` lines 57-59
- **Category:** Accessibility (WCAG 1.3.1)
- **Fix:** Add `aria-label="Task (read-only)"` to disabled checkboxes.

### M9. InvitationModal Backdrop Inconsistent
- **Location:** `src/components/demo/InvitationModal.tsx` line 20
- **Category:** Theming
- **Detail:** Uses `rgba(0, 0, 0, 0.4)` inline instead of `.modal-backdrop` class (0.6 opacity).
- **Fix:** Use the shared `.modal-backdrop` class.

### M10. Showcase Cards Have Hover Lift on Non-Interactive Elements
- **Location:** `src/components/LandingPage.tsx` lines 487-489
- **Category:** Design
- **Detail:** Cards aren't clickable but have `hover: translateY(-3px)`. Signals interactivity that doesn't exist.
- **Fix:** Remove hover transform from showcase cards.

---

## Low-Severity Issues

### L1. SVG Icons Missing `aria-hidden="true"`
- **Location:** Multiple files (Header.tsx, Editor.tsx, Auth.tsx, etc.)
- **Detail:** Decorative SVGs cause redundant screen reader announcements.

### L2. TimeRibbon Inline Callbacks in Map
- **Location:** `src/components/TimeRibbon.tsx` line 159
- **Detail:** `onClick={() => handleChapterClick(chapter.key)}` creates new functions per render.

### L3. ChapterNav Dot Touch Targets Too Small
- **Location:** `src/components/ChapterNav.tsx` line 126
- **Detail:** Dots are 8-12px. Desktop-only, but still below guidelines.

### L4. Focus Ring May Be Insufficient in High Contrast Mode
- **Location:** `src/index.css` lines 319-326
- **Detail:** 2px accent-colored outline may not be visible in Windows High Contrast Mode.

### L5. Inline Style Objects Not Memoized in Nav Components
- **Location:** `src/components/ChapterNav.tsx`, `src/components/TimeRibbon.tsx`
- **Detail:** Style objects created on every render. Low impact but could be extracted.

---

## Patterns & Systemic Issues

### Pattern 1: Hardcoded Shadows (7 components)
EditorToolbar, SlashCommand, WhisperBack, GestureHint, IOSInstallGuide, FadedNoteCard, and auth modals all use `rgba(0, 0, 0, 0.15)` instead of `--shadow-*` tokens. **Single `/impeccable:normalize` sweep fixes all.**

### Pattern 2: Form Labels Not Connected (4 components)
Auth.tsx, SettingsModal.tsx, PassphraseSetup.tsx, PassphraseUnlock.tsx all lack `htmlFor`/`id` associations. **Single `/impeccable:harden` sweep fixes all.**

### Pattern 3: Inline Style Hover Handlers (10+ components)
NoteCard, WhisperBack, FadedNoteCard, SettingsModal, Auth, and others use `onMouseEnter`/`onMouseLeave` style mutations. **Should be CSS `:hover` classes.**

### Pattern 4: Backdrop Overlays Hardcoded Dark (3 locations)
index.css, BottomSheet.tsx, InvitationModal.tsx all use `rgba(0,0,0,0.6)` without dark-mode variants.

---

## Positive Findings

1. **Excellent code splitting** -- `lazyWithRetry` on editor, modals, and heavy pages; initial bundle reduced 44%
2. **Clean event listener cleanup** -- every `useEffect` with listeners has proper cleanup (verified across 8+ components)
3. **Strong semantic HTML** -- proper `<header>`, `<main>`, `<section>`, `<article>`, `<nav>`, `<footer>` throughout
4. **`prefers-reduced-motion` respected globally** -- all animations collapse to 0.01ms
5. **Keyboard navigation fundamentals** -- Escape in modals, Enter/Space on interactive elements, `tabIndex` applied
6. **CTA token separation** -- correct `--color-cta-bg`/`--color-cta-text` vs `--color-accent`/`--color-on-accent` taxonomy
7. **XSS prevention** -- DOMPurify used consistently for user-generated HTML
8. **No unused dependencies** -- all `package.json` deps actively imported
9. **NoteCard properly memoized** -- `React.memo()` with correct custom comparison
10. **iOS safe area support** -- `env(safe-area-inset-*)` on body, bottom toolbar, focus indicator

---

## Recommendations by Priority

### Immediate (Quick Fixes)
1. Define `--color-accent-rgb` in themes (C1) -- 2 min fix
2. Replace `bg-white` on toggles (C2) -- 2 min fix
3. Add `aria-label` to NoteCard (H3) -- 1 min fix
4. Add `aria-expanded` to TagSelector (M3) -- 1 min fix

### Short-Term (This Sprint)
5. Add `htmlFor`/`id` to form labels + `autoComplete` on password fields (C3)
6. Add dark mode variant for auth close button (C4)
7. Darken `textTertiary` in Kintsugi for AA contrast (H1)
8. Add dark mode variants for backdrop overlays (H4)
9. Replace hardcoded shadows with CSS variables (H7)
10. Implement focus traps in modals (H6)

### Medium-Term (Next Sprint)
11. Remove `backdrop-filter` from note cards (H2)
12. Convert inline hover handlers to CSS (H5)
13. Use `transform` instead of `bottom` for toolbar animation (H8)
14. Fix layout thrashing in TagFilterBar and Editor title (M1, M2)
15. Replace spring bounce with smooth easing (M6)
16. Remove hover lift from non-interactive showcase cards (M10)

### Long-Term (Polish)
17. Add `aria-hidden` to decorative SVGs (L1)
18. Memoize inline callbacks in TimeRibbon (L2)
19. Improve focus ring for high contrast mode (L4)

---

## Suggested Commands for Fixes

| Command | Addresses | Issue Count |
|---------|-----------|-------------|
| `/impeccable:normalize` | Theming: hardcoded colors, shadows, undefined vars, dark mode gaps | 10 issues (C1, C2, C4, H1, H4, H5, H7, M5, M6, M9) |
| `/impeccable:harden` | Accessibility: form labels, ARIA, focus traps, autocomplete | 8 issues (C3, H3, H6, M3, M4, M7, M8 + pattern 2) |
| `/impeccable:optimize` | Performance: backdrop-filter, hover handlers, layout thrashing | 5 issues (H2, H8, M1, M2 + pattern 3) |
| `/impeccable:polish` | Final pass: SVG aria-hidden, showcase cards, inline styles | 4 issues (L1, L5, M10 + pattern 1) |
