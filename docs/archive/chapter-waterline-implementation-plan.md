# Chapter Waterline — Implementation Plan (v5 — Final)

**Version:** 5.0
**Last Updated:** 2026-03-14
**Status:** Living Document
**Author:** Claude (Opus 4.6)
**Review:** Approved after 5-round multi-agent review (see `docs/reviews/plan-review-b7d4e82f.md`)

---

## Original Prompt

> Implement the Chapter Waterline design spec (`docs/superpowers/specs/2026-03-12-chapter-waterline-design.md`) — progressive rendering, waterline affordance, and focused-gaze search.

---

## Context

When a user accumulates 100+ notes, the library suffers from: all notes rendering simultaneously (~100 DOM nodes), visual overwhelm, and poor discoverability. The spec was brainstormed and approved (v1.2, peer-reviewed). We're now executing.

Three layered changes:
1. **Progressive Rendering** — 6 cards per chapter initially, 6 more on scroll
2. **Waterline** — Washi paper-edge mask below last visible row with chapter-aware text
3. **Focused-Gaze Search** — Non-matching cards fade (10-15% opacity) instead of being removed from DOM

Plus: `React.memo` on ChapterSection, content truncation, rising wave animation.

**Branch:** `feature/chapter-waterline` (already created)

---

## Step 1: `src/utils/temporalGrouping.ts` — Waterline text map

Add exported `WATERLINE_TEXT` map:

```typescript
export const WATERLINE_TEXT: Record<ChapterKey, (count: number) => string> = {
  pinned: (n) => `${n} more pinned...`,
  thisWeek: (n) => `${n} more from this week...`,
  lastWeek: (n) => `${n} more from last week...`,
  thisMonth: (n) => `${n} more this month...`,
  earlier: (n) => `${n} quieter thoughts...`,
  archive: (n) => `${n} resting here...`,
};
```

Pure data, no deps. ~5 lines.

---

## Step 2: `src/components/NoteCard.tsx` — Content truncation + search snippet

**Content truncation (all modes):**
- Replace full-mode `dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }}` (line 169) with plaintext: `htmlToPlainText(note.content).slice(0, 200)` — same approach already used in compact mode (line 21)
- This eliminates per-card DOMPurify full-HTML sanitization

**Search snippet:**
- Add `searchQuery?: string` prop
- When `searchQuery` matches content (matched against `htmlToPlainText(note.content)`, case-insensitive), show ~40 char snippet below preview with `<mark>` highlighting
- Use `escapeHtml()` on the snippet text before inserting `<mark>` for XSS safety
- Both `htmlToPlainText` and `escapeHtml` already exist in `src/utils/sanitize.ts`

**Memo comparator:** Add `searchQuery` to the existing comparator (line 247)

---

## Step 3: `src/components/SwipeableNoteCard.tsx` — Thread searchQuery

- Add `searchQuery?: string` prop to interface (line 7-14)
- Pass it through to inner `<NoteCard>` (line 184-190)
- Add to memo comparator (line 194)

Small change, ~5 lines.

---

## Step 4: `src/components/ChapterSection.tsx` — Core feature

**New props:** `searchQuery?: string`, `matchedNoteIds?: Set<string>`

**Progressive rendering:**
- Constants: `INITIAL_CARD_COUNT = 6`, `BATCH_SIZE = 6`
- `visibleCount` state, starts at `INITIAL_CARD_COUNT`
- Render `notes.slice(0, visibleCount)` in masonry grid
- Sentinel `<div ref={sentinelRef}>` after masonry, watched by `IntersectionObserver` (`rootMargin: '200px'`)
- On intersection: increment visibleCount by BATCH_SIZE (capped at notes.length)

