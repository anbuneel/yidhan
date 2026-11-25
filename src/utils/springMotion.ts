import { useEffect, useState } from 'react';
import { Globals } from '@react-spring/web';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Read the current OS/browser reduced-motion preference safely. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Sync react-spring's global `skipAnimation` flag with `prefers-reduced-motion: reduce`.
 * Returns an unsubscribe function that detaches the media query listener.
 */
export function syncSpringReducedMotion(
  onChange?: (reduced: boolean) => void
): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    Globals.assign({ skipAnimation: false });
    return () => {};
  }

  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  const apply = (matches: boolean) => {
    Globals.assign({ skipAnimation: matches });
    onChange?.(matches);
  };

  apply(mql.matches);

  const handleChange = (event: MediaQueryListEvent) => {
    apply(event.matches);
  };

  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }

  // Fallback for older WebKit implementations
  mql.addListener(handleChange);
  return () => mql.removeListener(handleChange);
}

/**
 * Keep react-spring animations disabled whenever `prefers-reduced-motion: reduce` is active,
 * including live OS setting toggles. Only imported by components that already use react-spring,
 * so the landing-page public shell never pulls react-spring into its first-visit bundle.
 */
export function useSpringReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    const initial = prefersReducedMotion();
    Globals.assign({ skipAnimation: initial });
    return initial;
  });

  useEffect(() => {
    return syncSpringReducedMotion((matches) => {
      setReduced(matches);
    });
  }, []);

  return reduced;
}
