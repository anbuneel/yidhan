# Layout Consistency Fix

## Problem
The Changelog and Roadmap pages have inconsistent spacing compared to the Editor page.

## Reference: Editor Page Layout
- Header: h-16 (64px height), px-6 (24px horizontal padding)
- Logo: 1.75rem font size, font-display, -0.5px letter-spacing
- Content: max-w-[800px], mx-auto, px-10 (40px padding)
- Title: 2.75rem font size, font-display, -0.02em letter-spacing

## Changes Needed

### 1. SimpleHeader.tsx

FROM:
```
<header className="px-6 md:px-8 py-5 flex items-center justify-between shrink-0">
```

TO:
```
<header className="h-16 px-6 flex items-center justify-between shrink-0">
```

### 2. ChangelogPage.tsx

MAIN WRAPPER - FROM:
```
<main className="flex-1 px-6 md:px-12 py-4 md:py-6">
  <div className="max-w-2xl mx-auto">
```

TO:
```
<main className="flex-1">
  <div className="max-w-[800px] mx-auto px-10 pb-20">
```

TITLE - FROM:
```
<h1
  className="text-3xl md:text-4xl font-semibold mb-3"
  style={{
    fontFamily: 'var(--font-display)',
    color: 'var(--color-text-primary)',
    letterSpacing: '-0.02em',
  }}
>
```

TO:
```
<h1
  className="font-semibold mb-3"
  style={{
    fontFamily: 'var(--font-display)',
    fontSize: '2.75rem',
    color: 'var(--color-text-primary)',
    letterSpacing: '-0.02em',
  }}
>
```

### 3. RoadmapPage.tsx

Same changes as ChangelogPage (main wrapper and title).

## Summary Table

| Element          | Editor Value      | Current Changelog/Roadmap | Fixed Value       |
|------------------|-------------------|---------------------------|-------------------|
| Header height    | h-16 (64px)       | py-5 (variable)           | h-16 (64px)       |
| Header padding   | px-6              | px-6 md:px-8              | px-6              |
| Content max-w    | 800px             | max-w-2xl (672px)         | 800px             |
| Content padding  | px-10 (40px)      | px-6 md:px-12             | px-10 (40px)      |
| Content top pad  | none              | py-4 md:py-6              | none              |
| Title font-size  | 2.75rem (44px)    | text-3xl/4xl (30-36px)    | 2.75rem (44px)    |

## Result
After these changes:
- Logo will be at exact same position on all pages
- Theme toggle and Sign In will align
- Title will start at same horizontal position
- Title will be same size across all pages
