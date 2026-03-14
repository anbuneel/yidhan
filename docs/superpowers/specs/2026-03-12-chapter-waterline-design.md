# Chapter Waterline: Scaling Yidhan's Library

**Version:** 1.1
**Last Updated:** 2026-03-12
**Status:** Draft
**Author:** Claude (Opus 4.6)

---

## Original Prompt

> I want to use the frontend-design skill to solve for the scenario when a user has say 100 notes. We don't want endless scrolling! Discuss and review.

---

## Problem Statement

When a user accumulates 100+ notes, the library view suffers from three compounding issues:

1. **Performance:** All notes in expanded chapters render simultaneously — 100+ DOM nodes, each running DOMPurify sanitization, with no virtualization or pagination.
2. **Overwhelm:** The masonry grid becomes visually dense, killing Yidhan's calm aesthetic.
3. **Discovery:** Finding a specific note requires scrolling through everything or relying on basic title-only search.

### Current Architecture Gaps

- `ChapterSection` renders ALL notes in a chapter at once (`notes.map(...)`)
- `ChapterSection` is not wrapped in `React.memo` — re-renders on every parent state change
- `NoteCard` passes full `note.content` to `sanitizeHtml()` even though CSS clips at 300px
- Default chapter collapsing helps (100+ notes: only Pinned + This Week expand), but a chapter with 80 notes still renders all 80
- Search only matches note titles, no content search
- Current search shortcut is `Ctrl+Shift+K` (defined in `App.tsx` line 1127)

---

## Design: Chapter Waterline

**Approach:** Keep temporal chapters as the primary organization model. Add progressive rendering within chapters, a washi-paper-edge "waterline" affordance, and enhanced in-place search.

**Guiding principles:**
- Restraint over features — no new views, modes, or navigation paradigms
- Warmth over precision — organic textures and motion, not mechanical loading patterns
- Calm over engagement — the user controls the pace of discovery

---

## Section 1: Progressive Rendering Engine

Each `ChapterSection` manages a `visibleCount` state, starting at `INITIAL_CARD_COUNT = 6`. Only `notes.slice(0, visibleCount)` is passed to the masonry grid.

An `IntersectionObserver` watches a sentinel `<div>` placed after the last visible card. When the sentinel enters the viewport, `visibleCount` increases by `BATCH_SIZE = 6`.

```
Chapter: "This Week" (23 notes)
┌─────────────────────────────────────┐
│  [card1] [card2] [card3]            │  ← rendered
│  [card4] [card5] [card6]            │  ← rendered
│  ┄┄┄ sentinel (IntersectionObserver)│
│  ░░░░░░░░░░░░░░░░░░░░░░░░          │  ← NOT in DOM
│  "17 more from this week..."        │  ← waterline
└─────────────────────────────────────┘
```

**Behavior:**
- Sentinel has `rootMargin: '200px'` — cards load before the user reaches them (no visible gap)
- `visibleCount` resets when `notes` array reference changes (tag filter, new note)
- Existing staggered CSS entrance animations apply to each new batch
- New cards animate with a rising wave: `translateY(6px) → translateY(0)` + `opacity: 0 → 1`, staggered left-to-right across masonry columns (200ms per card, 60ms stagger)
- IntersectionObserver is disconnected on component unmount (cleanup in `useEffect` return)
- This observer is per-ChapterSection, separate from the existing chapter-tracking observer in `ChapteredLibrary` (line 81)

**Interaction with search:** When search is active (non-empty query), progressive rendering is **suspended** — all notes render immediately. See Section 3 for details.

**Impact:** ~80% fewer DOM nodes on initial load. With 100 notes distributed across chapters and `INITIAL_CARD_COUNT = 6` per chapter, expect ~12-24 rendered cards (vs 100 today). Exact count depends on note distribution across chapters.

---

## Section 2: The Waterline

A visual affordance that communicates "there's more below" — styled as an organic washi paper edge, not a generic CSS gradient.

