# Plan Review: Editor Calm & Delight

**Review ID:** a3f7c21b
**Date:** 2026-03-09
**Model:** OpenAI Codex CLI (reviewer) + Claude Opus 4.6 (counter-reviewer)
**Status:** APPROVED (Round 3)
**Plan file:** `docs/plans/2026-03-09-editor-calm-delight.md`

---

## Summary Metrics

| Metric | Value |
|--------|-------|
| Rounds | 3 |
| Total findings | 11 (9 R1 + 2 R2) |
| Agreed | 9 |
| Partial | 2 |
| Deferred | 1 (pre-existing) |
| Rejected | 0 |

---

## Round 1

### Codex Feedback (9 findings)

| # | Severity | Task | Finding |
|---|----------|------|---------|
| 1 | HIGH | 6 | Medium-width desktop (768–1099px) loses all formatting UI after removing inline toolbar — sidebar only shows at ≥1100px |
| 2 | HIGH | 5 | Inline tag pills use `<span>` not `<button>` — not keyboard-focusable, event bubbling triggers accidental focus mode |
| 3 | HIGH | 8 | `setGlowTop` in `requestAnimationFrame` causes Editor re-renders on every scroll frame |
| 4 | MEDIUM | 5 | Inline TagSelector wrapper drops `position: relative` needed by dropdown |
| 5 | MEDIUM | 6 | Desktop scroll-padding/scroll-margin assume toolbar height, not updated after removal |
| 6 | MEDIUM | 6 | `ToolbarButton` and SVG icons are private to EditorToolbar.tsx — can't "reuse same pattern" without extraction |
| 7 | MEDIUM | 8 | Glow div can overflow outside `.editor-writing-area` (no `overflow: hidden`) |
| 8 | MEDIUM | 4 | Delete dialog missing `aria-describedby`; `Editor.test.tsx` hard-codes old strings but not in file list |
| 9 | LOW | 6 | Sidebar has `:hover` opacity recovery only — no `:focus-within` for keyboard users |

### Counter-Review

| # | Disposition | Rationale |
|---|-------------|-----------|
| 1 | **agree** | Confirmed. Keep inline toolbar as CSS-toggled fallback for 768–1099px. |
| 2 | **agree** | Confirmed. Change `<span>` to `<button>`, add `stopPropagation`. |
| 3 | **agree** | Confirmed. Use `useRef` + direct DOM mutation instead of `useState`. |
| 4 | **agree** | Confirmed. Add `relative` to inline wrapper. |
| 5 | **agree** | Confirmed at `index.css:1285`. Add 1100px media query for scroll-padding. |
| 6 | **partial** | Valid for icons. But `ToolbarButton` is simple enough to redefine. Extract SVG icons only. |
| 7 | **partial** | Concern valid but `overflow: hidden` would clip content. Clamp `glowTop` instead. |
| 8 | **agree** | Confirmed at `Editor.tsx:1295` and `Editor.test.tsx:252`. |
| 9 | **agree** | Simple fix: add `:focus-within` alongside `:hover`. |

### Revisions Applied
1. Task 4: Added `aria-describedby`, added `Editor.test.tsx` to file list
2. Task 5: `<span>` → `<button>`, `stopPropagation`, `relative` wrapper, `showTimestamps` reset on note switch
3. Task 6: Keep inline toolbar as medium-width fallback, extract shared SVG icons, `:focus-within`, scroll offsets
4. Task 8: `useRef` instead of `useState`, clamp glow position, recommend merging with existing scroll handler

---

## Round 2

### Codex Feedback (2 findings)

| # | Severity | Task | Finding |
|---|----------|------|---------|
| 1 | MEDIUM | 8 | Glow coordinate space mismatch — math uses scroll container origin but glow is inside `.editor-writing-area` which has an offset (header, resume chip, banners sit above it) |
| 2 | MEDIUM | 5 | `+` button becomes unlabeled icon when tags exist; `aria-haspopup="listbox"` mismatch with dropdown |

### Counter-Review

| # | Disposition | Rationale |
|---|-------------|-----------|
| 1 | **agree** | Valid. Compute position relative to `writingArea.offsetTop`. |
| 2 | **partial** | `aria-label="Add tag"` added. The `listbox` role mismatch is pre-existing in `TagSelector.tsx:42` — deferred as out of scope. |

### Revisions Applied
1. Task 8: Compute glow position relative to `.editor-writing-area` offset and height
2. Task 5: Added `aria-label="Add tag"` to `+` button

---

## Round 3

### Codex Feedback

> No blocking findings remain. The glow logic now computes against `.editor-writing-area` coordinates. The inline `+` tag trigger has an explicit accessible name.
>
> Residual note only: the reused popup still inherits the pre-existing `aria-haspopup="listbox"` / no `role="listbox"` mismatch from TagSelector.tsx, but that issue predates this plan and the revision no longer adds a new accessibility regression.

**VERDICT: APPROVED**

---

## Deferred Items

| Item | Source | Rationale |
|------|--------|-----------|
| TagSelector `aria-haspopup="listbox"` / `role="listbox"` mismatch | R2 Finding 2 | Pre-existing in current `TagSelector.tsx:42`. Not introduced by this plan. Should be addressed in a separate accessibility sweep. |

---

## Final Plan

The approved plan is at `.review/claude-plan-a3f7c21b.md` and will be copied to `docs/plans/2026-03-09-editor-calm-delight.md`.
