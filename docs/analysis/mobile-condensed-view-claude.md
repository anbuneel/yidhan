# Mobile Condensed View Design Recommendation

**Version:** 1.0
**Last Updated:** 2026-01-14
**Status:** Living Document
**Author:** Claude (Opus 4.5)
**Consulted:** Frontend Design Skill

---

## Original Prompt

> In the mobile view, should we give a condensed view of the notes, so we can see many right away...like how Apple Notes has?

---

## Executive Summary

**Recommendation: Implement condensed cards (not a list view) for mobile.**

The current masonry grid shows beautiful tall cards (200-300px) that work well on desktop but only display 2-3 notes on mobile. Rather than switching to a flat list view (Apple Notes style), we recommend **condensed cards** (~100px) that preserve Yidhan's wabi-sabi aesthetic while improving information density.

---

## Problem Statement

### Current Mobile Experience

At the 700px breakpoint, the masonry grid becomes a single column of tall cards:

```
┌─────────────────────────────┐
│  ☰  Yidhan          🔍  +  │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │                      📌 │ │
│ │ Project Ideas          │ │
│ │                        │ │
│ │ Meeting notes from     │ │
│ │ today's standup. We    │ │  ~240px
│ │ discussed the new      │ │  per card
│ │ feature rollout...     │ │
│ │                        │ │
│ │ ○ work ○ ideas  3h ago │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │                        │ │
│ │ Evening Reflections    │ │
│ │                        │ │  Only 2-3
│ │ The sunset reminded    │ │  notes visible
│ │ me of that trip...     │ │
│ └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘ │
└─────────────────────────────┘
```

**Issues:**
- Only 2-3 notes visible on screen
- 4-5 screens of scrolling to see 10 notes
- Inefficient for quick note retrieval

---

## Options Considered

### Option A: List View (Apple Notes Style) — REJECTED

```
┌─────────────────────────────┐
│ Project Ideas               │
│   Meeting notes from...     │
│   ○ work            3h ago  │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│ Evening Reflections         │
│   The sunset reminded...    │
│                  Yesterday  │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
└─────────────────────────────┘
```

**Pros:**
- Maximum density (8-12 notes visible)
- Familiar pattern from Apple Notes

**Cons:**
- Loses card aesthetic entirely
- No asymmetric corners, shadows, or glass effects
- Feels like a different app
- Breaks visual brand identity

### Option B: Condensed Cards — RECOMMENDED

```
┌─────────────────────────────┐
│ ┌─────────────────────────┐ │
│ │ Project Ideas       📌 │ │
│ │ Meeting notes from...  │ │  ~100px
│ │ ○ work ○ ideas  3h ago │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Evening Reflections    │ │
│ │ The sunset reminded... │ │  5-6 visible
│ │              Yesterday │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Shopping List          │ │
│ │ Milk, eggs, bread...   │ │
│ │ ○ personal    2 days   │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**Pros:**
- Preserves wabi-sabi card aesthetic
- Keeps asymmetric corners, glass effects, shadows
- Same component, different size
- Swipe gestures work identically
- Consistent brand identity

**Cons:**
- Slightly less dense than pure list (5-6 vs 8-12)
- Less preview content visible

---

## Recommendation: Condensed Cards with View Toggle

### Design Specification

#### Card Dimensions

| Mode | Min Height | Max Height | Padding |
|------|------------|------------|---------|
| Full (current) | 200px | 300px | 24px |
| Condensed | auto | 120px | 12px 16px |

#### Layout Changes in Condensed Mode

| Element | Full Mode | Condensed Mode |
|---------|-----------|----------------|
| Title | Own line, large | Same line as pin, smaller |
| Preview | Multi-line HTML | Single line, truncated |
| Tags | Badge style | Compact inline |
| Pin icon | Top-right corner | Inline with title |
| Accent line | Top border | Hidden |
| Hover lift | -6px translateY | -3px translateY |

#### Visual Elements Preserved

- ✅ Asymmetric border-radius: `2px 24px 4px 24px`
- ✅ Glass background with backdrop blur
- ✅ Card shadows (`--shadow-md`)
- ✅ Glass border
- ✅ Spring animations
- ✅ Swipe gestures (SwipeableNoteCard)

### View Toggle Behavior

```
┌─────────────────────────────┐
│  ☰  Yidhan       ▤  🔍  +  │
│                  ↑          │
│            View toggle      │
└─────────────────────────────┘