**Sentinel loading strategy:**
- Use a `readyRef` that flips to `true` after a 100ms `setTimeout` in the observer setup `useEffect`. Intersection callbacks are ignored until `readyRef.current` is `true`.
- After `readyRef` flips, do an initial manual viewport check via `sentinelRef.current.getBoundingClientRect()`.
- **Drain loop:** After each `visibleCount` increment (whether from observer or manual check), schedule a `requestAnimationFrame` follow-up. In the rAF callback, check if the sentinel is still in/near the viewport. If so, increment again. This loop continues until the sentinel scrolls out of view or all notes are rendered. This handles very tall viewports where the sentinel stays visible across multiple batches.
- IntersectionObserver is disconnected on component unmount (cleanup in `useEffect` return).

**Smart reset:** `visibleCount` resets to `INITIAL_CARD_COUNT` when the note set changes. Uses `notes.map(n => n.id).join(',')` as the fingerprint stored in a `prevFingerprintRef`. This catches: new notes, removals, tag-filter transitions, and reordering (including reordering from edits that update `updatedAt`). Per spec line 65, resetting on note array changes is the intended behavior.

**Search suspension:** When `searchQuery` is non-empty, progressive rendering is suspended — ALL notes render (ignore `visibleCount`). When `searchQuery` becomes empty (search cleared), `visibleCount` resets to `INITIAL_CARD_COUNT`.

