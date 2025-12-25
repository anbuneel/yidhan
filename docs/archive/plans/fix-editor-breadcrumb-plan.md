# Fix Editor Breadcrumb Design

## Problem

After introducing HeaderShell for consistent header layout, the Editor's breadcrumb (`/ Note Title`) appears disconnected from the "Zenote" logo because they are in separate layout zones:

```
[Zenote]        [    / Note Title  [Saving...]    ]        [trash] | [theme] [avatar]
   ^                      ^                                      ^
 Left Zone          Center Zone                            Right Zone
(fixed)             (centered)                             (fixed)
```

This breaks the visual navigation path metaphor - breadcrumbs should feel like a continuous path from the logo.

## Solution: Integrated Left Zone

Add a `leftContent` prop to HeaderShell that allows pages to override the default logo with custom content. The Editor uses this to render logo + breadcrumb as a single, adjacent unit.

### New Layout

**Desktop (>=640px):**
```
[Zenote / Note Title]                         [Saving...] [trash] | [theme] [avatar]
        ^                                           ^                    ^
   Left Zone                                  Right Zone            Right Zone
(logo + breadcrumb)                       (save + delete)        (theme + avatar)
```

**Mobile (<640px):**
```
Row 1: [Zenote]                                   [Saving...] [trash] [theme] [avatar]
Row 2: [Note Title]
```

## Implementation

### HeaderShell Changes (`src/components/HeaderShell.tsx`)

Added new prop:
```typescript
interface HeaderShellProps {
  // ... existing props
  /** Override left zone with custom content (e.g., logo + breadcrumb) */
  leftContent?: ReactNode;
}
```

Left zone now conditionally renders:
```tsx
<div className="shrink-0 flex items-center min-w-0">
  {leftContent || (
    // Default logo rendering
  )}
</div>
```

### Editor Changes (`src/components/Editor.tsx`)

New `leftContent` prop combines logo and breadcrumb:
```tsx
const leftContent = (
  <div className="flex items-center min-w-0">
    {/* Clickable Logo */}
    <button onClick={handleLogoClick}>Zenote</button>

    {/* Separator - desktop only */}
    <span className="hidden sm:inline mx-3">/</span>

    {/* Note Title - desktop only */}
    <span className="hidden sm:inline truncate max-w-[300px]">
      {title || 'Untitled'}
    </span>
  </div>
);
```

Center content now shows:
- Mobile: Note title (since it's hidden in left zone)
- Both: Save status indicator

```tsx
<HeaderShell
  leftContent={leftContent}
  center={centerContent}
  rightActions={deleteButton}
  // ...
/>
```

## Visual Changes

| Aspect | Before | After |
|--------|--------|-------|
| Logo & breadcrumb | Separated by layout zones | Adjacent in same zone |
| Separator "/" | Floating in center | Directly after "Zenote" |
| Note title | Centered on screen | Flows from logo |
| Save indicator | Attached to title in center | Right zone, before delete button |
| Mobile title | Row 2, disconnected | Row 2, standalone |

## Files Changed

1. `src/components/HeaderShell.tsx` - Added `leftContent` prop
2. `src/components/Editor.tsx` - Uses `leftContent` for integrated breadcrumb
