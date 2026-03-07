# Yidhan Quality Audit Report

**Version:** 1.0
**Last Updated:** 2026-03-06
**Status:** Complete
**Author:** Claude (Opus 4.6)
**Consulted:** Impeccable Audit Skill + Frontend Design Skill

---

## Original Prompt

> `/impeccable:audit` — Run systematic quality checks and generate a comprehensive audit report with prioritized issues and actionable recommendations.

---

## Anti-Patterns Verdict

**PASS.** Covered in detail in `design-critique-impeccable-claude.md`. Quick summary: no AI slop detected. Wabi-sabi asymmetric corners, organic palette, and editorial typography are genuinely distinctive. One flag: Inter as body font is generic (see Issue T-2 below).

---

## Executive Summary

**Total issues found: 28**
- Critical: 2
- High: 7
- Medium: 14
- Low: 5

**Top 5 most critical issues:**
1. Missing `--color-accent-rgb` CSS variable causes broken styling (Theming)
2. Tertiary text fails WCAG AA contrast in light theme (Accessibility)
3. Touch targets consistently below 44px minimum (Responsive)
4. Form error messages not associated with inputs via `aria-describedby` (Accessibility)
5. `backdrop-filter: blur(20px)` on 12+ elements hurts mobile performance (Performance)

**Overall quality:** Good foundation with strong design identity. The core architecture (CSS custom properties, semantic tokens, responsive breakpoints) is well-structured. Issues are mostly polish-level — no fundamental architectural problems.

---

## Detailed Findings by Severity

### Critical Issues

#### C-1: Missing `--color-accent-rgb` CSS Variable

- **Location:** `src/index.css` (missing from both `:root` and `[data-theme="dark"]`)
- **Severity:** Critical
- **Category:** Theming
- **Description:** Two components reference `--color-accent-rgb` which is never defined:
  - `src/components/ChapterSection.tsx:80` — `rgba(var(--color-accent-rgb), 0.03)`
  - `src/components/NoteCard.tsx:110` — `rgba(var(--color-accent-rgb), 0.1)`
- **Impact:** `rgba()` with an undefined variable produces invalid CSS. The pin button hover background in NoteCard and the chapter section accent are silently broken — no visible styling applied.
- **Recommendation:** Add to `src/index.css`:
  ```css
  :root { --color-accent-rgb: 194, 86, 52; }
  [data-theme="dark"] { --color-accent-rgb: 212, 175, 55; }
  ```
- **Suggested command:** `/normalize`

#### C-2: Tertiary Text Fails WCAG AA Contrast (Light Theme)

- **Location:** `src/index.css:20` — `--color-text-tertiary: #8F8C86`
- **Severity:** Critical
- **Category:** Accessibility
- **WCAG:** 1.4.3 Contrast (Minimum)
- **Description:** `#8F8C86` on `#EBE8E4` (bg-primary) produces approximately **3.2:1** contrast — fails the 4.5:1 AA minimum for normal text. This color is used extensively:
  - Auth.tsx: "8+ characters" password hint
  - PassphraseSetup.tsx: setup instructions
  - SettingsModal.tsx: vault info text
  - NoteCard.tsx: timestamps
  - ChapteredLibrary.tsx: empty state copy
  - LandingPage.tsx: "For free" text, trust signals, footer links
- **Impact:** Users with low vision, color blindness, or bright ambient lighting cannot read tertiary text. This affects informational hints, timestamps, and navigation — not just decorative elements.
- **Recommendation:** Darken `--color-text-tertiary` to at least `#736F69` (~4.5:1) or `#5E5B56` (~5.5:1). Dark theme's `#8E9A8E` on `#050A06` is ~5.1:1 — passes but is marginal.
- **Suggested command:** `/colorize`

---

### High-Severity Issues

#### H-1: Touch Targets Below 44px Minimum (Systemic)

- **Location:** Multiple components (see table below)
- **Severity:** High
- **Category:** Responsive
- **WCAG:** 2.5.8 Target Size (Minimum)
- **Description:** Many interactive elements are below the 44x44px minimum touch target:

