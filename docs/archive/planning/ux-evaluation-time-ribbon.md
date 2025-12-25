# UX Evaluation: Auto-Hiding TimeRibbon

**Date:** 2025-12-21
**Component:** `src/components/TimeRibbon.tsx`
**Context:** Mobile-only bottom navigation for temporal chapter jumping

---

## Current Behavior

- Mobile-only bottom navigation bar for jumping between temporal chapters (Pinned, This Week, Last Week, etc.)
- Auto-hides after 3 seconds of inactivity (opacity drops to 30%, shifts down 2px)
- Reappears on scroll or touch interaction
- Shows dots for each chapter + current chapter label
- Includes haptic feedback on tap

```tsx
// Visibility states
${isVisible ? 'opacity-100 translate-y-0' : 'opacity-30 translate-y-2'}
```

---

## Overall Assessment: Mixed - Good Intent, Some Concerns

The auto-hiding pattern aligns well with the wabi-sabi aesthetic (unobtrusive, calm), but has some UX friction points.

---

## Detailed Evaluation

### 1. Is auto-hiding navigation good UX for this use case?

**Verdict: Conditionally Yes**

**Pros:**
- Maximizes content viewing area on mobile (critical for note-taking)
- Reduces visual clutter - aligns with contemplative aesthetic
- The ribbon is a *secondary* navigation (primary is scrolling), so hiding it is acceptable

**Cons:**
- Users may not discover the feature exists if it hides before they notice it
- Creates cognitive load: "Where did that go? How do I get it back?"
- Violates Nielsen's "Recognition over Recall" heuristic

---

### 2. Is 3 seconds too short/long?

**Verdict: Too Short**

- 3 seconds is aggressive for first-time users who are still orienting
- Research suggests 5-7 seconds for non-critical UI elements
- **Recommendation:** 5 seconds initially, or better: don't auto-hide on first visit (use localStorage to track)

---

### 3. Is 30% opacity when hidden appropriate?

**Verdict: Good Balance**

- 30% is visible enough to remind users it exists
- Subtle enough not to distract from content
- The `translate-y-2` shift adds a nice "resting" state

**However:** Consider making it **0% opacity** (fully hidden) after a longer period (e.g., 10+ seconds of no interaction) for true immersive reading.

---

### 4. Should there be other triggers?

**Verdict: Yes - Missing Key Trigger**

Current triggers: scroll, touchstart

**Missing triggers that would improve UX:**
- **Section boundary crossing** - Show when user scrolls into a new chapter (most important!)
- **Scroll direction change** - Show when scrolling up (common pattern in mobile apps)
- **Scroll velocity** - Show when fast scrolling (user is seeking, not reading)
- **Tap on screen edge** - Allow intentional reveal without scrolling

---

### 5. Alternative Patterns to Consider

| Pattern | Description | Fit for Zenote |
|---------|-------------|----------------|
| **Scroll-direction aware** | Hide on scroll down, show on scroll up | Good |
| **Always visible but minimal** | Thin line with dots, no label until tap | Great for wabi-sabi |
| **Section-triggered toast** | Brief toast showing current section on scroll | Decent |
| **Edge swipe reveal** | Swipe up from bottom edge to reveal | iOS-like but discoverable |
| **Contextual appearance** | Only show when multiple chapters exist | Already implemented! |

---

## Recommended Improvements

### Code Enhancement Example

```tsx
// Enhanced triggers
const handleScroll = () => {
  const currentScrollY = window.scrollY;

  // Show on scroll UP (user seeking)
  if (currentScrollY < lastScrollY) {
    setIsVisible(true);
  }

  // Show on section boundary (most valuable!)
  // This would need integration with IntersectionObserver

  lastScrollY = currentScrollY;
  resetHideTimer();
};

// Longer initial timeout for first-time users
const initialTimeout = hasSeenRibbon ? 3000 : 6000;
```

---

## Summary

| Aspect | Current | Recommendation |
|--------|---------|----------------|
| Auto-hide concept | Good | Keep it |
| Hide timeout | 3s | Increase to 5s |
| Hidden opacity | 30% | Good, or add second tier at 0% |
| Scroll trigger | Basic | Add direction-awareness |
| Section trigger | Missing | **Add IntersectionObserver trigger** |

The auto-hiding behavior is philosophically aligned with Zenote's calm aesthetic, but could be more *intelligent* about when to appear. The most valuable improvement would be showing the ribbon when crossing section boundaries - this is when users most need orientation.

---

## Action Items

- [ ] Increase hide timeout from 3s to 5s
- [ ] Add scroll-direction awareness (show on scroll up)
- [ ] Integrate with existing IntersectionObserver to show on section change
- [ ] Consider localStorage flag for first-time user experience
