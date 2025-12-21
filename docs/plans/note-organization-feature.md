# Note Organization Feature: Design Plan

## Conceptual Direction: "Temporal Chapters"

Rather than folders or rigid categories, this design embraces wabi-sabi's appreciation for the passage of time. Notes naturally organize into "chapters" — temporal groupings that reflect when ideas were last touched, like entries in a well-worn journal.

This approach:
- Requires no user effort (automatic organization)
- Honors the natural lifecycle of notes
- Uses poetic language fitting the aesthetic
- Provides instant navigation without endless scrolling

---

## Architecture Overview

### Temporal Groupings

Notes are automatically organized into collapsible sections based on their `updatedAt` timestamp:

| Chapter Name | Time Range | Character |
|--------------|------------|-----------|
| **Today** | Last 24 hours | Fresh, active |
| **This Week** | 2-7 days ago | Recent |
| **This Month** | 8-30 days ago | Settling |
| **Last Month** | 31-60 days ago | Maturing |
| **Seasons Past** | 60+ days ago | Aged, patina |

Each section is collapsible, with only the most recent sections expanded by default.

---

## Design Refinements

Based on design review feedback, three critical refinements have been made:

### Refinement A: Empty Chapters — "Honest Presence"

**Problem**: If a user hasn't written in 3 days, "Today" is empty. Empty chapters create a broken timeline.

**Solution**: Don't render empty chapters. The interface reflects reality, not a template waiting to be filled.

```typescript
// Only render chapters that have content
const visibleChapters = allChapters.filter(chapter => chapter.notes.length > 0);
```

| Scenario | Behavior |
|----------|----------|
| No notes at all | Show welcome/empty state (existing pattern) |
| Only "Seasons Past" has notes | Start directly with "Seasons Past" |
| Gap between "Today" and "Last Month" | Only those two chapters appear |

**Chapter Emergence Animation** (when first note creates a new chapter):
```css
@keyframes chapter-emerge {
  from {
    opacity: 0;
    transform: translateY(-20px);
    max-height: 0;
  }
  to {
    opacity: 1;
    transform: translateY(0);
    max-height: 1000px;
  }
}
```

---

### Refinement B: Masonry Flow — "Floating Markers"

**Problem**: Full-width horizontal dividers break masonry grid flow. Hard lines between chapters look awkward.

**Solution**: Use floating chapter markers in the left margin. The masonry grid stays unified; chapter boundaries are whispered, not shouted.

```
    ┌─────────────────────────────────────────────────────────┐
    │                                                         │
 ╭──────╮  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
 │Today │  │ Note Card   │  │ Note Card   │  │ Note Card   │  │
 ╰──────╯  └─────────────┘  └─────────────┘  └─────────────┘  │
    │      ┌─────────────┐  ┌─────────────┐                   │
    │      │ Note Card   │  │ Note Card   │                   │
    │      └─────────────┘  └─────────────┘                   │
    │                                                         │
 ╭──────╮  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
 │ This │  │ Note Card   │  │ Note Card   │  │ Note Card   │  │
 │ Week │  └─────────────┘  └─────────────┘  └─────────────┘  │
 ╰──────╯  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
    │      │ Note Card   │  │ Note Card   │  │ Note Card   │  │
    │      └─────────────┘  └─────────────┘  └─────────────┘  │
    └─────────────────────────────────────────────────────────┘
```

**Implementation:**
```tsx
<div className="relative">
  {/* Single unified masonry container */}
  <Masonry
    breakpointCols={{ default: 3, 1100: 2, 700: 1 }}
    className="masonry-grid"
  >
    {visibleChapters.flatMap((chapter) => [
      // Inject invisible marker element at chapter start
      <ChapterMarker key={`marker-${chapter.key}`} chapter={chapter} />,
      // Render all notes in this chapter
      ...chapter.notes.map(note => (
        <NoteCard key={note.id} note={note} chapterAge={chapter.key} />
      ))
    ])}
  </Masonry>

  {/* Floating labels in left margin (absolutely positioned) */}
  <ChapterLabels chapters={visibleChapters} />
</div>
```

