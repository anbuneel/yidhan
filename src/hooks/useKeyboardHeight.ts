import { useState, useEffect, useEffectEvent, useRef } from 'react';

/**
 * Tracks the virtual keyboard height using the Visual Viewport API and keeps
 * the --keyboard-height and --keyboard-visible CSS variables in step with it.
 *
 * On mobile, the virtual keyboard shrinks the visible viewport. This tracker:
 * 1. Detects keyboard open/close by comparing visualViewport to window height
 * 2. Updates the CSS variables stylesheets position against
 * 3. Reports the height to a caller that needs the number in render
 *
 * Browser support:
 * - Safari iOS: Yes (iOS 13+)
 * - Chrome Android: Yes
 * - Chrome/Firefox desktop: Yes (but keyboard height is 0)
 *
 * The measurement is held in a ref, not state. Most consumers want only the CSS
 * variable, and storing it in state re-rendered them — and their whole subtree —
 * on every keyboard open and close. `onChange` is how a consumer opts into the
 * re-render; without it nothing above this hook re-renders at all.
 */
function useKeyboardHeightTracker(onChange?: (height: number) => void): void {
  const heightRef = useRef(0);

  const updateKeyboardHeight = useEffectEvent(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    // Keyboard height is the difference between window and viewport. On iOS,
    // window.innerHeight stays constant while visualViewport.height shrinks.
    const height = Math.max(0, window.innerHeight - viewport.height);

    // Ignore anything under 10px: address bar hide/show produces micro-changes
    // that would otherwise jitter the toolbar.
    if (Math.abs(heightRef.current - height) <= 10) return;
    heightRef.current = height;

    document.documentElement.style.setProperty('--keyboard-height', `${height}px`);
    // 50px threshold: address bar changes are ~40-50px, keyboards are 250-350px
    document.documentElement.style.setProperty(
      '--keyboard-visible',
      height > 50 ? '1' : '0'
    );

    onChange?.(height);
  });

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
    viewport.addEventListener('scroll', updateKeyboardHeight, { passive: true });

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
  }, []);
}

/**
 * Keep the keyboard CSS variables current without re-rendering the caller.
 *
 * For consumers that position with `var(--keyboard-height)` in CSS and never
 * read the number in JSX — the editor, whose subtree is the expensive one.
 */
export function useKeyboardHeightCssVariable(): void {
  useKeyboardHeightTracker();
}

/**
 * Current keyboard height in pixels (0 when closed), re-rendering on change.
 *
 * Only for consumers that need the number during render. If you are passing it
 * to CSS, use useKeyboardHeightCssVariable instead — the variable is set either
 * way, and this one costs a render of your whole subtree per keyboard toggle.
 */
export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useKeyboardHeightTracker(setKeyboardHeight);
  return keyboardHeight;
}
