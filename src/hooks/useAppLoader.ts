/**
 * The blocking loader shown while the app boots.
 *
 * Two rules, and both exist because of a flicker. It holds for a minimum duration, so
 * a fast boot does not flash a loader for 40ms; and it holds *only* on the initial
 * cold boot, so post-login note priming keeps the current shell visible instead of
 * dropping the reader back onto a blocking screen they had already left.
 */

import { useEffect, useRef, useState } from 'react';

const APP_LOADER_MIN_MS = 200;

export function useAppLoader(appLoading: boolean): boolean {
  const [showAppLoader, setShowAppLoader] = useState(appLoading);
  const hasCompletedInitialAppLoadRef = useRef(false);
  const appLoaderStartedAtRef = useRef<number | null>(null);
  const appLoaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (appLoading) {
      if (hasCompletedInitialAppLoadRef.current) {
        return;
      }

      if (appLoaderTimerRef.current) {
        clearTimeout(appLoaderTimerRef.current);
        appLoaderTimerRef.current = null;
      }
      if (!showAppLoader) {
        setShowAppLoader(true);
      }
      if (!appLoaderStartedAtRef.current) {
        appLoaderStartedAtRef.current = Date.now();
      }
      return;
    }

    hasCompletedInitialAppLoadRef.current = true;

    if (!showAppLoader) {
      appLoaderStartedAtRef.current = null;
      return;
    }

    const startedAt = appLoaderStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, APP_LOADER_MIN_MS - elapsed);

    if (remaining === 0) {
      appLoaderStartedAtRef.current = null;
      setShowAppLoader(false);
      return;
    }

    if (appLoaderTimerRef.current) {
      clearTimeout(appLoaderTimerRef.current);
    }

    const timeoutId = setTimeout(() => {
      appLoaderTimerRef.current = null;
      appLoaderStartedAtRef.current = null;
      setShowAppLoader(false);
    }, remaining);
    appLoaderTimerRef.current = timeoutId;

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        appLoaderTimerRef.current = null;
      }
    };
  }, [appLoading, showAppLoader]);

  return showAppLoader;
}
