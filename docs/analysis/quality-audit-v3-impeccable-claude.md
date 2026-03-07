# Quality Audit v3 — Post-Sweep Verification

**Version:** 3.0
**Last Updated:** 2026-03-06
**Status:** Complete
**Author:** Claude (Opus 4.6)
**Consulted:** Impeccable Audit Skill, Frontend Design Skill

---

## Original Prompt

> Run `/impeccable:audit` to verify fixes from the `feature/impeccable-sweep` branch after applying 6 phases of remediation (quick fixes, normalize, harden, optimize, adapt, polish).

---

## Anti-Patterns Verdict

**Improved.** The sweep addressed several AI-slop tells:
- Spring bounce easing replaced with smooth ease-out-quint — no more dated overshoot
- `backdrop-filter` removed from card grids — glassmorphism was purely decorative on solid backgrounds
- Hardcoded `rgba(0,0,0,...)` shadows replaced with warm-tinted theme tokens
- **Still present**: Colored top border on NoteCard (design choice, flagged in critique v1/v2)
- **Still present**: `backdrop-filter` on TagPill, Auth card, ChangelogPage, RoadmapPage — acceptable since these aren't repeated in grids

---

## Executive Summary

| Category | v2 Audit | Post-Sweep | Status |
|----------|----------|------------|--------|
| Critical | 4 | **0** | All resolved |
| High | 8 | **2** | 6 resolved |
| Medium | 10 | **4** | 6 resolved |
| Low | 5 | **3** | 2 resolved |
| **Total** | **27** | **9 remaining** | **67% reduction** |

**Top remaining issues:**
1. No focus trap on modals (H-R2) — highest user impact
2. NoteCard colored top border (H-R1) — design decision needed
3. Inline hover handlers on NoteCard (M-R2) — micro-optimization

---

## Verified Fixes (18 issues resolved)

| # | Original Issue | Fix Verified |
|---|---------------|-------------|
| C1 | `--color-accent-rgb` undefined | Present in both `:root` and `[data-theme="dark"]` |
| C2 | SettingsModal `bg-white` toggle knobs | Uses `var(--color-bg-primary)` |
| C3 | Hardcoded shadows in 6 components | All use `var(--shadow-sm/md/lg)` — zero `rgba` box-shadows remaining |
| C4 | `backdrop-filter` on NoteCard grid | Removed from NoteCard + FadedNoteCard (3 occurrences) |
| H1 | Missing `autoComplete` on form inputs | 12 inputs across 5 components have correct `autoComplete` |
| H2 | Missing `htmlFor`/`id` on labels | 14 label-input pairs properly associated across 5 components |
| H3 | NoteCard missing `aria-label` | Present: `aria-label={Open note: ${note.title}}` |
| H4 | Spring bounce easing | Changed to `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint) |
| H5 | Kintsugi `textTertiary` contrast | Darkened `#8F8C86` to `#7D7974` (~2.7:1 to ~3.5:1) |
| H6 | InvitationModal inline backdrop | Uses `.modal-backdrop` class |
| M1 | TagSelector missing ARIA | Has `aria-expanded` and `aria-haspopup="listbox"` |
| M2 | OAuth SVGs missing `aria-hidden` | Google, GitHub, and spinner SVGs have `aria-hidden="true"` |
| M3 | Breakpoint inconsistency (640px) | All media queries standardized to `768px` |
| M4 | AddTagPill touch target 28px | Increased to 36px (`w-9 h-9`) |
| M5-M6 | Kintsugi theme source out of sync | `kintsugi.ts` matches `index.css` |
| L1-L2 | Redundant `sm:` responsive classes | Cleaned up in TagPill |

---

## Remaining Issues (9)

### High (2)

**H-R1**: NoteCard colored top border
- **Location**: `NoteCard.tsx:61`
- **Category**: Anti-pattern (design)
- **Description**: `borderTop: '2px solid var(--color-accent-muted)'` — flagged as AI slop tell by the frontend-design skill
- **Impact**: Makes the interface look templated
- **Recommendation**: Design decision — requires discussion before changing
- **Suggested command**: `/critique` for design direction discussion

**H-R2**: No focus trap on modals
- **Location**: Auth modal, SettingsModal, ConflictModal, ShareModal, TagModal, KeyboardShortcutsModal
- **Category**: Accessibility
- **Description**: `role="dialog"` modals don't trap Tab focus — users can Tab behind the modal overlay
- **Impact**: WCAG 2.1 SC 2.4.3 (Focus Order) — keyboard users can interact with obscured content
- **Recommendation**: Add focus trap (e.g., `focus-trap-react` or manual implementation)
- **Suggested command**: `/harden`

### Medium (4)

**M-R1**: Remaining `backdrop-filter` on non-grid elements
- **Location**: Auth.tsx:338, TagPill.tsx:39/156/197, ChangelogPage.tsx:87, RoadmapPage.tsx:96
- **Category**: Performance
- **Description**: `backdrop-filter: blur(20px)` on single elements or small sets
- **Impact**: Minor GPU cost — acceptable for non-repeated elements
- **Recommendation**: Low priority. Only TagPill could multiply (many tags) but pills are small.