**Appearance:**
- A CSS `mask-image` using an inline SVG with an organic, rough edge profile — evoking the torn bottom edge of handmade washi paper. SVG preferred over PNG for resolution independence. Fallback: `linear-gradient(to bottom, black 60%, transparent)` for browsers that don't support SVG masks.
- The last visible card row gets slightly reduced opacity (~0.92) as a "fading into the page" hint
- Below the edge: quiet, muted text using `--color-text-tertiary` and `--font-body` at small size

**Chapter-aware text variants** (keyed off `ChapterKey` from `temporalGrouping.ts`, stored as a separate `WATERLINE_TEXT` map):
- **pinned:** `"N more pinned..."`
- **thisWeek:** `"N more from this week..."`
- **lastWeek:** `"N more from last week..."`
- **thisMonth:** `"N more this month..."`
- **earlier:** `"N quieter thoughts..."`
- **archive:** `"N resting here..."`

**Behavior:**
- Only appears when a chapter has more notes than `visibleCount`
- Count updates as more cards load: "17 more..." → "11 more..." → "5 more..."
- When all cards are revealed, the waterline fades out (CSS transition, ~300ms)
- **Not clickable** — scrolling is the interaction. No button, no "Load more" link.
- Hidden when search is active (progressive rendering suspended, all cards shown)

**Mobile:** Same behavior, slightly taller mask area (56px vs 40px desktop) for more visual breathing room.

**Implementation:** The washi edge SVG is a small repeating tile (~200px wide) inlined as a data URI in CSS to avoid an extra network request. Total size ~1-2KB.

---

## Section 3: Enhanced Search ("Focused Gaze")

Instead of a modal overlay that removes the user from the library context, search works as a "focused gaze" — non-matching cards recede, matching cards glow, and the chapter structure stays visible.

### Architecture Change

The current search model in `App.tsx` **filters** `displayNotes` — non-matching notes are removed from the data entirely. The focused-gaze model requires a different approach:

**Data flow:**
1. `App.tsx` always passes the **full** `notes` array (post-tag-filter) to `ChapteredLibrary`
2. When search is active, `App.tsx` also computes and passes `searchQuery: string` and `matchedNoteIds: Set<string>`
3. `ChapteredLibrary` passes these to each `ChapterSection`
4. `ChapterSection` applies highlight/fade styling at the wrapper `<div class="note-card-entrance">` level — this covers both `NoteCard` and `SwipeableNoteCard` without changes to either component
5. When search is cleared, `searchQuery` becomes empty and all cards restore to full opacity

**Matching logic:** Client-side only. Searches against decrypted note titles and content already held in React state (no re-decryption needed). Uses existing 300ms debounce from `App.tsx`.

### Search + Progressive Rendering Interaction

When `searchQuery` is non-empty:
- Progressive rendering is **suspended**: `ChapterSection` renders ALL notes (ignores `visibleCount`)
- The waterline is hidden
- Non-matching cards render at 10-15% opacity — these are lightweight (faded shell, no interaction handlers needed)
- This is acceptable at 100-500 notes; at higher scale, virtual scrolling would be needed (out of scope)

When search is cleared:
- Progressive rendering resumes, `visibleCount` resets to `INITIAL_CARD_COUNT`
- Waterlines reappear where applicable
- Cards restore to full opacity

### Interaction Details

1. User types in the existing search bar (or presses `Ctrl+Shift+K` to focus it — existing shortcut)
2. Search matches against both **title** and **decrypted content** (plaintext substring match)
3. Non-matching cards fade to ~10-15% opacity (CSS transition, 200ms)
4. Matching cards get a subtle glow: slight scale bump (`transform: scale(1.02)`) and increased brightness
5. Chapter headers remain visible — user sees *where* matches live temporally
6. Result count shown below the search bar: "3 of 100 thoughts" (uses `aria-live="polite"`)
7. `Escape` or clearing the search bar restores all cards to full opacity

**Snippet highlighting:**
- When search is active, matching cards show a brief content snippet (~40 chars around the first match) below the existing preview, with the match term highlighted via `<mark>`
- Snippet text extracted from plaintext (using existing `htmlToPlainText()`), then escaped with `escapeHtml()` before inserting the `<mark>` tag