▤ = Grid icon (current full cards)
☰ = List icon (condensed cards)
```

**Default Behavior:**
- Mobile (< 700px): Default to **condensed**
- Desktop (≥ 700px): Default to **full**
- User can override either way

**Persistence:**
- Save preference to `localStorage` key: `yidhan-view-mode`
- Values: `'full'` | `'condensed'`

---

## Visual Comparison

### Current Full Cards (Mobile)

```
Notes visible: 2-3
Scroll for 10 notes: 4-5 screens
Preview: Multi-line rich HTML
Visual delight: ★★★★★
Quick scanning: ★★☆☆☆
```

### Proposed Condensed Cards (Mobile)

```
Notes visible: 5-6
Scroll for 10 notes: 1-2 screens
Preview: Single line text
Visual delight: ★★★★☆
Quick scanning: ★★★★☆
```

---

## Implementation Plan

### Phase 1: NoteCard Compact Variant

1. Add `isCompact` prop to `NoteCard` component
2. Adjust styles conditionally:
   - Reduce padding
   - Single-line title with inline pin
   - Truncated single-line preview
   - Compact tag display
   - Reduced hover lift

### Phase 2: View Mode Toggle

1. Add `viewMode` state to `App.tsx`
2. Create `ViewModeToggle` component for header
3. Pass `isCompact` prop through `ChapterSection` to `NoteCard`
4. Persist preference in localStorage

### Phase 3: Smart Defaults

1. Use `useMediaQuery` to detect mobile
2. Apply condensed as default on mobile
3. Allow user override via toggle

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/NoteCard.tsx` | Add `isCompact` prop, conditional styles |
| `src/components/SwipeableNoteCard.tsx` | Pass through `isCompact` prop |
| `src/components/ChapterSection.tsx` | Accept and pass `isCompact` prop |
| `src/components/ChapteredLibrary.tsx` | Accept and pass `isCompact` prop |
| `src/components/Header.tsx` | Add view mode toggle button |
| `src/App.tsx` | Add `viewMode` state, localStorage persistence |
| `src/index.css` | Add `.note-card-compact` styles |

---

## Why Condensed Cards > List View

| Aspect | List View | Condensed Cards |
|--------|-----------|-----------------|
| Brand consistency | ❌ Feels different | ✅ Still "Yidhan" |
| Asymmetric corners | ❌ Lost | ✅ Preserved |
| Glass/shadow effects | ❌ Lost | ✅ Preserved |
| Learning curve | New paradigm | Same UI, smaller |
| Swipe gestures | Works but feels off | Natural on cards |
| Code complexity | New component | Same component |
| Visual delight | ★★★☆☆ | ★★★★☆ |

---

## Success Metrics

After implementation, measure:

1. **Notes visible on mobile** — Target: 5-6 (up from 2-3)
2. **Scrolls to find note** — Target: 50% reduction
3. **User preference distribution** — Track toggle usage
4. **Aesthetic consistency** — Visual review, user feedback

---

## Appendix: Rejected Alternatives

### No Markers (Hollow Diamonds)

Initially proposed hollow diamond markers (◇) for list items. Rejected because:
1. Cards don't need markers — the card itself is the visual container
2. Only pinned notes need an indicator (pin icon)
3. Less visual noise is better

### Pure List View

Rejected in favor of condensed cards because:
1. Loses brand identity
2. Feels like a completely different app
3. Cards are iconic to Yidhan's wabi-sabi aesthetic
