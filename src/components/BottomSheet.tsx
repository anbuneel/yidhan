import { useEffect, useState, type ReactNode } from 'react';
import { useDrag } from '@use-gesture/react';
import { useSpring, animated, config } from '@react-spring/web';
import { useMobileDetect } from '../hooks/useMobileDetect';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Title shown in the sheet header */
  title?: string;
  /** Maximum height as percentage of viewport (default: 90) */
  maxHeightPercent?: number;
  /** Whether to show the drag handle (default: true on mobile) */
  showHandle?: boolean;
  /** Additional class names for the content container */
  className?: string;
}

/** Reusable close button for modal headers */
function CloseButton({ onClick }: { onClick: () => void }): ReactNode {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200 touch-press-light"
      style={{ color: 'var(--color-text-secondary)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--color-bg-tertiary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
      aria-label="Close"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

// Drag thresholds for dismiss gesture
// 100px is roughly the height of a navigation bar - feels natural as "intentional drag"
const DISMISS_THRESHOLD = 100;
// 0.5 velocity = fast swipe that should dismiss even with little distance
// This matches iOS behavior where a quick flick dismisses regardless of drag distance
const VELOCITY_THRESHOLD = 0.5;

/**
 * iOS-style bottom sheet modal.
 *
 * On mobile: Slides up from bottom, drag handle to dismiss
 * On desktop: Falls back to centered modal behavior
 *
 * Uses react-spring for physics-based animations matching
 * the swipe gesture feel elsewhere in the app.
 */
export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  maxHeightPercent = 90,
  showHandle = true,
  className = '',
}: BottomSheetProps) {
  const isMobile = useMobileDetect();
  const keyboardHeight = useKeyboardHeight();

  // Track whether component should render (allows animation to complete before unmount)
  const [shouldRender, setShouldRender] = useState(isOpen);

  // Spring for sheet position (0 = fully open, positive = dragging down)
  const [{ y }, api] = useSpring(() => ({
    y: window.innerHeight, // Start off-screen
    config: config.stiff,
  }));

  // Spring for backdrop opacity
  const [{ backdropOpacity }, backdropApi] = useSpring(() => ({
    backdropOpacity: 0,
    config: config.default,
  }));

  // Handle open/close animations
  // Using queueMicrotask to defer setState and avoid synchronous render cascade
  useEffect(() => {
    if (isOpen) {
      // Defer to next microtask to avoid synchronous setState in effect
      queueMicrotask(() => setShouldRender(true));
      api.start({ y: 0 });
      backdropApi.start({ backdropOpacity: 1 });
    } else {
      api.start({
        y: window.innerHeight,
        onRest: () => setShouldRender(false), // Unmount after close animation
      });
      backdropApi.start({ backdropOpacity: 0 });
    }
  }, [isOpen, api, backdropApi]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Drag to dismiss gesture - bound to handle area only
  const bind = useDrag(
    ({ movement: [, my], velocity: [, vy], down, cancel }) => {
      // Only allow dragging down
      if (my < 0) {
        api.start({ y: 0, immediate: true });
        return;
      }

      if (down) {
        // While dragging, follow finger
        api.start({ y: my, immediate: true });
      } else {
        // On release, check if should dismiss
        const shouldDismiss =
          my > DISMISS_THRESHOLD || (vy > VELOCITY_THRESHOLD && my > 30);

        if (shouldDismiss) {
          // Dismiss with velocity
          api.start({
            y: window.innerHeight,
            config: { ...config.stiff, velocity: vy },
          });
          backdropApi.start({ backdropOpacity: 0 });
          // Wait for animation then close
          setTimeout(onClose, 200);
          cancel();
        } else {
          // Snap back
          api.start({ y: 0 });
        }
      }
    },
    {
      from: () => [0, y.get()],
      filterTaps: true,
      bounds: { top: 0 },
      rubberband: true,
      enabled: isMobile,
    }
  );

  // Don't render if closed and animation complete
  if (!shouldRender) {
    return null;
  }

  // Desktop fallback: centered modal
  if (!isMobile) {
    // Gate desktop render on isOpen directly (no animation needed)
    if (!isOpen) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      >
        <div
          className={`
            w-full max-w-md mx-4 max-h-[85vh] overflow-hidden
            rounded-2xl shadow-2xl
            ${className}
          `}
          style={{
            background: 'var(--color-bg-primary)',
            animation: 'modal-enter 0.3s var(--spring-bounce) forwards',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with title and close button */}
          <div
            className="px-6 py-4 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--glass-border)' }}
          >
            {/* Spacer for centering */}
            <div className="w-8" />
            {title && (
              <h2
                className="text-lg font-medium text-center flex-1"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {title}
              </h2>
            )}
            <CloseButton onClick={onClose} />
          </div>
          <div className="overflow-y-auto max-h-[calc(85vh-60px)]">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Mobile: bottom sheet
  return (
    <>
      {/* Backdrop */}
      <animated.div
        className="fixed inset-0 z-50"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          opacity: backdropOpacity,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <animated.div
        className={`
          fixed left-0 right-0 bottom-0 z-50
          rounded-t-3xl shadow-2xl overflow-hidden
          ${className}
        `}
        style={{
          y,
          maxHeight: `${maxHeightPercent}vh`,
          background: 'var(--color-bg-primary)',
          // Safe area padding for iPhone home indicator
          paddingBottom: `calc(env(safe-area-inset-bottom) + ${keyboardHeight}px)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle - ONLY this area captures drag gestures */}
        {showHandle && (
          <div
            {...bind()}
            className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          >
            <div
              className="w-10 h-1 rounded-full"
              style={{ background: 'var(--color-bg-tertiary)' }}
            />
          </div>
        )}

        {/* Header with title and close button - title area is draggable */}
        <div
          className="px-6 pb-3 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--glass-border)' }}
        >
          {/* Spacer for centering */}
          <div className="w-8" />
          {title && (
            <h2
              {...bind()}
              className="text-lg font-medium text-center flex-1 cursor-grab active:cursor-grabbing touch-none"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              {title}
            </h2>
          )}
          <CloseButton onClick={onClose} />
        </div>

        {/* Content - scrollable, NOT draggable */}
        <div
          className="overflow-y-auto touch-pan-y"
          style={{
            maxHeight: `calc(${maxHeightPercent}vh - ${title ? '80px' : '40px'} - env(safe-area-inset-bottom) - ${keyboardHeight}px)`,
          }}
        >
          {children}
        </div>
      </animated.div>
    </>
  );
}
