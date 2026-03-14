# Continuation: Chapter Waterline Implementation

## Context
- **Branch:** `main` (latest: `8820d98`)
- **Phase:** Brainstorming complete → Ready to write implementation plan
- **Spec doc:** `docs/superpowers/specs/2026-03-12-chapter-waterline-design.md` (v1.2, peer-reviewed and approved)

## What was decided
We're solving the "100+ notes endless scrolling" problem with three layered changes:

1. **Progressive Rendering** — Each `ChapterSection` shows 6 cards initially, loads 6 more via IntersectionObserver as user scrolls. Sentinel has 200px rootMargin for preloading. Cards animate in with a rising wave (translateY 6px + fade, 200ms/60ms stagger).

2. **Chapter Waterline** — Washi paper-edge `mask-image` (SVG, not a generic gradient) below the last visible card row. Chapter-aware text: "17 more from this week...", "5 quieter thoughts...", etc. Not clickable — scrolling triggers more cards. Dissolves when all cards revealed.

3. **Focused-Gaze Search** — Instead of filtering notes out of the DOM, all notes stay visible. Non-matching cards fade to 10-15% opacity, matching cards get scale(1.02) glow. `App.tsx` passes full notes + `matchedNoteIds: Set<string>` + `searchQuery`. Progressive rendering suspends during search. The "Searching..." spinner in App.tsx (~lines 2118-2121) gets removed. Keyboard nav between matches deferred.

## Performance fixes bundled in
- `React.memo` on `ChapterSection` (full 11-prop comparator including `chapterKey`, `defaultExpanded`, `isPinned`, `isCompact`, new search props)
- Content truncation: `htmlToPlainText(content).slice(0, 200)` in all card modes (not just compact)
- Callbacks stabilized with `useCallback` in `ChapteredLibrary`

## Files that change
`ChapterSection.tsx`, `NoteCard.tsx`, `Header.tsx`, `ChapteredLibrary.tsx`, `App.tsx`, `index.css`, `temporalGrouping.ts`

## Next step
Read the spec at `docs/superpowers/specs/2026-03-12-chapter-waterline-design.md`, then write an implementation plan to `docs/plans/`. Use the `superpowers:writing-plans` skill. This should be a feature branch + PR workflow.

## Mode
Start in **implement** mode. The design discussion is complete — we're executing now.
