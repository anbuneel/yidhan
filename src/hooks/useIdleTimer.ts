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

    const events = ['mousedown', 'keydown', 'touchstart'] as const;

    const handleActivity = () => resetTimer();

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });
    window.addEventListener('scroll', handleActivity, { passive: true, capture: true });

    // Start the timer
    resetTimer();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      window.removeEventListener('scroll', handleActivity, { capture: true });
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [enabled, minutes, resetTimer]);
}
