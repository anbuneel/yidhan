# Mobile Header Layout Fix Plan

## Problem Analysis

The library header on mobile devices (< 640px) has critical layout issues:

1. **Logo Overlap**: The search box is positioned on top of the "Zenote" logo, making only "Zeno" partially visible
2. **Button Collision**: The theme toggle button is hidden behind the new note (+) button
3. **Root Cause**: The three-zone flex layout (`shrink-0 | flex-1 | shrink-0`) doesn't account for minimum widths on very narrow screens, causing the center content to overflow into adjacent zones

### Current Layout Structure

```
HeaderShell: flex h-16 px-4
├── Left Zone (shrink-0): "Zenote" logo
├── Center Zone (flex-1 min-w-0 mx-2): Search bar + New Note button
└── Right Zone (shrink-0): Theme toggle + Avatar
```

The `flex-1` on the center zone combined with the search bar's `max-w-[280px]` still exceeds available space on narrow screens (~375px iPhone).

---

## Design Approach

**Strategy**: Adopt a **two-row header** on mobile that maintains the calm, minimal wabi-sabi aesthetic while ensuring all elements are accessible.

### Mobile Layout (< 640px)

```
Row 1: [Zenote]                    [sun] [AN]
Row 2: [  Search...  ]         [+ New]
```

- Row 1: Logo left, theme toggle + avatar right (standard navigation bar)
- Row 2: Full-width search bar with new note button inline

### Desktop Layout (>= 640px)

Keep existing single-row layout:
```
[Zenote]   [  Search...  ⌘K  ] [+ New Note]   [sun] [AN]
```

---

## Implementation Steps

### Step 1: Update HeaderShell.tsx

Modify the header structure to support conditional two-row layout on mobile:

```tsx
// Current:
<header className="h-16 px-4 md:px-12 flex items-center shrink-0">

// New:
<header className="px-4 md:px-12 shrink-0">
  {/* Row 1: Logo + Right actions (always visible) */}
  <div className="h-16 flex items-center">
    {/* Logo */}
    <div className="shrink-0">...</div>

    {/* Center content - hidden on mobile, visible on desktop */}
    <div className="hidden sm:flex flex-1 justify-center items-center min-w-0 mx-4">
      {center}
    </div>

    {/* Right zone - always visible */}
    <div className="ml-auto flex items-center gap-1 shrink-0">
      {rightActions}
      {/* Theme toggle */}
      {/* Avatar/Sign In */}
    </div>
  </div>

  {/* Row 2: Center content on mobile only */}
  {center && (
    <div className="sm:hidden pb-3">
      {center}
    </div>
  )}
</header>
```

### Step 2: Update Header.tsx (Center Content)

Adjust the search bar and new note button for the mobile row layout:

```tsx
const centerContent = (
  <div className="flex items-center gap-2 w-full">
    {/* Search Bar - full width on mobile */}
    <div className="flex-1 relative transition-all duration-300">
      {/* Search input with responsive max-width */}
      <div className="max-w-none sm:max-w-[420px] mx-auto ...">
        ...
      </div>
    </div>

    {/* New Note Button - always visible */}
    <button className="p-2 sm:px-4 sm:py-2 rounded-full shrink-0 ...">
      <svg ... />
      <span className="hidden sm:inline">New Note</span>
    </button>
  </div>
);
```

### Step 3: Fine-tune Spacing

- Reduce mobile header padding: `px-4` (16px) on mobile
- Add bottom padding to row 2 for visual separation: `pb-3`
- Ensure search bar doesn't have excessive internal padding on mobile

---

## CSS Changes Summary

### HeaderShell.tsx Changes

| Element | Current | New Mobile | New Desktop |
|---------|---------|------------|-------------|
| Header | `h-16 flex` | Multi-row container | Same |
| Row 1 | N/A | `h-16 flex items-center` | `h-16 flex items-center` |
| Center zone | `flex-1 mx-2 md:mx-4` | `hidden sm:flex` | `flex-1 mx-4` |
| Mobile center | N/A | `sm:hidden pb-3` | N/A |

### Header.tsx Changes

| Element | Current | New |
|---------|---------|-----|
| Search container | `max-w-[280px] md:max-w-[420px]` | `max-w-none sm:max-w-[420px]` |
| Search wrapper | `flex-1` | `flex-1` (unchanged) |

---

## Visual Result

### Before (Broken)
```
Mobile:
[Zen[Search overlapping...][+][AN]  <- Elements colliding
```

### After (Fixed)
```
Mobile:
[Zenote]                    [sun] [AN]   <- Row 1: Clean top bar
[    Search...    ] [+]                  <- Row 2: Full search access
```

---

## Testing Checklist

- [ ] Test on iPhone SE (375px width)
- [ ] Test on iPhone 14 (390px width)
- [ ] Test on iPad Mini (768px width)
- [ ] Test on desktop (1280px+ width)
- [ ] Verify search keyboard shortcut (Cmd+K) still works
- [ ] Verify new note button creates note
- [ ] Verify theme toggle switches themes
- [ ] Verify avatar dropdown opens correctly
- [ ] Check smooth transition when resizing browser

---

## Files to Modify

1. `src/components/HeaderShell.tsx` - Main header structure changes
2. `src/components/Header.tsx` - Center content adjustments

---

## Risk Assessment

- **Low Risk**: Changes are purely presentational CSS/layout
- **No Backend Changes**: Database, API, or auth untouched
- **Isolated Scope**: Only affects header components
- **Reversible**: Easy to rollback if issues arise

---

## Alternative Approaches Considered

1. **Collapsible Search**: Show search icon on mobile that expands - Rejected: Adds extra tap, less discoverable
2. **Hamburger Menu**: Hide all actions in menu - Rejected: Doesn't match the calm, immediate-access aesthetic
3. **Reduce All Sizes**: Make everything smaller - Rejected: Hurts accessibility and touch targets

The two-row approach maintains usability while respecting the minimal design philosophy.