**ChapterMarker Styling:**
```tsx
<div className="
  absolute left-0
  -ml-20        /* Offset into left margin */
  w-16
  py-2 px-3
  text-right
  sticky top-24  /* Stick below header */
"
style={{
  fontFamily: 'var(--font-display)',
  fontSize: '0.75rem',
  color: 'var(--color-text-tertiary)',
  letterSpacing: '0.05em',
}}>
  Today
</div>
```

**Alternative: Subtle Background Zones**
Each chapter has a barely-perceptible background tint:
```css
/* Light theme - shifts so subtle they're felt more than seen */
.chapter-today { background: rgba(255, 253, 250, 0.3); }
.chapter-this-week { background: rgba(250, 248, 245, 0.3); }
.chapter-this-month { background: rgba(245, 243, 240, 0.3); }
```

---

### Refinement C: Mobile Navigation — "Time Ribbon"

**Problem**: Dot navigation sidebar is unusable on mobile (too small, no hover).

**Solution**: Desktop keeps dot nav. Mobile gets a "Time Ribbon" scrubber at the bottom.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                     [Note Cards...]                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│      ╭─────────────────────────────────────────────╮        │
│      │  ·    ·    ●────·    ·  │  This Week  │     │        │
│      ╰─────────────────────────────────────────────╯        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**
```tsx
// TimeRibbon component (mobile only)
<div className="
  fixed bottom-6 left-1/2 -translate-x-1/2
  flex items-center gap-2
  px-4 py-3
  rounded-full
  backdrop-blur-md
  md:hidden  /* Only on mobile */
"
style={{
  background: 'var(--color-card-bg)',
  border: '1px solid var(--glass-border)',
  boxShadow: 'var(--shadow-lg)',
}}>
  {/* Timeline track */}
  <div className="flex items-center gap-3">
    {chapters.map((chapter) => (
      <button
        key={chapter.key}
        onClick={() => scrollToChapter(chapter.key)}
        className={`
          w-2 h-2 rounded-full transition-all duration-300
          ${currentChapter === chapter.key
            ? 'w-3 h-3 bg-[var(--color-accent)]'
            : 'bg-[var(--color-text-tertiary)] opacity-50'}
        `}
      />
    ))}
  </div>

  {/* Current chapter label */}
  <div className="
    ml-3 pl-3
    border-l border-[var(--glass-border)]
    text-xs font-medium
  "
  style={{
    fontFamily: 'var(--font-display)',
    color: 'var(--color-text-secondary)',
  }}>
    {currentChapterLabel}
  </div>
</div>
```

**Interaction Patterns:**
- **Tap**: Jump directly to chapter
- **Swipe/Drag**: Scrub through chapters with haptic feedback
- **Auto-hide**: Fades to 30% opacity after 2s idle
- **Scroll-aware**: Updates current chapter based on scroll position

**Haptic Feedback:**
```typescript
const handleChapterChange = (newChapter: ChapterKey) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(10); // Subtle tick
  }
  scrollToChapter(newChapter);
};
```

---

## UI Components

### 1. Chapter Labels (Floating Markers)

Floating labels in the left margin that indicate chapter boundaries without breaking masonry flow:

**Design Details:**
- Serif font (Cormorant Garamond) for chapter titles
- Positioned in left margin, outside the masonry grid
- Sticky positioning when scrolling within section
- Subtle, unobtrusive — whispers rather than shouts

---

### 2. Chapter Navigation

**Desktop: Dot Navigation Sidebar**

A floating, minimal sidebar on the right edge:

```
                                                    ┌─────┐
                                                    │  ·  │ ← Today (active)
                                                    │  ·  │ ← This Week
                                                    │  ·  │ ← This Month
                                                    │  ·  │ ← Seasons Past
                                                    └─────┘
```

- Small dots representing each chapter (only chapters with notes)
- Active chapter has accent color glow
- Hover reveals chapter name as tooltip
- Click to smooth-scroll to chapter
- Auto-hides when not scrolling

**Mobile: Time Ribbon Scrubber**

See Refinement C above.

---

### 3. Collapsed Chapter State

Collapsed chapters show a summary preview:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Seasons Past                                  ▸  47 notes  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  Project Ideas · Travel Plans · Reading Notes · ...         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- Dashed line indicates collapsed state
- Shows first 3-4 note titles as preview
- Subtle visual treatment (lower opacity)
- Clicking anywhere expands

---

### 4. Virtual Scrolling Within Chapters

