import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to track virtual keyboard height using the Visual Viewport API.
 *
 * On mobile devices, when the virtual keyboard appears, it reduces the
 * visible viewport height. This hook:
 * 1. Detects keyboard open/close by comparing visualViewport to window height
 * 2. Updates a CSS variable (--keyboard-height) for use in stylesheets
 * 3. Returns the current keyboard height for use in components
 *
 * Browser support:
 * - Safari iOS: Yes (iOS 13+)
 * - Chrome Android: Yes
 * - Chrome/Firefox desktop: Yes (but keyboard height is 0)
 *
 * @returns {number} Current keyboard height in pixels (0 when closed)
 */
export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const updateKeyboardHeight = useCallback(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    // Calculate keyboard height as difference between window and viewport
    // On iOS, window.innerHeight stays constant while visualViewport.height shrinks
    const height = Math.max(0, window.innerHeight - viewport.height);

    // Only update if significantly changed (>10px avoids micro-fluctuations
    // from address bar hide/show which can cause jitter)
    setKeyboardHeight((prev) => {
      if (Math.abs(prev - height) > 10) {
        // Update CSS variables for stylesheet access
        document.documentElement.style.setProperty(
          '--keyboard-height',
          `${height}px`
        );
        // 50px threshold: address bar changes are ~40-50px, keyboards are 250-350px
        document.documentElement.style.setProperty(
          '--keyboard-visible',
          height > 50 ? '1' : '0'
        );
        return height;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      // Fallback for browsers without Visual Viewport API
      return;
    }

    // Initial check - deferred to avoid synchronous setState in effect
    // The first resize/scroll event will also trigger an update
    const timeoutId = setTimeout(updateKeyboardHeight, 0);

    // Listen for viewport changes (keyboard open/close, resize)
    viewport.addEventListener('resize', updateKeyboardHeight);
    viewport.addEventListener('scroll', updateKeyboardHeight);

    // Also listen on window for orientation changes
    window.addEventListener('resize', updateKeyboardHeight);

    return () => {
      clearTimeout(timeoutId);
      viewport.removeEventListener('resize', updateKeyboardHeight);
      viewport.removeEventListener('scroll', updateKeyboardHeight);
      window.removeEventListener('resize', updateKeyboardHeight);

      // Reset CSS variables on unmount
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      document.documentElement.style.setProperty('--keyboard-visible', '0');
    };
  }, [updateKeyboardHeight]);

  return keyboardHeight;
}

