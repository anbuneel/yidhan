import { useEffect, useRef, useCallback } from 'react';

export interface UseIdleTimerOptions {
  /** Minutes of inactivity before onIdle fires (0 = disabled) */
  minutes: number;
  /** Callback when idle timeout is reached */
  onIdle: () => void;
  /** Whether the timer is active */
  enabled: boolean;
}

/**
 * Simple idle timer that fires onIdle after N minutes of inactivity.
 * Tracks mousedown, keydown, touchstart, and scroll events.
 *
 * Separate from useSessionTimeout to avoid regression risk on the
 * existing session warning/sign-out flow.
 */
export function useIdleTimer({ minutes, onIdle, enabled }: UseIdleTimerOptions): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (!enabled || minutes <= 0) return;

    timerRef.current = setTimeout(() => {
      onIdleRef.current();
    }, minutes * 60 * 1000);
  }, [enabled, minutes]);

  useEffect(() => {
    if (!enabled || minutes <= 0) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart'] as const;

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });
    window.addEventListener('scroll', resetTimer, { passive: true, capture: true });

    // Start the initial timer
    resetTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
      window.removeEventListener('scroll', resetTimer, { capture: true });
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [enabled, minutes, resetTimer]);
}