**Keyboard navigation (deferred):** Arrow-key navigation between matching cards is complex with masonry layout (variable card heights break linear order). Deferred to a follow-up. For now, users scroll to find highlighted matches visually.

**Why "focused gaze" over a modal overlay:**
- Preserves spatial memory — "my garden note is somewhere in Last Week"
- Doesn't break the chapter structure that users have learned
- Feels like focusing your eyes, not switching to a different app mode
- Aligns with "the app recedes into the background" design principle

**What we're NOT building:**
- No fuzzy matching (exact substring is sufficient at 100-500 notes)
- No search history or recent searches
- No separate search page or route
- No server-side search index
- No arrow-key navigation between matches (deferred)

---

## Section 4: Silent Performance Optimizations

No visible UI change — these make the above features feel smooth.

### 4a. Content truncation before sanitization

`NoteCard` currently passes full `note.content` to `sanitizeHtml()`. The card clips at 300px with CSS overflow anyway.

**Fix:** Use existing `htmlToPlainText()` to convert content to plaintext, truncate to ~200 characters, then render as text. This is the same approach already used in compact mode (`NoteCard` line 21). Extending it to full mode eliminates the need for a `truncateHtml()` utility entirely.

```
Before: sanitizeHtml(note.content)           // 5000 chars HTML → DOMPurify → rich DOM
After:  htmlToPlainText(note.content, 200)   // 5000 chars → plaintext → truncate → text node
```

Trade-off: Full-mode cards lose rich text preview (headings, bold, lists in preview). The preview becomes plaintext-only. This is acceptable because the card preview is a scanning aid, not a reading surface — users open the note for full content.

### 4b. React.memo on ChapterSection

Currently missing. Adding `React.memo` with a comparator on all props that affect rendering:

```typescript
const ChapterSection = memo(function ChapterSection(...) { ... },
  (prev, next) =>
    prev.notes === next.notes &&
    prev.isExpanded === next.isExpanded &&
    prev.label === next.label &&
    prev.searchQuery === next.searchQuery &&
    prev.matchedNoteIds === next.matchedNoteIds &&
    prev.onNoteClick === next.onNoteClick &&
    prev.onNoteDelete === next.onNoteDelete &&
    prev.onTogglePin === next.onTogglePin
);
```

Callback props (`onNoteClick`, `onNoteDelete`, `onTogglePin`) must be stabilized with `useCallback` in `ChapteredLibrary` to prevent memo invalidation.

### 4c. Rising wave animation

New cards animate with `translateY(6px)` → `translateY(0)` combined with opacity fade-in. Staggered left-to-right across masonry columns: 200ms duration, 60ms delay between cards. This replaces the current flat delay cap (`Math.min(index * 0.05, 0.5)`) which dumps all cards after index 10 simultaneously.

With progressive rendering (6-card batches), the animation cap is no longer needed — batches are small enough to animate individually.

`prefers-reduced-motion`: Rising wave collapses to instant render (0ms duration).

---

## Files Changed

| File | Change |
|---|---|
| `src/components/ChapterSection.tsx` | Progressive rendering (`visibleCount`, IntersectionObserver, sentinel), waterline element, `React.memo` wrapper with full comparator, rising wave animation, search highlight styling on wrapper div |
| `src/components/NoteCard.tsx` | Content truncation (plaintext preview in all modes), search snippet display with `<mark>` highlighting |
| `src/components/Header.tsx` | Enhanced search: content matching logic, result count display below search bar |
| `src/components/ChapteredLibrary.tsx` | Pass `searchQuery` + `matchedNoteIds` to ChapterSections, stabilize callbacks with `useCallback` |
| `src/App.tsx` | Change search to compute `matchedNoteIds: Set<string>` instead of filtering `displayNotes`, pass both full notes and match set |
| `src/index.css` | Waterline styles (mask-image with SVG + gradient fallback, text), search highlight/fade transitions, rising wave keyframes |
| `src/utils/temporalGrouping.ts` | Export `WATERLINE_TEXT` map keyed by `ChapterKey` |

**New files:** None. All changes within existing components.

**New assets:** One washi paper edge SVG, inlined as CSS data URI (~1-2KB).

---

## Accessibility