For chapters with many notes (e.g., "Seasons Past" with 100+ notes):
- Implement virtualization using `react-virtuoso` or `@tanstack/react-virtual`
- Only render visible cards plus buffer
- Maintains masonry layout within virtualized container
- Seamless scrolling experience

---

### 5. Default Expansion State

Based on note count and recency:
- **< 20 total notes**: All chapters expanded
- **20-50 notes**: Today, This Week, This Month expanded
- **50-100 notes**: Today, This Week expanded
- **100+ notes**: Only Today expanded

User's collapse preferences saved to localStorage.

---

## New Files Structure

```
src/
├── components/
│   ├── ChapteredLibrary.tsx    # Main container with temporal grouping
│   ├── ChapterMarker.tsx       # Floating margin label for chapter
│   ├── ChapterNav.tsx          # Desktop dot navigation sidebar
│   ├── TimeRibbon.tsx          # Mobile chapter scrubber
│   └── ... (existing)
├── utils/
│   └── temporalGrouping.ts     # Logic for grouping notes by time
└── hooks/
    └── useChapterPreferences.ts # Persist expand/collapse state
```

---

## Type Updates

```typescript
// types.ts
export type ChapterKey = 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'seasonsPast';

export interface ChapterGroup {
  key: ChapterKey;
  label: string;
  notes: Note[];
  isExpanded: boolean;
}
```

---

## Utility Functions

```typescript
// utils/temporalGrouping.ts

export function groupNotesByChapter(notes: Note[]): Map<ChapterKey, Note[]>

export function getChapterLabel(key: ChapterKey): string

export function getChapterForDate(date: Date): ChapterKey

export function getDefaultExpansionState(
  totalNotes: number,
  chapterCounts: Map<ChapterKey, number>
): Record<ChapterKey, boolean>

// Only return chapters that have notes
export function getVisibleChapters(
  allChapters: ChapterGroup[]
): ChapterGroup[]
```

---

## Animation Details

### Chapter Emergence (new chapter appears)
```css
@keyframes chapter-emerge {
  from {
    opacity: 0;
    transform: translateY(-20px);
    max-height: 0;
  }
  to {
    opacity: 1;
    transform: translateY(0);
    max-height: 1000px;
  }
}
```

### Chapter Expand/Collapse
```css
@keyframes chapter-expand {
  from {
    opacity: 0;
    max-height: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    max-height: 2000px;
    transform: translateY(0);
  }
}
```

### Chapter Nav Fade
```css
.chapter-nav {
  opacity: 0;
  transition: opacity 0.3s ease;
}

.chapter-nav.visible {
  opacity: 1;
}
```

### Time Ribbon Pulse (on chapter change)
```css
@keyframes ribbon-pulse {
  0%, 100% { transform: translateX(-50%) scale(1); }
  50% { transform: translateX(-50%) scale(1.02); }
}

.time-ribbon.chapter-change {
  animation: ribbon-pulse 0.3s ease-out;
}
```

### Smooth Scroll
```typescript
const scrollToChapter = (key: ChapterKey) => {
  const element = document.getElementById(`chapter-${key}`);
  element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
```

---

## Visual Treatment by Chapter Age

Each chapter has slightly different visual treatment to convey temporal depth:

| Chapter | Card Opacity | Accent Intensity | Visual Feel |
|---------|--------------|------------------|-------------|
| Today | 1.0 | Full | Fresh, vibrant |
| This Week | 0.95 | 95% | Nearly fresh |
| This Month | 0.90 | 90% | Settling |
| Last Month | 0.85 | 80% | Maturing |
| Seasons Past | 0.80 | 70% | Aged, patina |

This subtle aging effect reinforces the wabi-sabi philosophy — older notes take on a gentle patina, like well-loved paper.

---

## Integration with Existing Features

### Tags + Chapters
- Tag filtering works within chapters
- When tags are selected, chapters only show notes matching the filter
- Empty chapters after filtering are hidden (per Refinement A)

### Search + Chapters
- Search results maintain chapter grouping
- Shows "Found in X chapters" summary
- Highlights matching text within cards

### Pinned Notes
- Pinned notes appear at the top of their respective chapter
- OR: Create a special "Pinned" chapter that appears first (before Today)