| Element | File | Size | Gap |
|---------|------|------|-----|
| Pin button | NoteCard.tsx:94 | 32px | -12px |
| Delete button | NoteCard.tsx:210 | 32px | -12px |
| Search clear button | Header.tsx:159 | 20px | -24px |
| Theme toggle | HeaderShell.tsx:163 | 36px | -8px |
| Avatar button | HeaderShell.tsx:194 | 36px | -8px |
| Toolbar buttons | EditorToolbar.tsx:26 | 32px | -12px |
| BottomSheet close | BottomSheet.tsx:26 | 32px | -12px |
| Tag edit/remove icons | TagPill.tsx:77 | 16px | -28px |

- **Impact:** Mobile users frequently mis-tap, especially on NoteCard pin/delete and toolbar buttons. The 20px search clear button is especially problematic.
- **Recommendation:** Increase visible size to 40px+ or add invisible padding to reach 44px touch area. Note: NoteCard pin/delete are hidden on mobile in favor of swipe gestures (SwipeableNoteCard) — this partially mitigates the issue for those two buttons.
- **Suggested command:** `/adapt`

#### H-2: Form Error Messages Not Linked to Inputs

- **Location:** Auth.tsx:691, PassphraseSetup.tsx:43, PassphraseUnlock.tsx:124, SettingsModal.tsx:531, TagModal.tsx:28
- **Severity:** High
- **Category:** Accessibility
- **WCAG:** 3.3.1 Error Identification
- **Description:** Error messages render as standalone `<p>` elements not associated with the field that caused the error. No `aria-describedby` connection exists.
- **Impact:** Screen reader users hear the error only when they navigate to it — they don't know which field failed or what the error says while interacting with the field.
- **Recommendation:** Add `id` to error elements, `aria-describedby` to corresponding inputs.
- **Suggested command:** `/harden`

#### H-3: Form Inputs Missing `autocomplete` Attributes

- **Location:** Auth.tsx (email ~line 571, passwords ~lines 598, 637), PassphraseSetup.tsx, PassphraseUnlock.tsx
- **Severity:** High
- **Category:** Accessibility
- **WCAG:** 1.3.5 Identify Input Purpose
- **Description:** Login/signup email and password fields lack `autoComplete` attributes. SettingsModal.tsx has `autoComplete="current-password"` on one field (good) but missing on new/confirm password fields.
- **Impact:** Password managers can't auto-fill correctly. Users on mobile lose the keyboard "next field" autofill button.
- **Recommendation:** Add `autoComplete="email"`, `autoComplete="current-password"`, `autoComplete="new-password"` to respective fields.
- **Suggested command:** `/harden`

#### H-4: `backdrop-filter: blur(20px)` on 12+ Elements

- **Location:** NoteCard.tsx:60, Auth.tsx:338, LandingPage.tsx:53, FadedNoteCard.tsx:73, TagPill.tsx:39/156/197, ChangelogPage.tsx:87, RoadmapPage.tsx:96, and more
- **Severity:** High
- **Category:** Performance
- **Description:** `backdrop-filter: blur(20px)` creates a GPU compositing layer per element. With a masonry grid of note cards, this can mean 20+ compositing layers on a single screen. The visual effect is barely perceptible on the mostly-opaque card backgrounds.
- **Impact:** Significant battery drain and potential jank on mid/low-end mobile devices. Frame drops during scroll.
- **Recommendation:** Remove backdrop-filter from NoteCard and TagPill (effect is invisible on opaque backgrounds). Keep only on modals and overlays where the blur is actually visible. Consider `@media (pointer: coarse) { backdrop-filter: none }` as a mobile fallback.
- **Suggested command:** `/optimize`

#### H-5: Inline Style Mutations in Mouse Event Handlers

- **Location:** NoteCard.tsx:79-86/107-118, WhisperBack.tsx:87-93, FadedNoteCard.tsx:114-120, BottomSheet.tsx:28-33, Auth.tsx (multiple), SettingsModal.tsx (multiple)
- **Severity:** High
- **Category:** Performance
- **Description:** Components use `onMouseEnter`/`onMouseLeave` to mutate `e.currentTarget.style.*` directly. This bypasses React's reconciliation, forces synchronous style recalc, and creates unmaintainable hover logic scattered across JSX.
- **Impact:** Style thrashing during rapid mouse movement. Also, these hover states don't work on touch devices (no hover event), creating a disparity between desktop and mobile experience.
- **Recommendation:** Replace with CSS `:hover` pseudo-classes or Tailwind `hover:` utilities. This is a systemic pattern affecting 10+ components.
- **Suggested command:** `/normalize`