**M-R2**: Inline hover handlers on NoteCard
- **Location**: `NoteCard.tsx:80-86, 108-118, 228-234`
- **Category**: Performance
- **Description**: `onMouseEnter`/`onMouseLeave` handlers create closures on each render
- **Impact**: Micro-optimization — NoteCard is `memo()`'d so re-renders are limited
- **Recommendation**: Convert to CSS `:hover` rules if the masonry grid grows beyond ~100 cards
- **Suggested command**: `/optimize`

**M-R3**: Auth card `backdrop-filter` redundant in full-page mode
- **Location**: `Auth.tsx:338`
- **Category**: Performance/Theming
- **Description**: In full-page mode, the card sits over solid `--color-bg-primary` — blur has no visual effect
- **Impact**: Negligible (single element)
- **Recommendation**: Could conditionally apply only in `isModal` mode

**M-R4**: BottomSheet hardcoded backdrop color
- **Location**: `BottomSheet.tsx:221`
- **Category**: Theming
- **Description**: Uses `rgba(0, 0, 0, 0.6)` instead of `.modal-backdrop` class
- **Impact**: Documented exception in CLAUDE.md — react-spring animation conflicts with CSS class
- **Recommendation**: Keep as-is (intentional)

### Low (3)

**L-R1**: ErrorBoundary fallback uses hardcoded CSS fallback
- **Location**: `ErrorBoundary.tsx:80`
- **Category**: Theming
- **Description**: `rgba(255, 255, 255, 0.08)` as fallback for `--glass-border` — intentional for crash scenarios where CSS variables may not be loaded
- **Recommendation**: Keep — defensive fallback

**L-R2**: NoteCard inline hover for borderTop accent
- **Location**: `NoteCard.tsx:80, 84`
- **Category**: Design/Performance
- **Description**: Related to H-R1, inline handlers manage the colored border hover effect
- **Recommendation**: Would be resolved alongside H-R1 if the border accent is redesigned

**L-R3**: Some modal dialogs lack `aria-describedby`
- **Location**: ConflictModal, KeyboardShortcutsModal, InstallPrompt
- **Category**: Accessibility
- **Description**: Have `role="dialog"` and `aria-labelledby` but missing `aria-describedby`
- **Impact**: Screen readers announce the dialog title but not a description of purpose
- **Recommendation**: Add `aria-describedby` pointing to the description text
- **Suggested command**: `/harden`

---

## Positive Findings

1. **Form accessibility is now excellent** — every form input across 5 components has proper `htmlFor`/`id` association and `autoComplete` hints. Password managers and screen readers work correctly.

2. **Shadow tokens are fully adopted** — zero hardcoded `boxShadow: rgba(...)` remains in components. All shadows adapt to theme (warm terracotta in light, neutral in dark).

3. **Reduced motion is handled globally** — blanket `prefers-reduced-motion` rule in `index.css` catches all CSS animations and transitions with `0.01ms` duration, plus explicit view transition handling.

4. **Clean CI** — 830 tests pass, 0 lint errors, TypeScript clean, build successful.

5. **Consistent breakpoints** — all media queries use `768px`, eliminating the mobile/tablet gap.

6. **Easing is natural** — `ease-out-quint` provides smooth, professional deceleration without the dated bounce overshoot.

---

## Recommendations by Priority

1. **Next sprint**: Focus trap for modals (H-R2) — highest remaining user impact
2. **Design discussion**: NoteCard colored top border (H-R1) — needs design direction decision
3. **Low priority**: `aria-describedby` on remaining modals (L-R3)
4. **Monitor only**: Inline hover handlers (M-R2), remaining `backdrop-filter` (M-R1)

---

## Changes Applied in This Sweep

**Branch**: `feature/impeccable-sweep`
**Files modified (17)**: EditorToolbar.tsx, SlashCommand.tsx, WhisperBack.tsx, GestureHint.tsx, IOSInstallGuide.tsx, FadedNoteCard.tsx, NoteCard.tsx, TagSelector.tsx, TagPill.tsx, Auth.tsx, PassphraseSetup.tsx, PassphraseUnlock.tsx, SettingsModal.tsx, ReAuthModal.tsx, InvitationModal.tsx, index.css, kintsugi.ts

| Phase | Skill Used | Summary |
|-------|-----------|---------|
| 1. Quick fixes | — | `--color-accent-rgb`, NoteCard aria-label, TagSelector ARIA, SettingsModal toggle theming |
| 2. Normalize | `/impeccable:normalize` | 6 shadow tokenizations, textTertiary contrast, spring-bounce easing, InvitationModal backdrop |
| 3. Harden | `/impeccable:harden` | autoComplete on 10 inputs, htmlFor/id on 8 label pairs, aria-hidden on 3 SVGs |
| 4. Optimize | `/impeccable:optimize` | backdrop-filter removal from NoteCard + FadedNoteCard |
| 5. Adapt | `/impeccable:adapt` | Breakpoint alignment (640 to 768px), AddTagPill touch target (28 to 36px) |
| 6. Polish | `/impeccable:polish` | Verified clean CI, reduced-motion coverage, no console.logs |