### Faded Notes (Soft-Delete)
- Faded Notes view also uses chapter grouping
- Shows "Deleted X days ago" instead of "Updated X days ago"

---

## Synergy with Soft-Delete Feature

Both features work together elegantly:

1. **Shared temporal logic**: Both use date-based grouping
2. **Consistent UI patterns**: Floating markers, unified masonry
3. **Natural flow**: Active notes → Chapters, Deleted notes → Faded Notes view
4. **Same visual language**: Aging/fading aesthetic throughout

**Recommended Implementation Order:**
1. Temporal grouping utility (shared)
2. ChapterMarker component (floating labels)
3. ChapteredLibrary for main view (unified masonry)
4. FadedNotesView (reuses temporal grouping)
5. ChapterNav sidebar (desktop)
6. TimeRibbon scrubber (mobile)
7. Virtual scrolling optimization

---

## Performance Considerations

### Virtual Scrolling Thresholds
- **< 50 notes per chapter**: Standard rendering
- **50+ notes per chapter**: Enable virtualization
- Use `react-virtuoso` for variable-height masonry support

### Lazy Loading
- Collapsed chapters don't render card content
- Only load full content when expanded
- Intersection Observer for progressive loading

---

## Accessibility

- Chapter markers use `aria-label` for screen readers
- Expand/collapse buttons have `aria-expanded` state
- Chapter nav has `role="navigation"` with skip links
- Time Ribbon has proper touch target sizes (44px minimum)
- Keyboard navigation: Tab through chapters, Enter to expand
- Screen reader announces note counts and chapter names

---

## Mobile Considerations

- Time Ribbon replaces dot nav (see Refinement C)
- Chapters default to collapsed on mobile (except Today)
- Larger tap targets for expand/collapse
- Haptic feedback on chapter transitions
- Auto-hide Time Ribbon when idle

---

## Summary of Design Decisions

| Issue | Original Approach | Refined Solution |
|-------|-------------------|------------------|
| Empty chapters | Render all with empty state | Don't render — honest presence |
| Chapter dividers | Full-width horizontal lines | Floating margin labels — soft breaks |
| Mobile navigation | Dot sidebar | Time Ribbon scrubber at bottom |

These refinements maintain the wabi-sabi philosophy:
- **Honest presence**: Interface reflects reality, not imposed structure
- **Soft boundaries**: Transitions whispered through margin labels, not rigid dividers
- **Tactile navigation**: Mobile experience that feels like handling paper

---

## Complexity Assessment

| Aspect | Soft-Delete | Note Organization | Combined |
|--------|-------------|-------------------|----------|
| **Database** | Simple | None | Simple |
| **Service Layer** | Moderate | None | Moderate |
| **State Management** | Moderate | Moderate | Moderate |
| **UI Components** | Moderate | **High** | **High** |
| **CSS/Layout** | Simple | **High** | **High** |

### Overall: **Medium-High Complexity**

### Key Challenges:

1. **Floating Markers in Masonry (Refinement B)** — The trickiest piece
   - `react-masonry-css` doesn't expose item positions
   - Floating labels need to align with the first card of each chapter
   - May require custom position calculation or accepting separate masonry containers

2. **Scroll Position Detection**
   - ChapterNav and TimeRibbon need to know which chapter is visible
   - Requires Intersection Observer on chapter boundaries

3. **Unified Masonry with Chapter Boundaries**
   - Injecting marker elements affects column distribution

### Risk Mitigation:

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Floating markers misalign | Medium | Fall back to separate masonry containers |
| Scroll detection jank | Low | Throttle/debounce observers |
| Mobile Time Ribbon overlap | Low | Add bottom padding to library |

---

## Implementation Phases

### Phase 1 (Lower risk, high value):
1. Temporal grouping utility (shared foundation)
2. Soft-delete (database + service + basic UI)
3. Simple chapter headers (separate masonry containers per chapter)

### Phase 2 (Polish):
4. Floating margin labels (if separate containers feel clunky)
5. ChapterNav (desktop) + TimeRibbon (mobile)
6. Virtual scrolling (only if performance issues arise)

This approach ships working features quickly, then refines aesthetics.

---

This design provides elegant organization that scales from 10 to 1000+ notes while maintaining the calm, contemplative wabi-sabi aesthetic. Notes naturally find their place in time, requiring no manual organization from the user.
