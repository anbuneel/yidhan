import { useState, useEffect, useCallback, type ReactNode } from 'react';

const STORAGE_KEY = 'yidhan-gesture-hint-seen';
// Delay before showing hint - allows user to see the library first
// 1 second is long enough to perceive the screen but short enough to catch attention
const ENTRANCE_DELAY = 1000;

interface GestureHintProps {
  /** Whether the hint is allowed to show (e.g., only when notes exist) */
  enabled?: boolean;
}

/** Small arrow icon indicating swipe direction */
function SwipeArrow({ direction }: { direction: 'left' | 'right' }): ReactNode {
  return (
    <svg
      className="w-5 h-5"
      style={{ color: 'var(--color-text-tertiary)' }}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d={
          direction === 'left'
            ? 'M10 19l-7-7m0 0l7-7m-7 7h18'
            : 'M14 5l7 7m0 0l-7 7m7-7H3'
        }
      />
    </svg>
  );
}

interface GestureItemProps {
  direction: 'left' | 'right';
  icon: ReactNode;
  iconColor: string;
  description: string;
}

/** Individual gesture illustration with animated swipe indicator */
function GestureItem({ direction, icon, iconColor, description }: GestureItemProps): ReactNode {
  return (
    <div
      className="flex items-center gap-4 p-4 rounded-xl"
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--glass-border)',
      }}
    >
      <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
        {/* Animated swipe indicator */}
        <div
          className={`absolute w-8 h-8 rounded-lg ${direction === 'left' ? 'animate-swipe-left' : 'animate-swipe-right'}`}
          style={{
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--glass-border)',
          }}
        />
        <div className="w-5 h-5 relative z-10" style={{ color: iconColor }}>
          {icon}
        </div>
      </div>
      <div className="flex-1">
        <p
          className="text-sm font-medium"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-primary)',
          }}
        >
          Swipe {direction}
        </p>
        <p
          className="text-xs"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {description}
        </p>
      </div>
      <SwipeArrow direction={direction} />
    </div>
  );
}

/** Delete icon for swipe left gesture */
const DeleteIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

/** Pin icon for swipe right gesture */
const PinIcon = (
  <svg fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

/**
 * One-time overlay that teaches users about swipe gestures.
 *
 * Shows on first mobile visit to help users discover:
 * - Swipe left to delete
 * - Swipe right to pin/unpin
 *
 * Design philosophy:
 * - Non-intrusive, easy to dismiss
 * - Appears only once, remembers in localStorage
 * - Matches wabi-sabi aesthetic
 * - Uses spring animation for native feel
 */
export function GestureHint({ enabled = true }: GestureHintProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimatedIn, setHasAnimatedIn] = useState(false);

  useEffect(() => {
    // Don't show if disabled or already seen
    if (!enabled) return;

    // Check if already seen (guard against private mode exceptions)
    try {
      const hasSeen = localStorage.getItem(STORAGE_KEY);
      if (hasSeen) return;
    } catch {
      // Storage unavailable - show hint (will dismiss but won't persist)
    }

    // Show after delay
    const timer = setTimeout(() => {
      setIsVisible(true);
      // Trigger animation after state update
      requestAnimationFrame(() => {
        setHasAnimatedIn(true);
      });
    }, ENTRANCE_DELAY);

    return () => clearTimeout(timer);
  }, [enabled]);

  const handleDismiss = useCallback(() => {
    setHasAnimatedIn(false);
    // Wait for exit animation (300ms matches transition duration)
    setTimeout(() => {
      setIsVisible(false);
      // Guard against Safari private mode / quota exceptions
      try {
        localStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        // Storage unavailable (private mode, quota exceeded) - hint will show again next visit
      }
    }, 300);
  }, []);

  // Handle ESC key to dismiss (accessibility)
  useEffect(() => {
    if (!isVisible) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVisible, handleDismiss]);

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center px-6
        transition-opacity duration-300
        ${hasAnimatedIn ? 'opacity-100' : 'opacity-0'}
      `}
      style={{ background: 'rgba(0, 0, 0, 0.6)' }}
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gesture-hint-title"
    >
      <div
        className={`
          max-w-sm w-full p-6 rounded-2xl
          transition-all duration-300
          ${hasAnimatedIn ? 'translate-y-0 scale-100' : 'translate-y-4 scale-95'}
        `}
        style={{
          background: 'var(--color-bg-primary)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          transitionTimingFunction: 'var(--spring-bounce)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h2
          id="gesture-hint-title"
          className="text-lg font-medium mb-4 text-center"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text-primary)',
          }}
        >
          Quick gestures
        </h2>

        {/* Gesture illustrations */}
        <div className="space-y-4 mb-6">
          <GestureItem
            direction="left"
            icon={DeleteIcon}
            iconColor="var(--color-destructive)"
            description="Delete note"
          />
          <GestureItem
            direction="right"
            icon={PinIcon}
            iconColor="var(--color-accent)"
            description="Pin or unpin note"
          />
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="w-full py-3 rounded-xl text-sm font-medium transition-all duration-200 touch-press"
          style={{
            fontFamily: 'var(--font-body)',
            background: 'var(--color-accent)',
            color: 'var(--color-bg-primary)',
          }}
        >
          Got it
        </button>

        {/* Subtle hint about other gestures */}
        <p
          className="mt-4 text-center text-xs"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          Pull down to refresh your notes
        </p>
      </div>
    </div>
  );
}

// To reset the gesture hint for testing, run in browser console:
// localStorage.removeItem('yidhan-gesture-hint-seen')
