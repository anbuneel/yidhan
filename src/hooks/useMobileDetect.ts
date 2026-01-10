import { useState, useEffect } from 'react';

/**
 * Hook to detect if the user is on a mobile/touch device.
 *
 * Uses multiple signals for reliable detection:
 * - Touch capability (primary indicator)
 * - Viewport width (secondary)
 * - Pointer type (CSS media query)
 *
 * Returns true for phones and tablets, false for desktop.
 */
export function useMobileDetect(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;

    // Check for touch capability
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Check viewport width (768px is common tablet/mobile breakpoint)
    const isNarrow = window.innerWidth < 768;

    // Coarse pointer indicates touch (vs fine = mouse)
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

    // Consider mobile if touch capable AND (narrow OR coarse pointer)
    return hasTouch && (isNarrow || hasCoarsePointer);
  });

  useEffect(() => {
    const checkMobile = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isNarrow = window.innerWidth < 768;
      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

      setIsMobile(hasTouch && (isNarrow || hasCoarsePointer));
    };

    // Check on resize (handles orientation changes)
    window.addEventListener('resize', checkMobile);

    // Check on pointer type change (handles laptop with touch screen)
    const mediaQuery = window.matchMedia('(pointer: coarse)');

    // Use addEventListener with fallback to deprecated addListener for older Safari
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', checkMobile);
    } else if (mediaQuery.addListener) {
      // Fallback for older Safari (iOS < 14)
      mediaQuery.addListener(checkMobile);
    }

    return () => {
      window.removeEventListener('resize', checkMobile);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', checkMobile);
      } else if (mediaQuery.removeListener) {
        // Fallback for older Safari
        mediaQuery.removeListener(checkMobile);
      }
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
