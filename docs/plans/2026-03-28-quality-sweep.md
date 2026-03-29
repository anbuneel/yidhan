# Quality Sweep — Mechanical Fixes

**Version:** 1.0
**Last Updated:** 2026-03-28
**Status:** Complete
**Author:** Claude (Opus 4.6)

---

## Original Prompt

> Address 18 mechanical fixes from the design critique tracker (items #1, 3-5, 14-23, 26, 28, 32) in a single quality sweep PR.

---

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address 18 mechanical fixes from the design critique tracker (items #1, 3-5, 14-23, 26, 28, 32) in a single quality sweep PR.

**Architecture:** All fixes are independent single-file changes (1-5 lines each). No architectural decisions needed. Grouped by category for reviewer clarity.

**Tech Stack:** React, TypeScript, Tailwind CSS, CSS custom properties

**Deferred:** Item #13 (Auth.tsx inline style extraction — 48 instances, separate PR)

**Source:** [Design Critique Tracker](../active/design-critique-tracker.md) — Round 3 consolidated items

---

## Pre-flight

- [ ] **Create feature branch**

```bash
git checkout -b fix/quality-sweep
```

- [ ] **Verify clean state**

```bash
npm run check
```

Expected: All checks pass (typecheck + lint + test + build)

---

## Task 1: Skip-to-Content Link (#1)

**Files:**
- Modify: `src/index.css` (add skip link styles)
- Modify: `src/App.tsx` (add skip link element + `id="main-content"`)

- [ ] **Step 1: Add skip link CSS to index.css**

After the design tokens section (~line 130), add:

```css
/* Skip to content link (a11y) */
.skip-to-content {
  position: absolute;
  left: -9999px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
  z-index: 9999;
  padding: 1rem 1.5rem;
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-cta-text);
  background: var(--color-cta-bg);
  border-radius: 0 0 8px 0;
  text-decoration: none;
}

.skip-to-content:focus {
  position: fixed;
  top: 0;
  left: 0;
  width: auto;
  height: auto;
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Add skip link to App.tsx**

In App.tsx, find the library view return (the main view users see). Before the `<Header>` component in the library return block (~line 2244), add the skip link as the first child:

```tsx
<a href="#main-content" className="skip-to-content">
  Skip to content
</a>
```

Then on the content `<div>` that wraps the `<TagFilterBar>` and note list (~line 2263), add `id="main-content"`:

```tsx
<div id="main-content" className="w-full flex-1 flex flex-col" ...>
```

Also add the same skip link to the editor view return block (before the editor header) and add `id="main-content"` to the `<main>` element in the editor.

- [ ] **Step 3: Verify** — Tab into the app, first focus should reveal "Skip to content" link.

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/App.tsx
git commit -m "fix(a11y): add skip-to-content link (WCAG 2.4.1)"
```

---

## Task 2: Modal Responsive Widths (#3)

**Files:**
- Modify: `src/components/ShareModal.tsx:221` — `w-[420px]` → `w-full max-w-[420px] mx-4`
- Modify: `src/components/TagModal.tsx:108` — `w-[400px]` → `w-full max-w-[400px] mx-4`
- Modify: `src/components/Editor.tsx:1408` — `w-[400px]` → `w-full max-w-[400px] mx-4`

- [ ] **Step 1: Fix ShareModal**

```tsx
// ShareModal.tsx ~line 221
// Change:
className="
  w-[420px]
  p-8
// To:
className="
  w-full max-w-[420px] mx-4
  p-8
```

- [ ] **Step 2: Fix TagModal**

```tsx
// TagModal.tsx ~line 108
// Change:
className="
  w-[400px]
  p-8
// To:
className="
  w-full max-w-[400px] mx-4
  p-8
```

- [ ] **Step 3: Fix Editor delete dialog**

```tsx
// Editor.tsx ~line 1408
// Change:
className="
  w-[400px]
  p-8
// To:
className="
  w-full max-w-[400px] mx-4
  p-8
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ShareModal.tsx src/components/TagModal.tsx src/components/Editor.tsx
git commit -m "fix(responsive): modal widths adapt to narrow viewports"
```

---

## Task 3: Dropdown & Tooltip Overflow (#4, #19, #20)

**Files:**
- Modify: `src/components/TagSelector.tsx:42` — add `max-w-[calc(100vw-2rem)]`
- Modify: `src/components/ShareModal.tsx:446` — add `max-w-[calc(100vw-2rem)]`
- Modify: `src/components/ChapterNav.tsx:96` — add `max-w-[200px] truncate`

- [ ] **Step 1: Fix TagSelector dropdown**

```tsx
// TagSelector.tsx ~line 42
// Change:
className="
  absolute left-0 top-full mt-2
  min-w-[200px]
// To:
className="
  absolute left-0 top-full mt-2
  min-w-[200px] max-w-[calc(100vw-2rem)]
```

- [ ] **Step 2: Fix ShareModal tooltip**

```tsx
// ShareModal.tsx ~line 446 — the privacy tooltip
// Change:
className="absolute left-0 top-6 z-10 w-64 p-3 rounded-lg shadow-lg text-xs"
// To:
className="absolute left-0 top-6 z-10 w-64 max-w-[calc(100vw-2rem)] p-3 rounded-lg shadow-lg text-xs"
```

- [ ] **Step 3: Fix ChapterNav tooltip**

```tsx
// ChapterNav.tsx ~line 96
// Change:
className="
  absolute right-full mr-3
  px-3 py-1.5
  rounded-lg
  whitespace-nowrap
// To:
className="
  absolute right-full mr-3
  px-3 py-1.5
  rounded-lg
  whitespace-nowrap max-w-[200px] truncate
```

- [ ] **Step 4: Commit**

```bash
git add src/components/TagSelector.tsx src/components/ShareModal.tsx src/components/ChapterNav.tsx
git commit -m "fix(responsive): prevent dropdown and tooltip overflow on narrow viewports"
```

---

## Task 4: Touch Targets (#14, #15)

**Files:**
- Modify: `src/components/ChapterNav.tsx:114` — increase dot button hit area
- Modify: `src/components/TagPill.tsx:68,96` — increase edit/remove button hit area

- [ ] **Step 1: Fix ChapterNav dot buttons**

The visual dot stays small but the clickable area increases. Add `min-w-[24px] min-h-[24px]` and center the visual dot:

```tsx
// ChapterNav.tsx ~line 114
// Change:
className={`
  relative
  rounded-full
  transition-all duration-300
  focus:outline-none
  focus:ring-2
  focus:ring-[var(--color-accent)]
  focus:ring-offset-2
  ${isActive ? 'w-3 h-3' : 'w-2 h-2'}
`}
// To:
className={`
  relative
  rounded-full
  transition-all duration-300
  focus:outline-none
  focus:ring-2
  focus:ring-[var(--color-accent)]
  focus:ring-offset-2
  min-w-[24px] min-h-[24px]
  flex items-center justify-center
`}
```

Then wrap the visual dot as a `<span>` inside the button:

```tsx
<button ... >
  <span className={`rounded-full transition-all duration-300 ${isActive ? 'w-3 h-3' : 'w-2 h-2'}`}
    style={{
      background: isActive ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
      opacity: isActive ? 1 : 0.5,
      boxShadow: isActive ? '0 0 8px var(--color-accent-glow)' : 'none',
    }}
  />
</button>
```

Move the `style` props (background, opacity, boxShadow) from the `<button>` to the inner `<span>`. The `<button>` keeps aria-label and interaction.

- [ ] **Step 2: Fix TagPill edit/remove buttons**

```tsx
// TagPill.tsx ~line 68 (edit button) and ~line 96 (remove button)
// Change both from:
className="
  ml-1
  w-4 h-4
  flex items-center justify-center
// To:
className="
  ml-1
  w-7 h-7 -m-1.5
  flex items-center justify-center
```

The `-m-1.5` compensates for the larger hit area so it doesn't push layout. The visual icon inside stays the same size.

- [ ] **Step 3: Commit**

```bash
git add src/components/ChapterNav.tsx src/components/TagPill.tsx
git commit -m "fix(a11y): increase touch targets on ChapterNav dots and TagPill buttons"
```

---

## Task 5: ARIA Labels (#17, #18)

**Files:**
- Modify: `src/components/TagPill.tsx:18` — add aria-label to filter button
- Modify: `src/components/IOSInstallGuide.tsx:262` — add aria-label + Space key to step cards

- [ ] **Step 1: Fix TagPill aria-label**

```tsx
// TagPill.tsx ~line 18
// Change:
<div
  role="button"
  tabIndex={0}
// To:
<div
  role="button"
  tabIndex={0}
  aria-label={`Filter by ${tag.name}`}
```

- [ ] **Step 2: Fix IOSInstallGuide step cards**

```tsx
// IOSInstallGuide.tsx ~line 262
// Change:
onClick={() => setCurrentStep(index)}
role="button"
tabIndex={0}
onKeyDown={(e) => e.key === 'Enter' && setCurrentStep(index)}
// To:
onClick={() => setCurrentStep(index)}
role="button"
tabIndex={0}
aria-label={`Step ${index + 1}: ${step.title}`}
aria-current={currentStep === index ? 'step' : undefined}
onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setCurrentStep(index)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TagPill.tsx src/components/IOSInstallGuide.tsx
git commit -m "fix(a11y): add aria-labels to TagPill filter and IOSInstallGuide steps"
```

---

## Task 6: Editor Title Auto-Resize (#5)

**Files:**
- Modify: `src/components/Editor.tsx:575,622` — batch read/write in title auto-resize

- [ ] **Step 1: Fix handleTitleChange**

```tsx
// Editor.tsx ~line 575
// Change:
if (titleRef.current) {
  titleRef.current.style.height = 'auto';
  titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
}
// To:
if (titleRef.current) {
  titleRef.current.style.height = 'auto';
  requestAnimationFrame(() => {
    if (titleRef.current) {
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
    }
  });
}
```

- [ ] **Step 2: Fix title resize on mount**

```tsx
// Editor.tsx ~line 622
// Same pattern — wrap the scrollHeight read + write in rAF
if (titleRef.current) {
  titleRef.current.style.height = 'auto';
  requestAnimationFrame(() => {
    if (titleRef.current) {
      const height = titleRef.current.scrollHeight;
      titleRef.current.style.height = height + 'px';
      if (!hasContent) {
        titleRef.current.focus();
      }
    }
  });
}
```

Note: Move `focus()` inside the rAF to maintain ordering.

- [ ] **Step 3: Commit**

```bash
git add src/components/Editor.tsx
git commit -m "fix(perf): batch title auto-resize reads/writes with requestAnimationFrame"
```

---

## Task 7: will-change on Key Animations (#16)

**Files:**
- Modify: `src/index.css` — add will-change to animated elements

- [ ] **Step 1: Add will-change hints**

Add `will-change` to elements that use the most impactful animations:

```css
/* Near .modal-backdrop (~line 159) */
.modal-backdrop > * {
  will-change: transform, opacity;
}

/* Near .note-card (~line 218) */
.note-card.deleting {
  will-change: transform, opacity, filter;
}

/* Near .focus-mode-target (~line 1348) */
.focus-mode-target {
  will-change: opacity, max-height;
}

/* Near .landing-entrance (~line after keyframes) */
.landing-entrance {
  will-change: opacity, transform;
}
```

Note: Don't add `will-change` to everything — only the most visually impactful animations. `will-change` promotes elements to their own compositing layer (memory cost), so be selective.

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "fix(perf): add will-change hints to key animations"
```

---

## Task 8: Dark Theme Shadows (#21)

**Files:**
- Modify: `src/index.css:77-79` — tint dark theme shadows with forest green

- [ ] **Step 1: Update dark shadow variables**

```css
/* index.css ~line 77, inside [data-theme="dark"] */
/* Change: */
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
--shadow-md: 0 10px 40px -10px rgba(0, 0, 0, 0.5);
--shadow-lg: 0 20px 50px -10px rgba(0, 0, 0, 0.6);
/* To: */
--shadow-sm: 0 2px 8px rgba(5, 20, 10, 0.4);
--shadow-md: 0 4px 12px rgba(5, 20, 10, 0.2), 0 10px 40px -10px rgba(5, 20, 10, 0.55);
--shadow-lg: 0 4px 12px rgba(5, 20, 10, 0.25), 0 20px 50px -10px rgba(5, 20, 10, 0.65);
```

Uses `rgba(5, 20, 10, ...)` — tinted with the dark theme's forest green base (`#050A06`). Also adds secondary shadow layer to md/lg for consistency with light theme.

- [ ] **Step 2: Regenerate themes** (if needed)

Check whether `npm run theme:generate` overwrites these. If it does, the fix goes in `src/themes/midnight.ts` instead.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "fix(theming): tint dark theme shadows with forest green"
```

---

## Task 9: Hardcoded Colors (#12, scoped)

**Files:**
- Modify: `src/App.tsx:2354` — overlay rgba → CSS class
- Modify: `src/components/LandingPage.tsx:33-40` — manuscriptShadow → use shadow tokens
- Modify: `src/main.tsx:121,127` — toast icon color

- [ ] **Step 1: Fix App.tsx overlay**

```tsx
// App.tsx ~line 2354
// Change:
style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
// To:
className="modal-backdrop"
```

The `.modal-backdrop` class in index.css already provides `background: rgba(0,0,0,0.6)` and `backdrop-filter: blur(8px)`.

- [ ] **Step 2: Fix LandingPage manuscriptShadow**

Replace the hardcoded rgba values with CSS custom properties. Add new tokens to the theme blocks in index.css:

```css
/* In :root (light theme) */
--shadow-manuscript: 0 1px 2px rgba(120, 80, 60, 0.12),
                     0 4px 12px rgba(120, 80, 60, 0.09),
                     0 16px 32px rgba(120, 80, 60, 0.075),
                     0 32px 64px rgba(120, 80, 60, 0.06);

/* In [data-theme="dark"] */
--shadow-manuscript: 0 1px 2px rgba(5, 20, 10, 0.6),
                     0 4px 12px rgba(5, 20, 10, 0.45),
                     0 16px 32px rgba(5, 20, 10, 0.375),
                     0 32px 64px rgba(5, 20, 10, 0.3);
```

Then in LandingPage.tsx, replace `manuscriptShadow` variable with `var(--shadow-manuscript)`.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/components/LandingPage.tsx src/index.css
git commit -m "fix(theming): replace hardcoded colors with CSS tokens"
```

---

## Task 10: Delete Animation setTimeout → onAnimationEnd (#22)

**Files:**
- Modify: `src/components/NoteCard.tsx:40-48` — replace setTimeout with animationend

- [ ] **Step 1: Replace setTimeout**

```tsx
// NoteCard.tsx ~line 40
// Change:
const handleDeleteClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  setIsDeleting(true);
  setTimeout(() => {
    onDelete(note.id);
  }, 300);
};
// To:
const cardRef = useRef<HTMLDivElement>(null);

const handleDeleteClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  setIsDeleting(true);
};

// Add useEffect for animation end
useEffect(() => {
  if (!isDeleting) return;
  const el = cardRef.current;
  if (!el) return;
  const handleAnimationEnd = () => onDelete(note.id);
  el.addEventListener('animationend', handleAnimationEnd, { once: true });
  return () => el.removeEventListener('animationend', handleAnimationEnd);
}, [isDeleting, note.id, onDelete]);
```

Attach `ref={cardRef}` to the card's outermost element (the one that gets the `deleting` class).

Note: Check if `cardRef` already exists on the component. If so, reuse it.

- [ ] **Step 2: Commit**

```bash
git add src/components/NoteCard.tsx
git commit -m "fix: replace fragile setTimeout with animationend for delete animation"
```

---

## Task 11: CSS Text & Typography Fixes (#23, #26, #28)

**Files:**
- Modify: `src/components/LandingPage.tsx` — `text-wrap: balance`, `!important` fix
- Modify: `src/index.css` — rename `--spring-bounce`

- [ ] **Step 1: Add text-wrap: balance**

```css
/* LandingPage.tsx <style> block, inside .landing-headline (~line 282) */
/* Add: */
text-wrap: balance;
```

Also remove the `<br />` from the headline JSX (~line 90) so `text-wrap: balance` can work:

```tsx
// Change:
<h1 className="landing-headline landing-entrance">
    A quiet space<br />for your thoughts.
</h1>
// To:
<h1 className="landing-headline landing-entrance">
    A quiet space for your thoughts.
</h1>
```

- [ ] **Step 2: Fix !important specificity**

In LandingPage.tsx's `<style>` block, the mobile override at ~line 544 uses `!important` because it's at the same specificity as the desktop rule. Fix by nesting under the media query properly:

```css
/* Change the mobile rule from: */
.landing-headline {
    font-size: clamp(2rem, 8vw, 3rem) !important;
    margin-bottom: 1.5rem;
}
/* To: */
.landing-canvas .landing-headline {
    font-size: clamp(2rem, 8vw, 3rem);
    margin-bottom: 1.5rem;
}
```

The `.landing-canvas` parent increases specificity without `!important`.

- [ ] **Step 3: Rename --spring-bounce**

In `src/index.css` ~line 117:

```css
/* Change: */
--spring-bounce: cubic-bezier(0.22, 1, 0.36, 1);     /* Smooth deceleration (ease-out-quint) */
/* To: */
--ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
```

Then update all 5 usages across the codebase:
- `src/index.css:387` — `var(--spring-bounce)` → `var(--ease-out-quint)`
- `src/components/BottomSheet.tsx:182` — `var(--spring-bounce)` → `var(--ease-out-quint)`
- `src/components/FadedNoteCard.tsx:76` — keep as `var(--spring-smooth)` (different variable, not affected)
- `src/components/GestureHint.tsx:190` — `var(--spring-bounce)` → `var(--ease-out-quint)`
- `src/components/NoteCard.tsx:78` — `var(--spring-bounce)` → `var(--ease-out-quint)`
- `src/components/IOSInstallGuide.tsx:115` — `var(--spring-bounce)` → `var(--ease-out-quint)`

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/components/LandingPage.tsx src/components/BottomSheet.tsx src/components/GestureHint.tsx src/components/NoteCard.tsx src/components/IOSInstallGuide.tsx
git commit -m "fix: text-wrap balance, remove !important specificity hack, rename --spring-bounce"
```

---

## Task 12: Dark Mode Card Borders (#32)

**Files:**
- Modify: `src/components/LandingPage.tsx:384` — reduce border opacity

- [ ] **Step 1: Reduce dark mode card border opacity**

```css
/* LandingPage.tsx <style> block ~line 384 */
/* Change: */
[data-theme="dark"] .landing-manuscript {
    border: 1px solid rgba(255, 255, 255, 0.08);
}
/* To: */
[data-theme="dark"] .landing-manuscript {
    border: 1px solid rgba(255, 255, 255, 0.05);
}
```

Reduces from 8% to 5% opacity — more subtle, less "drawn on."

- [ ] **Step 2: Commit**

```bash
git add src/components/LandingPage.tsx
git commit -m "fix(theming): soften dark mode card borders on landing page"
```

---

## Final Verification

- [ ] **Run full check**

```bash
npm run check
```

Expected: typecheck + lint + test + build all pass.

- [ ] **Visual verification**

```bash
npm run dev
```

Check in browser:
1. Tab into page → skip-to-content link appears
2. Resize to 375px width → modals don't overflow
3. Dark mode → shadows have green tint, card borders are subtle
4. Delete a note → animation completes cleanly without timing glitch
5. ChapterNav dots → tap targets feel larger
6. Focus mode → no visible regression

- [ ] **Push and create PR**

```bash
git push -u origin fix/quality-sweep
gh pr create --title "fix: quality sweep — a11y, responsive, perf, theming" --body "$(cat <<'EOF'
## Summary
- Skip-to-content link (WCAG 2.4.1)
- Modal responsive widths (3 modals)
- Dropdown/tooltip overflow guards
- Touch target increases (ChapterNav, TagPill)
- ARIA labels (TagPill filter, IOSInstallGuide steps)
- Editor title auto-resize rAF batching
- will-change hints on key animations
- Dark theme shadow tinting (forest green)
- Hardcoded colors → CSS tokens
- Delete animation setTimeout → animationend
- text-wrap: balance, !important removal, --spring-bounce rename
- Dark mode card border opacity reduction

Source: [Design Critique Tracker](docs/active/design-critique-tracker.md) items #1, 3-5, 14-23, 26, 28, 32

## Test plan
- [ ] Tab navigation: skip-to-content link appears on focus
- [ ] 375px viewport: all modals usable
- [ ] Dark mode: shadows have green tint, not pure black
- [ ] Delete note: animation finishes cleanly
- [ ] `npm run check` passes

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Items NOT in This Plan

| Item | Reason |
|------|--------|
| #13 (Auth.tsx inline styles) | 48 instances — separate PR |
| #12 partial (BottomSheet, ErrorBoundary, PlaygroundPage, LogoTestPage) | Documented exceptions / dev-only pages |
| #12 partial (main.tsx toast icons) | Low impact, toast lib may not support CSS vars |
| Editor scroll handler glow | Already uses rAF with ticking guard — no fix needed |
