import { startTransition as scheduleTransition, useCallback } from 'react';

/**
 * Hook to schedule non-urgent view changes using React's concurrent transition
 * scheduler. CSS transitions provide the visual motion.
 *
 * Note: Previously used `document.startViewTransition` + `flushSync`, but
 * `flushSync` is an anti-pattern in concurrent React. The View Transitions API
 * integration was removed to align with React 19 concurrent rendering.
 */
export function useViewTransition() {
  /**
   * Wraps a callback in React's transition scheduler.
   */
  const startTransition = useCallback((callback: () => void) => {
    scheduleTransition(callback);
  }, []);

  return { startTransition };
}
