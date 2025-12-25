# TagFilterBar Improvement Plan (Mobile + Desktop)

## Problem Statement

### Mobile (~375px)
The horizontal scrolling TagFilterBar hides tags beyond the viewport. Users must:
1. Guess that more tags exist (only fade indicator hints at this)
2. Manually scroll horizontally to discover and select tags
3. Lose context of which tags are selected when scrolling

### Desktop with Many Tags (20+)
Even on desktop (~1280px), horizontal scroll becomes problematic:
1. 20 tags requires scrolling 2-3 screen widths
2. Selected tags may be off-screen with no visual indication
3. Finding a specific tag requires extensive scrolling
4. Fade indicators don't show *how many* tags are hidden

This breaks the "calm, distraction-free" promise of Zenote on both platforms.

---

## Design Direction: "Unfolding Scroll"

Inspired by Japanese byōbu (folding screens) and the wabi-sabi aesthetic of revealing beauty gradually.

### Unified Behavior (Mobile + Desktop)

The same expandable pattern works on both platforms, with different row limits:

| Screen Size | Default Rows | Max Height | Expand Trigger |
|-------------|--------------|------------|----------------|
| Mobile (<640px) | 1 row | 56px | When >1 row needed |
| Desktop (≥640px) | 2 rows | 120px | When >2 rows needed |

### Mobile Collapsed State (1 row)
```
[All Notes] | [Tag 1] [Tag 2] [Tag 3]  [+5 ▼]
```
- Single row, fixed height (56px)
- Shows as many tags as fit naturally
- "+N" indicator shows count of hidden tags

### Desktop Collapsed State (2 rows)
```
[All Notes] | [Tag 1] [Tag 2] [Tag 3] [Tag 4] [Tag 5] [Tag 6] [Tag 7] [Tag 8]
             [Tag 9] [Tag 10] [Tag 11] [Tag 12] [Tag 13] [Tag 14] [+]  [+6 ▼]
```
- Two rows visible by default
- Shows ~14-16 tags before needing expand
- "+N" only appears when more than 2 rows needed

### Expanded State (Both Platforms)
```
[All Notes] | [Tag 1] [Tag 2] [Tag 3] [Tag 4] [Tag 5] [Tag 6] [Tag 7] [Tag 8]   [▲]
             [Tag 9] [Tag 10] [Tag 11] [Tag 12] [Tag 13] [Tag 14] [Tag 15] [Tag 16]
             [Tag 17] [Tag 18] [Tag 19] [Tag 20] [+]
```
- Multi-row wrap layout showing ALL tags
- Smooth height animation (300ms ease-out)
- Up chevron to collapse
- Add tag button at end of flow

### Edge Cases

**Few Tags (fits in default rows):**
- No expand button shown
- Behaves like current implementation
- Clean, minimal appearance

**No Tags:**
- Only "All Notes" pill + Add button shown
- No expand functionality needed

---

## Implementation Approach

### Option A: Unified Expandable Wrap (Recommended)

**Pros:**
- All tags visible when needed on both mobile AND desktop
- Consistent UX pattern across screen sizes
- Row limits adapt to available space (1 row mobile, 2 rows desktop)
- Natural, discoverable interaction
- Preserves existing pill styling

**Cons:**
- Pushes content down when expanded
- Requires state management and row calculation

### Option B: Bottom Sheet / Drawer

**Pros:**
- Doesn't affect page layout
- Can show additional tag management options

**Cons:**
- Extra tap to access
- Feels more "app-like" than the calm aesthetic
- Disconnected from header area

### Option C: Keep Horizontal Scroll (Enhanced)

**Pros:**
- Minimal code changes
- Familiar pattern

**Cons:**
- Doesn't solve core discoverability issue
- Hidden tags remain hidden
- Especially problematic with 20+ tags on desktop

**Decision: Option A (Unified Expandable Wrap)**

---

## Technical Implementation

### Step 1: Add State and Refs

```tsx
// TagFilterBar.tsx
const [isExpanded, setIsExpanded] = useState(false);
const [hiddenCount, setHiddenCount] = useState(0);
const containerRef = useRef<HTMLDivElement>(null);
const contentRef = useRef<HTMLDivElement>(null);
```

### Step 2: Responsive Row Limits

```tsx
// Hook to get current breakpoint
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

// Row configuration
const isMobile = useIsMobile();
const maxRows = isMobile ? 1 : 2;
const collapsedHeight = isMobile ? 56 : 120; // h-14 or h-30
```

### Step 3: Calculate Overflow and Hidden Count

```tsx
// Calculate how many tags overflow beyond the allowed rows
useEffect(() => {
  if (!contentRef.current || isExpanded) {
    setHiddenCount(0);
    return;
  }

  const content = contentRef.current;
  const pills = content.querySelectorAll('[data-tag-pill]');
  const rowHeight = isMobile ? 40 : 44; // Approximate pill height + gap
  const maxVisibleBottom = collapsedHeight - 8; // Account for padding

  let hidden = 0;
  pills.forEach((pill) => {
    const rect = pill.getBoundingClientRect();
    const containerRect = content.getBoundingClientRect();
    const relativeTop = rect.top - containerRect.top;

    if (relativeTop + rowHeight > maxVisibleBottom) {
      hidden++;
    }
  });

  setHiddenCount(hidden);
}, [tags, isExpanded, isMobile, collapsedHeight]);
```

### Step 4: Conditional Layout Classes

