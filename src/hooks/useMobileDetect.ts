import { useState, useEffect } from 'react';

const NARROW_VIEWPORT_QUERY = '(max-width: 767px)';
const COARSE_POINTER_QUERY = '(pointer: coarse)';

function addMediaQueryListener(
  mediaQuery: MediaQueryList,
  listener: () => void
): () => void {
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }
  if (typeof mediaQuery.addListener === 'function') {
    // Fallback for older Safari (iOS < 14)
    mediaQuery.addListener(listener);
    return () => {
      if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(listener);
      }
    };
  }
  return () => {};
}

function detectTouchCapable(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Hook to detect if the user is on a mobile/touch device.
 *
 * Uses multiple signals for reliable detection:
 * - Touch capability (primary indicator)
 * - Viewport width via matchMedia (secondary — avoids resize churn from mobile URL bars)
 * - Pointer type (CSS media query)
 *
 * Returns true for phones and tablets, false for desktop.
 */
export function useMobileDetect(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    const hasTouch = detectTouchCapable();
    const isNarrow = window.matchMedia(NARROW_VIEWPORT_QUERY).matches;
    const hasCoarsePointer = window.matchMedia(COARSE_POINTER_QUERY).matches;

    return hasTouch && (isNarrow || hasCoarsePointer);
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const narrowQuery = window.matchMedia(NARROW_VIEWPORT_QUERY);
    const coarseQuery = window.matchMedia(COARSE_POINTER_QUERY);

    const checkMobile = () => {
      const hasTouch = detectTouchCapable();
      setIsMobile(hasTouch && (narrowQuery.matches || coarseQuery.matches));
    };

    const detachNarrow = addMediaQueryListener(narrowQuery, checkMobile);
    const detachCoarse = addMediaQueryListener(coarseQuery, checkMobile);

    return () => {
      detachNarrow();
      detachCoarse();
    };
  }, []);

  return isMobile;
}

/**
 * Simple check for touch capability (doesn't consider viewport).
 * Useful when you want swipe gestures even on larger touch screens.
 *
 * Note: Touch capability doesn't change during a session, so we only
 * check once on mount (no need for useEffect).
 */
export function useTouchCapable(): boolean {
  // Touch capability is static - check once at initialization
  const [hasTouch] = useState(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  return hasTouch;
}
