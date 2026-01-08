import { useCallback } from 'react';
import { flushSync } from 'react-dom';

/**
 * Hook to wrap state changes in View Transitions API for smooth page transitions.
 * Falls back gracefully to instant transitions in unsupported browsers.
 *
 * Uses flushSync to ensure React synchronously updates the DOM before the
 * transition captures it, preventing stale snapshots.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
 */
export function useViewTransition() {
  /**
   * Wraps a callback in a view transition if the browser supports it.
   * In unsupported browsers (e.g., Firefox), the callback runs immediately.
   */
  const startTransition = useCallback((callback: () => void) => {
    // Check if View Transitions API is supported
    if (!document.startViewTransition) {
      callback();
      return;
    }

    // Start view transition with flushSync to ensure DOM is updated
    // synchronously before the transition captures the new state
    document.startViewTransition(() => {
      flushSync(callback);
    });
  }, []);

  return { startTransition };
}
