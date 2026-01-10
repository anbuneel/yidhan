import { useRef, useCallback, type ReactNode } from 'react';
import { useDrag } from '@use-gesture/react';
import { useSpring, animated, config } from '@react-spring/web';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}

// Pull thresholds
const PULL_THRESHOLD = 80; // Distance to trigger refresh
const MAX_PULL = 120; // Maximum pull distance
const INDICATOR_SIZE = 40;

/**
 * Pull-to-refresh wrapper component with iOS-like behavior.
 *
 * - Pull down from top to trigger refresh
 * - Shows Zenote-branded refresh indicator
 * - Spring physics for native feel
 * - Haptic feedback at threshold
 */
export function PullToRefresh({
  children,
  onRefresh,
  disabled = false,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isRefreshingRef = useRef(false);
  const canPullRef = useRef(false);

  // Spring animation for pull indicator
  const [{ y, opacity, rotate }, api] = useSpring(() => ({
    y: -INDICATOR_SIZE,
    opacity: 0,
    rotate: 0,
    config: config.stiff,
  }));

  // Haptic feedback helper
  const triggerHaptic = useCallback((intensity: 'light' | 'medium' | 'heavy' = 'medium') => {
    if ('vibrate' in navigator) {
      const duration = intensity === 'light' ? 5 : intensity === 'medium' ? 10 : 20;
      navigator.vibrate(duration);
    }
  }, []);

  // Handle refresh action
  const handleRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    triggerHaptic('medium');

    // Show refreshing state
    api.start({
      y: PULL_THRESHOLD / 2,
      opacity: 1,
      rotate: 360,
      config: { duration: 1000 },
      loop: true,
    });

    try {
      await onRefresh();
    } finally {
      // Hide indicator
      api.start({
        y: -INDICATOR_SIZE,
        opacity: 0,
        rotate: 0,
        loop: false,
        config: config.stiff,
        onRest: () => {
          isRefreshingRef.current = false;
        },
      });
    }
  }, [api, onRefresh, triggerHaptic]);

  // Find the actual scrollable element inside the container
  const getScrollTop = useCallback(() => {
    if (!containerRef.current) return 0;

    // Check if the container itself is scrolling
    if (containerRef.current.scrollTop > 0) {
      return containerRef.current.scrollTop;
    }

    // Find the first scrollable child (e.g., <main> with overflow-y-auto)
    const scrollableChild = containerRef.current.querySelector('[class*="overflow"]');
    if (scrollableChild) {
      return scrollableChild.scrollTop;
    }

    // Fallback to document scroll
    return document.documentElement.scrollTop || document.body.scrollTop;
  }, []);

  // Gesture binding
  const bind = useDrag(
    ({ movement: [, my], down, first, memo = { hapticTriggered: false } }) => {
      if (disabled || isRefreshingRef.current) return memo;

      // Check if at top of scroll on first touch
      if (first) {
        const scrollTop = getScrollTop();
        canPullRef.current = scrollTop <= 0;
      }

      // Only allow pull when at top
      if (!canPullRef.current) return memo;

      // Only respond to downward pull
      if (my < 0) {
        api.start({ y: -INDICATOR_SIZE, opacity: 0, rotate: 0, immediate: true });
        return memo;
      }

      // Apply resistance
      const resistance = 0.4;
      const pullDistance = Math.min(my * resistance, MAX_PULL);

      // Haptic feedback at threshold
      if (!memo.hapticTriggered && pullDistance >= PULL_THRESHOLD) {
        triggerHaptic('light');
        memo.hapticTriggered = true;
      }

      // Calculate indicator state
      const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);

      if (down) {
        api.start({
          y: pullDistance - INDICATOR_SIZE / 2,
          opacity: progress,
          rotate: progress * 180,
          immediate: true,
        });
      } else {
        // On release
        if (pullDistance >= PULL_THRESHOLD) {
          handleRefresh();
        } else {
          // Snap back
          api.start({
            y: -INDICATOR_SIZE,
            opacity: 0,
            rotate: 0,
            config: config.stiff,
          });
        }
      }

      return memo;
    },
    {
      axis: 'y',
      filterTaps: true,
      pointer: { touch: true },
    }
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-auto"
      style={{ touchAction: 'pan-y' }}
      {...bind()}
    >
      {/* Pull indicator */}
      <animated.div
        className="absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        style={{
          y,
          opacity,
          width: INDICATOR_SIZE,
          height: INDICATOR_SIZE,
        }}
      >
        <animated.div
          className="w-full h-full rounded-full flex items-center justify-center shadow-lg"
          style={{
            transform: rotate.to((r) => `rotate(${r}deg)`),
            background: 'var(--color-bg-secondary)',
            border: '2px solid var(--color-accent)',
          }}
        >
          {/* Zenote refresh icon */}
          <svg
            className="w-5 h-5"
            style={{ color: 'var(--color-accent)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </animated.div>
      </animated.div>

      {/* Content */}
      {children}
    </div>
  );
}
