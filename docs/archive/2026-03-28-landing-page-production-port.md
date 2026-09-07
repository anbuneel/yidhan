# Landing Page Production Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old split-screen landing page with the new unified single-canvas composition from the playground, wired up to all existing auth/navigation callbacks.

**Architecture:** Port the validated playground composition into `LandingPage.tsx`, preserving the existing prop interface (`onStartWriting`, `onSignIn`, `onThemeToggle`, nav callbacks). Remove the old split-screen layout, showcase cards, and writing vignette. Add entrance animations (P0 #6) and footer nav. The playground route and backup file remain untouched during this work.

**Tech Stack:** React 19, TypeScript, CSS custom properties (design tokens from `index.css`), Tailwind utilities

**Branch:** `feature/landing-page-playground` (current)

**Reference files:**
- Spec: `docs/analysis/landing-page-redesign-implementation-spec-codex.md`
- Playground (source of truth for composition): `src/pages/PlaygroundPage.tsx`
- Backup of old landing page: preserved in git history (commit `83705a7`, deleted in simplification pass)
- App integration: `src/App.tsx:2176-2205` (prop wiring)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/LandingPage.tsx` | **Rewrite** | New unified landing page with playground composition + all existing callbacks |
| `src/App.tsx` | **No change** | Prop interface stays identical — no App.tsx edits needed |
| `src/pages/PlaygroundPage.tsx` | **No change** | Keep as dev-only reference during iteration |
| `src/components/LandingPage.backup.tsx` | **No change** | Preserved for rollback |

---

### Task 1: Rewrite LandingPage.tsx with playground composition

**Files:**
- Rewrite: `src/components/LandingPage.tsx`

- [ ] **Step 1: Replace component body with playground layout**

Port the composition from `PlaygroundPage.tsx` into `LandingPage.tsx`. Key changes from playground to production:

1. **Remove all slider controls and tunable state** — lock in the final values as constants
2. **Keep the existing prop interface** — `onStartWriting`, `onSignIn`, `onThemeToggle`, `onChangelogClick`, `onRoadmapClick`, `onPrivacyClick`, `onTermsClick`, `onSupportClick`
3. **Wire `onStartWriting` to the "Start Writing" button** (was a no-op in playground)
4. **Wire `onSignIn` to the "Sign In" header button** (was a no-op in playground)
5. **Add the footer nav** — Changelog, Roadmap, GitHub, Privacy, Terms, Support, Install (from old landing page lines 272-347)
6. **Keep `useInstallPrompt` hook** for the PWA install link in footer
7. **Remove `ShowcaseCard` component and `SAMPLE_NOTES` data** — no longer needed
8. **Remove the `TAG_COLORS` and `TagColor` imports** — no longer needed

Layout values to hardcode (from user's tuned sliders):
```
textWidth: 40%
gap: 5%
sidePadding: 1vw
headlineFontSize: clamp(2rem, 3.4vw, 4.5rem)
manuscriptPadding: 3.8rem 4.18rem (3.8 * 1.1)
gradientIntensity: 6% (dark +3%)
shadowIntensity: 1.5×
maxWidth: 1220px
manuscriptBg: var(--color-bg-primary) (both themes)
```

```tsx
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { Logo } from './Logo';
import type { Theme } from '../types';

interface LandingPageProps {
  onStartWriting: () => void;
  onSignIn: () => void;
  theme: Theme;
  onThemeToggle: () => void;
  onChangelogClick: () => void;
  onRoadmapClick: () => void;
  onPrivacyClick: () => void;
  onTermsClick: () => void;
  onSupportClick: () => void;
}

export function LandingPage({
  onStartWriting,
  onSignIn,
  theme,
  onThemeToggle,
  onChangelogClick,
  onRoadmapClick,
  onPrivacyClick,
  onTermsClick,
  onSupportClick,
}: LandingPageProps) {
  const { isInstallable, isInstalled, triggerInstall } = useInstallPrompt();
  const isDark = theme === 'dark';

  // 4-layer shadow — warm light tones / deep dark tones
  const manuscriptShadow = isDark
    ? '0 1px 2px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.45), 0 16px 32px rgba(0,0,0,0.375), 0 32px 64px rgba(0,0,0,0.3)'
    : '0 1px 2px rgba(120,80,60,0.12), 0 4px 12px rgba(120,80,60,0.09), 0 16px 32px rgba(120,80,60,0.075), 0 32px 64px rgba(120,80,60,0.06)';

  // Atmospheric gradient centered on manuscript area
  const gradientPct = isDark ? 9 : 6;
  const atmosphere = `radial-gradient(
    ellipse 60% 70% at 62% 48%,
    color-mix(in srgb, var(--color-accent) ${gradientPct}%, var(--color-bg-primary) ${100 - gradientPct}%) 0%,
    var(--color-bg-primary) 60%
  )`;

  return (
    <div className="landing-canvas" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Atmospheric radial gradient */}
      <div className="landing-atmosphere" style={{ background: atmosphere }} />

      {/* Single header bar */}
      <header className="landing-header">
        <Logo variant="header" className="shrink-0" />
        <div className="flex items-center gap-3">
          <button
            onClick={onThemeToggle}
            className="landing-theme-toggle focus-ring"
            aria-label="Toggle theme"
          >
            {/* Copy exact SVG paths from PlaygroundPage.tsx lines 91-104 */}
          </button>
          <button
            onClick={onSignIn}
            className="landing-signin-btn focus-ring"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Main composition */}
      <main className="landing-main">
        {/* Text column */}
        <div className="landing-text-column">
          <h1 className="landing-headline">
            A quiet space<br />for your thoughts.
          </h1>

          <div className="landing-cta-cluster">
            <button
              onClick={onStartWriting}
              className="landing-cta-button focus-ring"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Start Writing
            </button>
            <p className="landing-proof-line">
              Google, GitHub, or email. No credit card.
            </p>
            <p className="landing-encrypt-line">
              End-to-end encrypted from the start.
            </p>
            <a href="/demo" className="landing-demo-link" style={{ fontFamily: 'var(--font-body)' }}>
              Explore the Practice Space
              <span className="landing-demo-arrow" aria-hidden="true">→</span>
            </a>
          </div>

          {/* Spec P0 #5: each claim links to verifiable proof */}
          <div className="landing-proof-rail">
            <a href="https://github.com/anbuneel/yidhan" target="_blank" rel="noopener noreferrer">Open source</a>
            <span aria-hidden="true">·</span>
            <span>Offline-first</span>
            <span aria-hidden="true">·</span>
            <span>End-to-end encrypted</span>
          </div>
        </div>

        {/* Manuscript */}
        <div
          className="landing-manuscript"
          style={{
            background: 'var(--color-bg-primary)',
            padding: '3.8rem 4.18rem',
            boxShadow: manuscriptShadow,
          }}
        >
          <div className="landing-manuscript-glow" />
          <div className="landing-manuscript-content">
            {/* Copy exact 3-paragraph content + cursor from PlaygroundPage.tsx lines 178-191 */}
          </div>
        </div>
      </main>

      {/* Footer nav */}
      <nav className="landing-footer">
        {/* Changelog · Roadmap · GitHub · Privacy · Terms · Support · Install */}
        {/* Wire each to its callback, same as old landing page lines 272-347 */}
      </nav>

      <style>{`/* All landing-* CSS classes — ported from playground */`}</style>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors. Props interface unchanged.

- [ ] **Step 3: Run dev server and verify in browser**

Run: `npm run dev`
Verify at `http://localhost:5174`:
- Kintsugi: manuscript is warm beige surface with shadow + border, terracotta CTA
- Midnight: manuscript matches real editor (bg-primary), gold CTA
- "Start Writing" opens auth modal in signup mode
- "Sign In" opens auth modal in login mode
- Theme toggle works
- Footer links work (Changelog, Roadmap, GitHub, Privacy, Terms, Support)
- `/demo` link navigates to Practice Space

- [ ] **Step 4: Commit**

```bash
git add src/components/LandingPage.tsx
git commit -m "feat: replace split-screen landing page with unified single-canvas composition"
```

---

### Task 2: Add entrance animations (P0 #6)

**Files:**
- Modify: `src/components/LandingPage.tsx` (add animation classes + keyframes)

- [ ] **Step 1: Add staggered entrance animation**

Per the spec: "one restrained entrance sequence" with "asymmetric choreography — heavy objects fall slower."

```css
/* Entrance — staggered fade-up, heavier elements slower */
.landing-entrance {
  animation: landing-fade-up 0.6s var(--ease-smooth, ease-out) backwards;
}
.landing-entrance-1 { animation-delay: 0.08s; }
.landing-entrance-2 { animation-delay: 0.16s; }
.landing-entrance-3 { animation-delay: 0.24s; }
/* Manuscript is heavier — slower entrance, larger travel */
.landing-entrance-manuscript {
  animation: landing-fade-up-heavy 0.9s var(--ease-smooth, ease-out) backwards;
  animation-delay: 0.15s;
}

@keyframes landing-fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes landing-fade-up-heavy {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Stillness: only cursor breathes after entrance */
@media (prefers-reduced-motion: reduce) {
  .landing-entrance,
  .landing-entrance-manuscript { animation: none; }
  .landing-cursor { animation: none; opacity: 1; }
}
```

Apply classes:
- Headline: `landing-entrance`
- CTA cluster: `landing-entrance landing-entrance-1`
- Proof rail: `landing-entrance landing-entrance-2`
- Footer: `landing-entrance landing-entrance-3`
- Manuscript: `landing-entrance-manuscript`

- [ ] **Step 2: Verify animations in browser**

Check at `http://localhost:5174`:
- Elements fade up in sequence on page load
- Manuscript rises more slowly (heavier feel)
- After ~1.5s, page is still — only cursor breathes
- Toggle `prefers-reduced-motion` in DevTools → everything appears instantly

- [ ] **Step 3: Commit**

```bash
git add src/components/LandingPage.tsx
git commit -m "feat: add restrained entrance animation with asymmetric choreography"
```

---

### Task 3: Add responsive mobile layout

**Files:**
- Modify: `src/components/LandingPage.tsx` (CSS media query)

- [ ] **Step 1: Add mobile breakpoint CSS**

At `max-width: 768px`:
- Grid collapses to single column
- Text column centers (text-align: center, align-items: center)
- Headline uses `clamp(2rem, 8vw, 3rem)`
- Manuscript goes full-width with bottom margin
- Footer wraps and centers
- CTA cluster centers

This CSS is already validated in the playground — port the `@media (max-width: 768px)` block.

- [ ] **Step 2: Verify mobile in browser**

Resize to 390×844 (iPhone 14) and check:
- Headline + CTA above the fold
- Manuscript below as visual proof, full-width
- Footer links visible and tappable
- Both themes look correct

- [ ] **Step 3: Commit**

```bash
git add src/components/LandingPage.tsx
git commit -m "feat: add responsive mobile layout for landing page"
```

---

### Task 4: Run full CI check

**Files:** None (validation only)

- [ ] **Step 1: Run the full check suite**

Run: `npm run check`

This runs: typecheck → lint → test → build

Expected: All pass. The landing page has no test file (it's a presentational component wired via callbacks), so existing tests should be unaffected.

- [ ] **Step 2: Fix any issues**

If lint or typecheck fail, fix and re-run.

- [ ] **Step 3: Commit any fixes**

```bash
git commit -m "fix: address lint/type issues from landing page port"
```

---

### Task 5: Browser verification in both themes

**Files:** None (manual verification)

- [ ] **Step 1: Desktop verification (1280×800)**

Check at `http://localhost:5174` in both Kintsugi and Midnight:
- [ ] One composition, not two panels (acceptance test #1)
- [ ] One unmistakable visual anchor — manuscript (acceptance test #2)
- [ ] Primary action obvious within 2 seconds (acceptance test #3)
- [ ] Signup path feels easy before modal opens (acceptance test #4)
- [ ] Mobile preserves same emotional idea (acceptance test #6)
- [ ] Both themes feel intentionally art-directed (acceptance test #7)
- [ ] Page feels premium after removing decorative effects (acceptance test #8)

- [ ] **Step 2: Mobile verification (390×844)**

Same checks on mobile viewport.

- [ ] **Step 3: Auth flow verification**

- "Start Writing" → auth modal opens in signup mode
- "Sign In" → auth modal opens in login mode
- Close modal → back to landing page
- All footer links navigate correctly

- [ ] **Step 4: Final commit and push**

```bash
git push
```

---

## Summary

| Task | Description | Estimated Complexity |
|------|-------------|---------------------|
| 1 | Rewrite LandingPage.tsx with playground composition | Medium — largest change, but mostly porting validated code |
| 2 | Add entrance animations | Small — CSS keyframes + classes |
| 3 | Add responsive mobile layout | Small — CSS media query, already validated |
| 4 | Run full CI check | Small — validation only |
| 5 | Browser verification | Small — manual testing |

**Total: 5 tasks, all on one file (`LandingPage.tsx`)**
