# Fix Editor Back Navigation for Long Notes

## Problem

When editing a long note and scrolling to the bottom, users must reach to the top of the screen to tap the logo/breadcrumb to return to the library. This is tedious, especially on mobile where:
- The header is at the top of the viewport (sticky)
- Thumb reach to the top of the screen is awkward when holding phone one-handed
- Users naturally expect navigation options near their current focus area

## Current Navigation Options

| Method | Location | Discoverability |
|--------|----------|-----------------|
| Click "Zenote" logo | Header (top) | Medium |
| Press Escape key | Keyboard | Low (desktop only) |

## Proposed Solution: Dual Approach

### 1. Organic Footer (Primary)

A calm, minimal footer at the natural end of content - like a soft bookmark at the end of a journal page.

**Desktop:**
```
                    ·  ·  ·

            ← Return to notes

              Press Esc to save & exit
```

**Mobile:**
```
                    ·  ·  ·

            ← Return to notes
```
- Keyboard hint hidden (no physical keyboard)
- Touch target: 44px minimum height
- Full-width tap area for easier thumb access

### 2. Whisper Float (Secondary)

A minimal floating button that fades in after scrolling past the first screen.

**Desktop:**
- Position: Bottom-left corner
- Size: Compact pill with icon + "Back" text
- Appears after scrolling 400px

**Mobile:**
- Position: Bottom-right corner (thumb-friendly for right-handed users)
- Size: Larger touch target (48x48px)
- Icon only (no text) to save space
- Appears after scrolling 300px (sooner, since mobile screens are shorter)
- Semi-transparent background to not obscure content

## Implementation

### Organic Footer

Add to `Editor.tsx` after the RichTextEditor, inside the content container:

```tsx
{/* Organic Footer - appears at natural end of content */}
<footer
  className="mt-16 mb-8 flex flex-col items-center gap-4"
  style={{ color: 'var(--color-text-tertiary)' }}
>
  {/* Decorative dots - like end of a letter */}
  <div className="flex gap-2 opacity-40">
    <span className="w-1 h-1 rounded-full bg-current" />
    <span className="w-1 h-1 rounded-full bg-current" />
    <span className="w-1 h-1 rounded-full bg-current" />
  </div>

  {/* Return link - larger touch target on mobile */}
  <button
    onClick={handleLogoClick}
    className="
      flex items-center gap-2
      px-4 py-3
      min-h-[44px]
      text-sm
      transition-colors duration-300
      hover:text-[var(--color-accent)]
      active:text-[var(--color-accent)]
    "
    style={{
      fontFamily: 'var(--font-body)',
      color: 'var(--color-text-tertiary)',
    }}
  >
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
      />
    </svg>
    Return to notes
  </button>

  {/* Keyboard hint - desktop only */}
  <span
    className="hidden sm:block text-xs opacity-50"
    style={{ fontFamily: 'var(--font-body)' }}
  >
    Press <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-bg-secondary)]">Esc</kbd> to save & exit
  </span>
</footer>
```

### WhisperBack Component

Create new file `src/components/WhisperBack.tsx`:

```tsx
import { useState, useEffect } from 'react';

interface WhisperBackProps {
  onClick: () => void;
}

export function WhisperBack({ onClick }: WhisperBackProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show earlier on mobile (300px) vs desktop (400px)
      const threshold = window.innerWidth < 640 ? 300 : 400;
      setIsVisible(window.scrollY > threshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <button
      onClick={onClick}
      className={`
        fixed z-20
        transition-all duration-500 ease-out
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--color-accent)]

        /* Desktop: bottom-left, pill shape with text */
        sm:left-6 sm:bottom-6
        sm:flex sm:items-center sm:gap-2
        sm:px-3 sm:py-2
        sm:rounded-full
        sm:text-xs
        sm:hover:text-[var(--color-accent)]
        sm:hover:bg-[var(--color-bg-secondary)]

        /* Mobile: bottom-right, icon only, larger touch target */
        left-auto right-4 bottom-4
        w-12 h-12 sm:w-auto sm:h-auto
        flex items-center justify-center
        rounded-full sm:rounded-full

        ${isVisible
          ? 'opacity-70 sm:opacity-60 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
        }
      `}
      style={{
        fontFamily: 'var(--font-body)',
        color: 'var(--color-text-tertiary)',
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}
      aria-label="Return to notes"
    >
      <svg
        className="w-4 h-4 sm:w-3.5 sm:h-3.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M10 19l-7-7m0 0l7-7m-7 7h18"
        />
      </svg>
      {/* Text hidden on mobile */}
      <span className="hidden sm:inline">Back</span>
    </button>
  );
}
```

### Editor.tsx Integration

```tsx
import { WhisperBack } from './WhisperBack';

// In the Editor component render, add after main closing tag:
return (
  <div className="min-h-screen flex flex-col" ...>
    {/* Header */}
    <div className="sticky top-0 z-10">
      <HeaderShell ... />
    </div>

    {/* Editor Content */}
    <main className="flex-1">
      <div className="max-w-[800px] mx-auto px-10 pb-40">
        {/* Title, Timestamps, Tags, RichTextEditor */}

        {/* Organic Footer */}
        <footer className="mt-16 mb-8 ...">
          ...
        </footer>
      </div>
    </main>

    {/* Whisper Float - outside main for fixed positioning */}
    <WhisperBack onClick={handleLogoClick} />

    {/* Delete Confirmation Dialog */}
    {showDeleteConfirm && ...}
  </div>
);
```

## Mobile vs Desktop Summary

| Aspect | Desktop | Mobile |
|--------|---------|--------|
| **Organic Footer** | Full with Esc hint | No keyboard hint |
| **Footer touch target** | 44px height | 44px height |
| **Whisper Float position** | Bottom-left | Bottom-right (thumb reach) |
| **Whisper Float size** | Pill with text | 48x48 icon only |
| **Whisper Float threshold** | 400px scroll | 300px scroll |
| **Whisper Float opacity** | 60% | 70% (more visible) |

## Visual Behavior

```
┌─────────────────────────────────────┐
│ Header (sticky)                     │
├─────────────────────────────────────┤
│                                     │
│ Note content...                     │
│                                     │
│ ...scrolling...                     │
│                                     │
│ ...more content...                  │
│                                     │
│               · · ·                 │
│         ← Return to notes           │  ← Organic Footer
│          Press Esc to exit          │
│                                     │
├─────────────────────────────────────┤
│                              [←]    │  ← Whisper Float (mobile, bottom-right)
│ [← Back]                            │  ← Whisper Float (desktop, bottom-left)
└─────────────────────────────────────┘
```

## Files to Create/Modify

1. **Create** `src/components/WhisperBack.tsx` - New floating back button component
2. **Modify** `src/components/Editor.tsx` - Add organic footer + WhisperBack component

## Accessibility

- All buttons have `aria-label` for screen readers
- Touch targets meet 44px minimum (WCAG 2.1)
- Focus states with visible ring
- Keyboard navigation preserved (Escape key still works)