**Chapter expansion during search:**
- When `searchQuery` is non-empty, force `effectiveExpanded = true` regardless of `isExpanded` state. This ensures matches in collapsed chapters (Earlier, Archive) are visible.
- When search is cleared, restore prior `isExpanded` state (no change to user's manual collapse/expand decisions).

**Waterline element:**
- Show below masonry when `visibleCount < notes.length` and no search active
- Text from `WATERLINE_TEXT[chapterKey](notes.length - visibleCount)`
- CSS `mask-image` with inline SVG washi paper edge on last visible row
- Fade out via CSS transition (300ms) when all cards revealed

**Search highlight/fade on wrapper divs:**
- Each `.note-card-entrance` wrapper gets conditional class:
  - `note-card-search-fade` if search active and note NOT in `matchedNoteIds`
  - `note-card-search-match` if note IS in `matchedNoteIds`
- Pass `searchQuery` to NoteCard/SwipeableNoteCard for snippet display

**Rising wave animation:**
- Replace `animationDelay: Math.min(index * 0.05, 0.5)s` (line 195) with new stagger: `index * 60ms` within each batch
- New `@keyframes rising-wave`: translateY(6px) → translateY(0) + opacity

**React.memo:** Wrap entire component with full comparator (all props including search). Callback props (`onNoteClick`, `onNoteDelete`, `onTogglePin`) will be stabilized in App.tsx (Step 7a) using refs, making them truly stable across renders.

---

## Step 5: `src/index.css` — New styles

- `.waterline` — container with washi-edge mask-image (inline SVG data URI), gradient fallback
- `.waterline-text` — `--color-text-tertiary`, `--font-body`, small size
- `.note-card-search-fade` — `opacity: 0.12`, `pointer-events: none`, `transition: opacity 200ms`
- `.note-card-search-match` — `transform: scale(1.02)`, subtle glow box-shadow, `transition: 200ms`
- `@keyframes rising-wave` — `from { opacity:0; transform:translateY(6px) }` → `to { opacity:1; transform:translateY(0) }`
- Update `.note-card-entrance` to use `rising-wave`
- Mobile: waterline mask area 56px vs 40px desktop
- `prefers-reduced-motion` already collapses all animations globally (line 430-442) — no extra work needed

---

## Step 6: `src/components/ChapteredLibrary.tsx` — Thread search props + "No thoughts found"

- Add `matchedNoteIds?: Set<string>` to props
- Pass `searchQuery` and `matchedNoteIds` to each `<ChapterSection>`
- Callback props (`onNoteClick`, `onNoteDelete`, `onTogglePin`) are passed through directly (stabilization happens in App.tsx)
- **"No thoughts found" overlay:** When `searchQuery` is non-empty and `matchedNoteIds` is an empty Set (size 0), render a centered "No thoughts found" message overlaid on the faded library. This matches spec line 256: message centered in library area. The library (with all cards faded) remains visible behind it.

**Note:** Result count display ("N of M thoughts") is handled in `Header.tsx` (Step 8), not here. "No thoughts found" is the library-area counterpart.

---

## Step 7: `src/App.tsx` — Focused-gaze search + callback stabilization

### Step 7a: Stabilize callback props using refs

The `React.memo` comparator on `ChapterSection` requires truly stable callback references. Three handlers close over changing state (`notes`, `selectedNoteId`), which would invalidate memo on every render if used as `useCallback` deps.

**Solution: ref-based callbacks.** Store mutable values in refs and read from refs inside `useCallback` with empty/minimal deps:

```typescript
const notesRef = useRef(notes);
notesRef.current = notes;

const selectedNoteIdRef = useRef(selectedNoteId);
selectedNoteIdRef.current = selectedNoteId;

const handleNoteClick = useCallback((id: string) => {
  startTransition(() => {
    setSelectedNoteId(id);
    setView('editor');
  });
}, [startTransition]); // startTransition is stable from useTransition

const handleNoteDelete = useCallback(async (id: string): Promise<boolean> => {
  if (!user) return false;
  const deletedNote = notesRef.current.find((n) => n.id === id);
  // ... rest of delete logic using notesRef/selectedNoteIdRef
}, [user]); // Only depends on user identity

const handleTogglePin = useCallback(async (id: string, pinned: boolean) => {
  if (!user) return;
  // ... uses setNotes functional updater (no notes closure needed)
}, [user]); // Only depends on user identity
```

**Why this works:** `handleNoteClick` only uses `startTransition` (stable). `handleNoteDelete` reads `notes` and `selectedNoteId` via refs, so it depends only on `user`. `handleTogglePin` already uses `setNotes(prev => ...)` functional updater, so it also only depends on `user`. All three callbacks are stable across note changes.

### Step 7b: Focused-gaze search architecture

**Key architectural change:** Search no longer filters `displayNotes`. Instead it computes `matchedNoteIds`.

- Remove `searchResults` state and `isSearching` state
- Add `matchedNoteIds` state: `useState<Set<string> | undefined>(undefined)`
- **Matching logic:** Compute matches client-side against `displayNotes` (post-tag-filter, not raw `notes`). For each note, match `searchQuery` (case-insensitive) against `note.title` and `htmlToPlainText(note.content)`. This ensures tag filter + search compose correctly — search only highlights within the tag-filtered set.
- **Debounced computation:** The existing 300ms debounce in `handleSearchChange` computes `matchedNoteIds` synchronously (no async search service calls needed — notes are already decrypted in React state).
- **Recomputation on notes change:** Add a `useEffect` that recomputes `matchedNoteIds` when `displayNotes` changes while `searchQuery` is non-empty. This handles new notes, edits, or sync updates during active search.
- **Tag toggle preserves search:** Remove any existing behavior that clears `searchQuery` when tags are toggled. `matchedNoteIds` naturally recomputes because `displayNotes` changes.
- `displayNotes` always uses `sortedNotes` filtered only by selected tags (never by search)
- Remove the `{isSearching ? <spinner> : <ChapteredLibrary>}` conditional (lines ~2118-2122) — library always renders
- Pass `matchedNoteIds` to `ChapteredLibrary`
- Pass `matchedNoteIds?.size` and `displayNotes.length` to `Header` for result count display

---

## Step 8: `src/components/Header.tsx` — Result count

- Add `matchedCount?: number` and `totalCount?: number` props
- When search is active and `matchedCount` is defined and `matchedCount > 0`:
  - Show "N of M thoughts" below the search bar (spec line 146)
- Use `aria-live="polite"` for screen reader announcements
- **Note:** "No thoughts found" (matchedCount === 0) is displayed in ChapteredLibrary as a centered overlay (spec line 256), not in Header.

---

## Step 9: Tests

### New unit tests

**`src/components/ChapterSection.test.tsx` (new file):**
- Renders only `INITIAL_CARD_COUNT` cards when chapter has more notes
- Renders all cards when chapter has ≤ `INITIAL_CARD_COUNT` notes
- `visibleCount` increases by `BATCH_SIZE` when sentinel is observed (mock IntersectionObserver)
- `visibleCount` resets when note ID fingerprint changes (new notes, removals, reordering)
- Renders all cards when `searchQuery` is non-empty (progressive rendering suspended)
- Force-expands collapsed chapters during search
- Restores collapse state when search is cleared
- Waterline shows correct count text for each `ChapterKey`
- Waterline hidden when all cards visible
- Waterline hidden when search is active
- Search fade/highlight classes applied correctly to wrapper divs
- `React.memo` comparator prevents re-render when props unchanged
- Sentinel drain loop loads multiple batches on tall viewports

**`src/components/NoteCard.tsx` (update existing tests or add):**
- Preview uses plaintext truncated to ~200 chars in all modes (not just compact)
- Search snippet displays with `<mark>` highlight when `searchQuery` matches content
- Search snippet uses `escapeHtml()` — no raw HTML injection possible
- No snippet shown when `searchQuery` doesn't match

**`src/components/Header.test.tsx` (update):**
- Result count "N of M thoughts" displays when `matchedCount > 0`
- No result count when `matchedCount` is undefined

### Update existing tests

- **`src/components/ChapteredLibrary.test.tsx`:** Update tests that assert old filtered-search "No results" empty state. Add test for "No thoughts found" overlay when search active + zero matches.
- **`e2e/notes.spec.ts`:** Update any E2E tests that assert search filtering behavior to match focused-gaze model.

---

## Step 10: Documentation updates (deferred to post-implementation)

- Update `CLAUDE.md` project structure section
- Add changelog entry to `src/data/changelog.ts`
- Run `npm run docs:sync-agents`

---

## Files Changed

| File | Key Changes |
|---|---|
| `src/utils/temporalGrouping.ts` | `WATERLINE_TEXT` map |
| `src/components/NoteCard.tsx` | Plaintext truncation, search snippet with `<mark>` |
| `src/components/SwipeableNoteCard.tsx` | Thread `searchQuery` prop |
| `src/components/ChapterSection.tsx` | Progressive rendering (ID fingerprint reset, sentinel drain loop), waterline, memo, search styling, force-expand during search |
| `src/index.css` | Waterline, fade/glow, rising-wave keyframes |
| `src/components/ChapteredLibrary.tsx` | Thread search props, "No thoughts found" overlay |
| `src/App.tsx` | Ref-based `useCallback` on handlers, `matchedNoteIds` computation against `displayNotes`, remove `isSearching` spinner, tag toggle preserves search, recomputation on notes change |
| `src/components/Header.tsx` | Result count display |
| `src/components/ChapterSection.test.tsx` | **New file** — progressive rendering, waterline, search, memo, drain loop tests |
| `src/components/ChapteredLibrary.test.tsx` | Update search-related assertions |
| `src/components/Header.test.tsx` | Add result count tests |

---

## Verification

After each step: `npm run check` (typecheck + lint + test + build)

Final testing:
- Library with many notes: verify ≤24 initial DOM card nodes
- Scroll through chapter: cards appear with rising wave animation
- Type search: non-matching cards fade, matches glow with snippet
- Search finds matches in collapsed chapters (force-expanded)
- Clear search: cards restore, chapters restore collapse state, progressive rendering resumes
- Tag filter + search: both compose correctly, tag toggle preserves search
- Pin toggle during waterline: revealed cards stay revealed
- Tag filter switch (same count, different notes): visibleCount resets
- Edit note during waterline: visibleCount may reset if note reorders (per spec)
- New note during active search: matchedNoteIds recomputes
- No matches: "No thoughts found" centered in library with all cards faded
- Tall viewport: sentinel drain loop loads all necessary batches
- `prefers-reduced-motion`: rising wave disabled
- Mobile: waterline 56px height, bottom toolbar unaffected

---

## Not in scope
- Arrow-key nav between search matches (deferred)
- Fuzzy matching, search history
- Virtual scrolling, compact list view
