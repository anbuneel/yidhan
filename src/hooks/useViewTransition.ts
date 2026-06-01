import { startTransition as scheduleTransition, useCallback } from 'react';

/**
 * Hook to schedule non-urgent view changes without forcing synchronous DOM
 * snapshots. CSS transitions still provide the visual motion.
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
