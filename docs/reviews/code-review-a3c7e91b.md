# Code Review: Chapter Waterline

**Review ID:** a3c7e91b
**Date:** 2026-03-15
**PR:** #176
**Status:** APPROVED (Round 3)
**Branch:** feature/chapter-waterline

---

## Summary Metrics

| Metric | Value |
|--------|-------|
| Rounds | 3 |
| Pre-review agents | 3 (code-reviewer, silent-failure-hunter, type-design-analyzer) |
| External agents | Codex CLI, Claude bot (GH), Vercel bot |
| Total findings | 18 unique (pre-review + 2 rounds) |
| Agreed/Fixed | 14 |
| Partial | 2 |
| Deferred | 2 (tests, docs) |
| Rejected | 2 (rich-text preview removal, searchSnippet extraction) |

---

## Pre-Review (Claude agents)

### Simplify Pass
- Memoized fingerprint with `useMemo`
- Removed redundant `prevSearchQuery` state pair
- Memoized `htmlToPlainText` in NoteCard
- Capped animation delay at 0.6s
- Added `aria-hidden` + `tabIndex=-1` on faded cards
- Guarded `remainingCount` with `Math.max(0, ...)`

### Pre-Review Agents (3 parallel)
- Replaced `useEffect`+`useState` matchedNoteIds with `useMemo` (eliminated double computation)
- Added `debouncedSearchQuery` state for clean debounce separation
- Cancelled rAF chain on effect cleanup
- Removed chatty `aria-live` from waterline
- Added search timeout cleanup on unmount

---

## Round 1 — Codex CLI

### Findings
1. **MUST FIX:** IntersectionObserver never initializes for collapsed chapters → Fixed: added `effectiveExpanded` to effect deps
2. **SHOULD FIX:** Faded cards keyboard-focusable → Fixed: `inert` attribute on wrappers
3. **SHOULD FIX:** Search activation pre-debounce → Fixed: `isSearchActive = matchedNoteIds !== undefined`
4. **SHOULD FIX:** Rich-text preview removed → **Rejected** (design spec Section 4a)
5. **CONSIDER:** Zero-match count not shown → Fixed: show "0 of N thoughts"

### GH Bot Comments
- Vercel: deployment successful
- Codex GH: usage limits reached
- Claude bot: detailed review with 5 findings (missing tests, docs, CSS bug, perf note, verification)

---

## Round 2 — Codex CLI

### Findings
1. **MUST FIX:** `effectiveExpanded` used before declaration in deps → Fixed: moved declaration above effect
2. **SHOULD FIX:** `aria-expanded`/`aria-controls` on non-button during search → Fixed: conditionally removed

### Claude Bot CSS Finding
- `box-shadow` in transition but `filter: drop-shadow()` used → Fixed: changed to `filter 200ms ease`

---

## Round 3 — Codex CLI

**VERDICT: APPROVED** — All prior findings resolved, no new issues.

---

## Deferred Items

| Item | Reason |
|------|--------|
| ChapterSection.test.tsx (13 planned tests) | Deferred to post-merge (plan Step 9) |
| NoteCard snippet tests | Deferred to post-merge |
| Header result count tests | Deferred to post-merge |
| CLAUDE.md / changelog / AGENTS.md sync | Deferred to post-merge (plan Step 10) |

---

## Rejected Items

| Item | Rationale |
|------|-----------|
| Rich-text preview removal (Codex R1 #4) | Design spec Section 4a explicitly approved this tradeoff: "The preview becomes plaintext-only. This is acceptable because the card preview is a scanning aid, not a reading surface." |
| Search snippet utility extraction | One call site, premature abstraction |