- `prefers-reduced-motion`: All progressive reveal and rising wave animations collapse to instant render (0ms). Waterline text and search highlighting still work (opacity/state changes, not motion).
- Screen readers: Waterline text uses `aria-live="polite"` to announce count updates. Search result count announced via `aria-live="polite"` below the search bar.
- Keyboard: `Ctrl+Shift+K` to focus search (existing shortcut). `Escape` to clear. Arrow-key navigation between matches deferred.
- Focus-visible rings maintained on all interactive elements.
- No content is permanently hidden — all notes are accessible by scrolling. Progressive rendering is an optimization, not a gate.

---

## Edge Cases

- **Chapter with ≤6 notes:** No waterline shown, all cards render immediately. No behavioral change.
- **All notes match search:** All cards at full opacity, no visual change except result count.
- **No search matches:** All cards fade to 10-15% opacity. "No thoughts found" message centered in library area.
- **Tag filter + search combined:** Tag filter narrows `displayNotes` first (removing notes from data), then search highlights within that filtered set.
- **New note created while waterline active:** `visibleCount` resets (notes array reference changes), new note appears at top of its chapter.
- **New note created during search:** `matchedNoteIds` recomputes, new note matches or doesn't based on content.
- **Offline:** No impact — all data is already in IndexedDB/React state. Search is client-side only.
- **Search active + chapter has 80 notes:** All 80 render (progressive rendering suspended). ~70+ are faded shells at 10-15% opacity — lightweight to paint. Acceptable at this scale.
- **SwipeableNoteCard on touch devices:** Highlight/fade applied at wrapper div level in ChapterSection, not inside NoteCard or SwipeableNoteCard. Both wrapped components inherit the styling.

---

## What This Design Does NOT Include

- Virtual scrolling libraries (react-window, etc.) — progressive rendering keeps DOM count low enough
- Compact list view — deferred; search-first approach covers the "finding" use case
- Separate search page or route
- Server-side search index
- Fuzzy matching
- Pagination controls (page 1, 2, 3...)
- "Back to top" button
- Arrow-key navigation between search matches (deferred to follow-up)

---

## Test Plan

### Unit Tests

**Progressive rendering (`ChapterSection`):**
- Renders only `INITIAL_CARD_COUNT` cards when chapter has more notes
- Renders all cards when chapter has ≤ `INITIAL_CARD_COUNT` notes
- `visibleCount` increases by `BATCH_SIZE` when sentinel is observed (mock IntersectionObserver)
- `visibleCount` resets when `notes` prop reference changes
- Renders all cards when `searchQuery` is non-empty (progressive rendering suspended)
- Waterline shows correct count text for each `ChapterKey`
- Waterline hidden when all cards visible
- Waterline hidden when search is active
- `React.memo` comparator prevents re-render when props unchanged

**Content truncation (`NoteCard`):**
- Preview uses plaintext truncated to ~200 chars in all modes
- Search snippet displays with `<mark>` highlight when `searchQuery` matches content
- Search snippet uses `escapeHtml()` to prevent XSS

**Search (`App.tsx` / `Header.tsx`):**
- `matchedNoteIds` computed correctly for title matches
- `matchedNoteIds` computed correctly for content matches
- Empty search query produces empty `matchedNoteIds` (not all notes)
- Debounce prevents recomputation on every keystroke
- Result count displays correctly

### Integration / Visual Tests

- Library with 100 notes: verify only ~12-24 card DOM nodes on initial load
- Scroll through chapter: verify cards appear smoothly with rising wave animation
- Type search query: verify non-matching cards fade, matching cards glow
- Clear search: verify all cards restore and progressive rendering resumes
- Tag filter + search: verify both filters compose correctly

---

## Success Criteria

1. **Performance:** Initial render with 100 notes loads ≤24 DOM card nodes (vs 100 today)
2. **Perceived speed:** No visible loading gap when scrolling through chapters
3. **Discovery:** User can find any note by content keyword within 2 keystrokes + scan
4. **Calm:** The library with 100 notes feels as calm as the library with 10 notes
5. **Zero new UI paradigms:** No new views, modes, or navigation patterns to learn