#### H-6: Breakpoint Inconsistencies Across Components

- **Location:** Multiple files
- **Severity:** High
- **Category:** Responsive
- **Description:** Four different breakpoint values used across the codebase:
  - `640px` — TagFilterBar.tsx:19 (`window.innerWidth < 640`), various `sm:` Tailwind
  - `700px` — ChapteredLibrary.tsx:16 (`MOBILE_BREAKPOINT = 700`)
  - `767px` — index.css (editor toolbar, bottom toolbar, focus mode media queries)
  - `768px` — Tailwind `md:` breakpoint, auth modal CSS
- **Impact:** Layout shifts happen at different viewport widths for different components. A user at 710px sees compact cards but desktop tag filter bar. This creates visual inconsistency during resize or on mid-size tablets.
- **Recommendation:** Standardize on 768px (Tailwind `md:`) as the primary mobile/desktop breakpoint. Update ChapteredLibrary to 768px and TagFilterBar to 768px.
- **Suggested command:** `/adapt`

#### H-7: TagPill Edit/Remove Buttons Invisible on Touch Devices

- **Location:** TagPill.tsx:75-91, 109-125
- **Severity:** High
- **Category:** Responsive
- **Description:** Edit (pencil) and remove (X) buttons use `opacity-0 group-hover:opacity-100` — they're invisible until hover. Touch devices have no hover, making these buttons inaccessible.
- **Impact:** Mobile users cannot edit or remove tags from the filter bar. They must use a different flow (TagModal) which isn't immediately discoverable.
- **Recommendation:** On `@media (pointer: coarse)`, make buttons always visible (perhaps at reduced opacity) or provide a long-press/tap interaction.
- **Suggested command:** `/adapt`

---

### Medium-Severity Issues

#### M-1: Search Clear Button Missing `aria-label`
- **Location:** Header.tsx:157-168
- **WCAG:** 4.1.2 Name Role Value
- **Fix:** Add `aria-label="Clear search"`
- **Suggested command:** `/harden`

#### M-2: ConflictModal Missing `aria-modal="true"`
- **Location:** ConflictModal.tsx (modal div)
- **WCAG:** 2.4.3 Focus Order
- **Fix:** Add `aria-modal="true"` alongside existing `role="dialog"`
- **Suggested command:** `/harden`

#### M-3: TagModal Inputs Missing `htmlFor`/`id` Association
- **Location:** TagModal.tsx:134
- **WCAG:** 1.3.1 Info and Relationships
- **Fix:** Add `id="tag-name"` to input, `htmlFor="tag-name"` to label
- **Suggested command:** `/harden`

#### M-4: Disabled Buttons Use `opacity-50` (Contrast Risk)
- **Location:** Auth.tsx, SettingsModal.tsx (submit buttons)
- **WCAG:** 1.4.3 Contrast (Minimum)
- **Description:** `disabled:opacity-50` on CTA buttons halves the contrast. While WCAG technically exempts disabled controls, this creates a poor visual experience.
- **Fix:** Use distinct disabled color instead of opacity reduction.
- **Suggested command:** `/normalize`

#### M-5: OverflowMenu Missing ARIA Menu Role
- **Location:** EditorToolbar.tsx:89-121
- **WCAG:** 1.3.1 Info and Relationships
- **Fix:** Add `role="menu"` to dropdown container, `role="menuitem"` to children.
- **Suggested command:** `/harden`

#### M-6: Hardcoded Shadow `rgba()` Values Don't Theme
- **Location:** EditorToolbar.tsx:110, SlashCommand.tsx:307/328, WhisperBack.tsx:85/89/93, FadedNoteCard.tsx:78, GestureHint.tsx:202, IOSInstallGuide.tsx:114
- **Description:** 10+ hardcoded `rgba(0,0,0,...)` shadows bypass design tokens. In dark theme, some shadows are invisible.
- **Fix:** Replace with `var(--shadow-sm)`, `var(--shadow-md)`, or `var(--shadow-lg)`.
- **Suggested command:** `/normalize`