```tsx
// Collapsed: constrained height with overflow hidden
// Expanded: auto height showing all content

<div
  ref={containerRef}
  className="relative"
  style={{
    maxHeight: isExpanded ? '400px' : `${collapsedHeight}px`,
    transition: 'max-height 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
    overflow: 'hidden',
  }}
>
  <div
    ref={contentRef}
    className="
      px-4 sm:px-12
      py-2 sm:py-3
      flex flex-wrap
      items-start
      gap-2 sm:gap-3
    "
  >
    {/* All Notes pill */}
    {/* Tag pills with data-tag-pill attribute */}
    {/* Add tag button */}
    {/* Expand/collapse button */}
  </div>
</div>
```

### Step 5: Expand/Collapse Toggle Button

```tsx
// Shows on both mobile and desktop when tags overflow
{!isExpanded && hiddenCount > 0 && (
  <button
    onClick={() => setIsExpanded(true)}
    className="
      px-2 py-1 sm:px-3 sm:py-1.5
      flex items-center gap-1
      text-xs sm:text-sm font-medium
      shrink-0
      transition-all duration-200
      hover:border-[var(--color-accent)]
    "
    style={{
      fontFamily: 'var(--font-body)',
      color: 'var(--color-text-tertiary)',
      background: 'var(--color-bg-secondary)',
      borderRadius: '2px 8px 4px 8px',
      border: '1px solid var(--glass-border)',
    }}
    aria-expanded="false"
    aria-label={`Show ${hiddenCount} more tags`}
  >
    +{hiddenCount}
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </button>
)}

{/* Collapse button when expanded */}
{isExpanded && (
  <button
    onClick={() => setIsExpanded(false)}
    className="
      px-2 py-1 sm:px-3 sm:py-1.5
      flex items-center gap-1
      text-xs sm:text-sm font-medium
      shrink-0
      transition-all duration-200
    "
    style={{
      fontFamily: 'var(--font-body)',
      color: 'var(--color-accent)',
      background: 'var(--color-accent-glow)',
      borderRadius: '2px 8px 4px 8px',
      border: '1px solid var(--color-accent)',
    }}
    aria-expanded="true"
    aria-label="Collapse tags"
  >
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  </button>
)}
```

### Step 6: Remove Horizontal Scroll (No Longer Needed)

The new wrap layout eliminates the need for horizontal scrolling:

```tsx
// REMOVE these from the container:
// - overflow-x-auto
// - scrollbar-width: none
// - Fade indicators (left/right gradients)

// The useScrollFades hook can be removed entirely
```

### Step 7: Collapse on Resize (Desktop → Mobile)

```tsx
// Auto-collapse when transitioning from desktop to mobile
useEffect(() => {
  if (isMobile && isExpanded) {
    // Optionally collapse when going to mobile, or keep expanded
    // setIsExpanded(false);
  }
}, [isMobile]);
```

---

## Visual Design Details

### Expand Button Styling

- **Collapsed state button**: Subtle, uses tertiary text color
- **Expanded state button**: Highlighted with accent color to invite closing
- **Border radius**: Smaller asymmetric corners (2px 8px 4px 8px) to distinguish from tag pills
- **Position**: End of the row, after visible tags

### Animation Choreography

1. User taps "+N" button
2. Container smoothly expands height (300ms ease-out)
3. Hidden tags fade in with slight stagger (50ms delay each)
4. Expand button transforms to collapse button

### Responsive Breakpoints

- **Below 640px (mobile)**: 1 row collapsed, expand button when overflow
- **640px and above (desktop)**: 2 rows collapsed, expand button when overflow
- **Both**: Same expand/collapse interaction, just different row limits

---

## Files to Modify

1. **`src/components/TagFilterBar.tsx`**
   - Add `isExpanded` state
   - Add hidden count calculation
   - Conditional layout classes
   - Expand/collapse toggle button
   - Conditional fade indicators

2. **`src/index.css`** (optional)
   - Add transition classes if not using Tailwind

---

## Accessibility Considerations

- Expand button has `aria-expanded` attribute
- Collapsed tags are still in DOM and focusable (just visually hidden via overflow)
- Keyboard navigation works in both states
- Screen reader announces "+N more tags" button

---

## Testing Checklist

### Mobile Tests
- [ ] iPhone SE (375px) with 5 tags - should show ~3 tags + expand button
- [ ] iPhone SE (375px) with 3 tags - should fit without expand button
- [ ] iPhone 14 (390px) with 10 tags - expand/collapse works
- [ ] Test tag selection in expanded state

### Desktop Tests
- [ ] 1280px with 10 tags - should fit in 2 rows, no expand button
- [ ] 1280px with 20 tags - should show 2 rows + expand button
- [ ] 1280px with 30 tags - verify expand shows all tags
- [ ] Test tag selection in expanded state

### Cross-Platform Tests
- [ ] Resize from desktop to mobile while expanded - behavior correct
- [ ] Resize from mobile to desktop - row count updates
- [ ] Expand/collapse animation smooth (300ms)
- [ ] Hidden count accurate on both platforms

---

## Alternative Considered: Tag Chips Compression

Another approach would be to show only colored dots (no text) for overflow tags:

```
[All Notes] | [Tag 1] [Tag 2] [●] [●] [●] [+]
```

**Rejected because:**
- Loses tag name context
- Users can't select specific tags without expanding anyway
- Adds visual complexity without solving the core issue

---

## Summary

The "Unfolding Scroll" approach:
1. **Unified pattern** - Same interaction on mobile and desktop
2. **Adaptive defaults** - 1 row on mobile, 2 rows on desktop
3. **Clear overflow indicator** - "+N" button shows exactly how many tags are hidden
4. **Smooth expansion** - Organic 300ms animation reveals all tags
5. **Wabi-sabi aesthetic** - Asymmetric corners, warm colors preserved
6. **Replaces horizontal scroll** - Wrap layout is more discoverable than scrolling
7. **Scales gracefully** - Works with 5 tags or 50 tags
