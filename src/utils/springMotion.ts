import { useSyncExternalStore } from 'react';
import { Globals } from '@react-spring/web';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type Subscriber = () => void;

const subscribers = new Set<Subscriber>();
let currentReduced = false;
let activeMql: MediaQueryList | null = null;
let detachMqlListener: (() => void) | null = null;

function readReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  return Boolean(mql?.matches);
}

function applyReducedMotion(matches: boolean): void {
  currentReduced = matches;
  Globals.assign({ skipAnimation: matches });
}

function attachSharedListener(): void {
  if (detachMqlListener !== null) return;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    applyReducedMotion(false);
    return;
  }

  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  if (!mql) {
    applyReducedMotion(false);
    return;
  }

  activeMql = mql;
  applyReducedMotion(Boolean(mql.matches));

  const handleChange = (event: MediaQueryListEvent) => {
    applyReducedMotion(Boolean(event.matches));
    subscribers.forEach((notify) => notify());
  };

  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handleChange);
    detachMqlListener = () => {
      mql.removeEventListener('change', handleChange);
    };
  } else if (typeof mql.addListener === 'function') {
    // Fallback for older WebKit implementations
    mql.addListener(handleChange);
    detachMqlListener = () => {
      if (typeof mql.removeListener === 'function') {
        mql.removeListener(handleChange);
      }
    };
  } else {
    detachMqlListener = () => {};
  }
}

function detachSharedListenerIfUnused(): void {
  if (subscribers.size > 0 || detachMqlListener === null) return;
  detachMqlListener();
  detachMqlListener = null;
  activeMql = null;
}

function subscribe(notify: Subscriber): () => void {
  subscribers.add(notify);
  attachSharedListener();
  return () => {
    subscribers.delete(notify);
    detachSharedListenerIfUnused();
  };
}

function getSnapshot(): boolean {
  if (activeMql) {
    const matches = Boolean(activeMql.matches);
    if (matches !== currentReduced || Globals.skipAnimation !== matches) {
      applyReducedMotion(matches);
    }
    return matches;
  }
  const matches = readReducedMotion();
  applyReducedMotion(matches);
  return matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Sync react-spring's global `skipAnimation` flag with `prefers-reduced-motion: reduce`
 * through a single shared media query subscription.
 * Returns an unsubscribe function.
 */
export function syncSpringReducedMotion(
  onChange?: (reduced: boolean) => void
): () => void {
  const notify = () => {
    onChange?.(currentReduced);
  };
  return subscribe(notify);
}

/**
 * Keep react-spring animations disabled whenever `prefers-reduced-motion: reduce` is active,
 * including live OS setting toggles, via one shared `matchMedia` listener across all callers.
 * Only imported by components that already use react-spring, so the landing-page public shell
 * never pulls react-spring into its first-visit bundle.
 */
export function useSpringReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