#### M-7: `-webkit-backdrop-filter` Missing from `.modal-backdrop`
- **Location:** index.css:157-160
- **Description:** CSS class has `backdrop-filter: blur(8px)` but no `-webkit-` prefix. Safari requires the prefix.
- **Fix:** Add `-webkit-backdrop-filter: blur(8px);` (already present as comment in the CLAUDE.md).
- **Suggested command:** `/polish`

#### M-8: ErrorBoundary Fallback Colors are Dark-Theme Only
- **Location:** ErrorBoundary.tsx (multiple lines with `var(--color-*, #dark-fallback)`)
- **Description:** CSS variable fallbacks like `var(--color-bg-primary, #1a1f1a)` use dark theme hex values. If CSS variables fail to load, light-theme users see a dark page.
- **Fix:** Use light-theme fallbacks (the more common case) or omit fallbacks.
- **Suggested command:** `/harden`

#### M-9: `--spring-bounce` Uses Overshoot Easing
- **Location:** index.css:117 — `cubic-bezier(0.34, 1.56, 0.64, 1)`
- **Description:** The frontend-design skill guidelines state: "DON'T use bounce or elastic easing." The 1.56 y-value creates visible overshoot.
- **Current usage:** Applied to `card-enter` and `auth-modal-scale-in` animations (transform-only, which is safe). But the overshoot feels playful rather than calm — inconsistent with wabi-sabi.
- **Fix:** Replace with smooth exponential easing: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo).
- **Suggested command:** `/animate`

#### M-10: Editor Toolbar Buttons 32px on Mobile
- **Location:** EditorToolbar.tsx:26, index.css:1127-1131
- **Description:** Mobile override sets `min-width: 32px; min-height: 32px` — still below 44px.
- **Fix:** Increase mobile toolbar buttons to `min-width: 40px; min-height: 40px`.
- **Suggested command:** `/adapt`

#### M-11: Landing Page Theme Toggle Separated from Content on Mobile
- **Location:** LandingPage.tsx:302-327
- **Description:** On mobile, theme toggle and Sign In are in the right panel header, visually separated from the hero content above.
- **Fix:** Move these controls to the left panel header on mobile.
- **Suggested command:** `/adapt`

#### M-12: `NoteCard` Hover Lift is Aggressive
- **Location:** NoteCard.tsx:80 — `translateY(-6px)`
- **Description:** 6px lift on hover feels like a dashboard widget, not paper. Also: the inline style mutation means this doesn't use CSS transitions cleanly.
- **Fix:** Reduce to `translateY(-3px)` and move to CSS `:hover` pseudo-class.
- **Suggested command:** `/quieter`

#### M-13: Showcase Cards Have Hover Lift on Non-Interactive Elements
- **Location:** LandingPage.tsx:487-489 — `.showcase-card:hover { transform: translateY(-3px) }`
- **Description:** Landing page showcase cards aren't clickable (no `onClick`), but they have hover lift. This signals interactivity that doesn't exist — a broken affordance.
- **Fix:** Remove hover transform from showcase cards, or make them feel more decorative.
- **Suggested command:** `/polish`

#### M-14: Components Not Memoized in Lists
- **Location:** TagPill.tsx, TagBadge.tsx, ChapterSection.tsx
- **Description:** TagPill and TagBadge render in lists but aren't wrapped in `React.memo()`. NoteCard is correctly memoized.
- **Fix:** Add `memo()` wrapper to TagPill, TagBadge, and ChapterSection.
- **Suggested command:** `/optimize`

---

### Low-Severity Issues

#### L-1: Google OAuth SVG Colors Hardcoded (Intentional)
- **Location:** Auth.tsx:92-95
- **Note:** Brand colors — correct as-is. No action needed.

#### L-2: iOS Install Guide Safari Gradient Hardcoded
- **Location:** IOSInstallGuide.tsx:175 — `linear-gradient(135deg, #0066CC, #00A8E8)`
- **Note:** Represents Safari icon. Intentional. No action needed.

#### L-3: TagBadge Test Hardcodes Color Hex
- **Location:** TagBadge.test.tsx:33 — `expect(dot).toHaveStyle({ background: '#D4AF37' })`
- **Fix:** Reference `TAG_COLORS['gold']` instead.

#### L-4: Paper Noise Texture at z-index 9999
- **Location:** index.css:288-301
- **Description:** `z-index: 9999` with `pointer-events: none` renders over everything including modals. Adds texture but could interfere with readability on dark overlays.
- **Note:** Currently works due to low opacity (0.05-0.18). Monitor if new overlays are added.

#### L-5: Inconsistent Webkit Prefix on `backdrop-filter` in Inline Styles
- **Location:** Some components include both `backdropFilter` and `WebkitBackdropFilter`, others only the standard property.
- **Fix:** Standardize — either always include both or rely on CSS class.

---

## Patterns & Systemic Issues

1. **Inline style mutations for hover states** — Found in 10+ components. Should be CSS `:hover` rules. This is the single most pervasive code quality issue.
2. **Touch targets consistently below 44px** — 9 distinct interactive elements across the app. Systemic pattern, not isolated.
3. **`backdrop-filter: blur(20px)` everywhere** — Applied to every card-like element. Most are imperceptible. Only needed on modal overlays.
4. **Breakpoint fragmentation** — 4 different values (640/700/767/768px) for mobile detection.
5. **Error messages not programmatically linked** — Pattern across all form components.

---

## Positive Findings

1. **Excellent ARIA on modals** — Auth, Settings, Share, and most modals use `role="dialog"`, `aria-modal`, `aria-labelledby`, and focus management correctly.
2. **NoteCard is properly memoized** — The most frequently rendered component uses `React.memo()` with a correct comparison function.
3. **Reduced motion support** — Global `@media (prefers-reduced-motion: reduce)` rule disables all animations. Well implemented.
4. **Safe area insets** — Proper `env(safe-area-inset-*)` on body, bottom toolbar, and focus mode indicator. Good iOS/notch support.
5. **Keyboard height handling** — `useKeyboardHeight` hook with Visual Viewport API is robust: 50px threshold, CSS variable output, proper cleanup.
6. **CTA token separation** — Correct use of `--color-cta-bg`/`--color-cta-text` vs `--color-accent`/`--color-on-accent` vs `--color-destructive`. Well-documented in CLAUDE.md.
7. **Input sanitization** — DOMPurify used consistently for user-generated HTML content. `sanitizeText()` and `sanitizeHtml()` properly applied.
8. **View Transitions API** — Smooth page transitions with `::view-transition` CSS, properly disabled for reduced-motion.

---

## Recommendations by Priority

### Immediate (This session)
1. Add `--color-accent-rgb` CSS variable (C-1) — 2 minute fix
2. Add `-webkit-backdrop-filter` to `.modal-backdrop` (M-7) — 1 minute fix
3. Add `aria-label="Clear search"` to Header.tsx clear button (M-1) — 1 minute fix

### Short-term (This sprint)
4. Darken `--color-text-tertiary` for WCAG AA contrast (C-2)
5. Add `autoComplete` attributes to all form inputs (H-3)
6. Add `aria-describedby` error linking to forms (H-2)
7. Standardize breakpoints to 768px (H-6)
8. Fix tag pill visibility on touch devices (H-7)

### Medium-term (Next sprint)
9. Replace inline hover style mutations with CSS classes (H-5) — touches 10+ files
10. Remove `backdrop-filter` from NoteCard, TagPill, and other non-overlay elements (H-4)
11. Increase touch target sizes to 44px minimum (H-1)
12. Replace `--spring-bounce` with smooth easing (M-9)
13. Add `memo()` to TagPill, TagBadge, ChapterSection (M-14)

### Long-term (Nice-to-have)
14. Replace hardcoded shadow rgba values with design tokens (M-6)
15. Fix ErrorBoundary fallback colors (M-8)
16. Remove hover lift from non-interactive showcase cards (M-13)

---

## Suggested Commands for Fixes

| Command | Issues Addressed | Count |
|---------|-----------------|-------|
| `/harden` | H-2, H-3, M-1, M-2, M-3, M-5, M-8 | 7 |
| `/normalize` | C-1, H-5, M-4, M-6 | 4 |
| `/adapt` | H-1, H-6, H-7, M-10, M-11 | 5 |
| `/colorize` | C-2 | 1 |
| `/optimize` | H-4, M-14 | 2 |
| `/polish` | M-7, M-13 | 2 |
| `/animate` | M-9 | 1 |
| `/quieter` | M-12 | 1 |
