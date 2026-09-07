/**
 * The router.
 *
 * Owns the History API and the route state, and nothing else. Everything it decides
 * is decided by the pure functions in `routes.ts`; everything it remembers about
 * scrolling lives in `scrollMemory.ts`. What is left here is the wiring: push, pop,
 * replace, and the two moments where a scroll offset is captured or restored.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isSameRoute,
  isScrollRestoringRoute,
  parseRoute,
  routeToPath,
  type Route,
} from './routes';
import { recallScroll, rememberScroll } from './scrollMemory';
import { applyScrollOffset, readScrollOffset } from './scrollRegion';

/**
 * Our slice of `history.state`. Anything else in there belongs to the browser or to
 * a future feature and is preserved on replace.
 */
interface RouterHistoryState {
  yidhanHistoryKey?: number;
}

const HISTORY_KEY_STORAGE = 'yidhan-history-key';

/** Frames to keep retrying a scroll restore while the list is still rendering. */
const SCROLL_RESTORE_MAX_FRAMES = 30;

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * History keys are monotonic within a tab and survive a reload, because the scroll
 * memory they index survives a reload too. Deriving them from `history.length` would
 * not: it is capped, and it counts entries this app never created.
 */
function nextHistoryKey(): number {
  const storage = getSessionStorage();
  if (!storage) return Date.now();

  try {
    const current = Number(storage.getItem(HISTORY_KEY_STORAGE) ?? '0');
    const next = Number.isFinite(current) ? current + 1 : 1;
    storage.setItem(HISTORY_KEY_STORAGE, String(next));
    return next;
  } catch {
    return Date.now();
  }
}

function readHistoryKey(state: unknown): number | null {
  if (!state || typeof state !== 'object') return null;
  const key = (state as RouterHistoryState).yidhanHistoryKey;
  return typeof key === 'number' && Number.isFinite(key) ? key : null;
}

interface NavigateOptions {
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
}

export interface Router {
  route: Route;
  /** Go to a route, pushing a history entry unless `replace` is set. */
  navigate: (route: Route, options?: NavigateOptions) => void;
  /**
   * Rewrite the current entry's address without it counting as navigation.
   * Used when the app corrects a URL it is already showing — a `/n/<deleted>` that
   * resolves to the library, or `/demo` after a sign-in.
   */
  replaceRoute: (route: Route) => void;
}

export interface UseRouterOptions {
  allowPlayground?: boolean;
}

export function useRouter(options: UseRouterOptions = {}): Router {
  const { allowPlayground = false } = options;

  const [route, setRoute] = useState<Route>(() =>
    parseRoute(window.location.pathname, { allowPlayground })
  );

  // The history entry currently on screen. Scroll offsets are filed under it.
  const historyKeyRef = useRef<number>(0);
  const restoreFrameRef = useRef<number | null>(null);
  const routeRef = useRef(route);
  routeRef.current = route;

  const cancelPendingRestore = useCallback(() => {
    if (restoreFrameRef.current !== null) {
      cancelAnimationFrame(restoreFrameRef.current);
      restoreFrameRef.current = null;
    }
  }, []);

  /**
   * Put the region back where it was. The list may still be rendering, so retry for a
   * bounded number of frames rather than settling for a clamped offset.
   */
  const restoreScroll = useCallback(
    (offset: number) => {
      cancelPendingRestore();
      if (offset <= 0) {
        applyScrollOffset(0);
        return;
      }

      let framesLeft = SCROLL_RESTORE_MAX_FRAMES;
      const step = () => {
        restoreFrameRef.current = null;
        if (applyScrollOffset(offset) || framesLeft <= 0) return;
        framesLeft -= 1;
        restoreFrameRef.current = requestAnimationFrame(step);
      };
      restoreFrameRef.current = requestAnimationFrame(step);
    },
    [cancelPendingRestore]
  );

  const captureScroll = useCallback(() => {
    if (!isScrollRestoringRoute(routeRef.current)) return;
    rememberScroll(historyKeyRef.current, readScrollOffset());
  }, []);

  // Stamp the entry the app was opened on, so a first navigation has somewhere to
  // file the offset it captures.
  useEffect(() => {
    const existing = readHistoryKey(window.history.state);
    historyKeyRef.current = existing ?? nextHistoryKey();

    if (existing === null) {
      const state: RouterHistoryState = {
        ...(window.history.state as object | null),
        yidhanHistoryKey: historyKeyRef.current,
      };
      window.history.replaceState(state, '');
    }
  }, []);

  // A reload keeps the entry's key, so the offset filed against it is still ours.
  useEffect(() => {
    const handleBeforeUnload = () => captureScroll();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [captureScroll]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Leaving the current entry: file its offset before the key moves.
      captureScroll();

      const nextRoute = parseRoute(window.location.pathname, { allowPlayground });
      const key = readHistoryKey(event.state);
      historyKeyRef.current = key ?? nextHistoryKey();

      setRoute(nextRoute);

      if (isScrollRestoringRoute(nextRoute)) {
        restoreScroll(recallScroll(historyKeyRef.current) ?? 0);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [allowPlayground, captureScroll, restoreScroll]);

  useEffect(() => cancelPendingRestore, [cancelPendingRestore]);

  const navigate = useCallback(
    (next: Route, navigateOptions: NavigateOptions = {}) => {
      const path = routeToPath(next);

      if (navigateOptions.replace) {
        setRoute((current) => (isSameRoute(current, next) ? current : next));
        const state: RouterHistoryState = {
          ...(window.history.state as object | null),
          yidhanHistoryKey: historyKeyRef.current,
        };
        window.history.replaceState(state, '', path);
        return;
      }

      if (isSameRoute(routeRef.current, next)) return;

      captureScroll();

      historyKeyRef.current = nextHistoryKey();
      window.history.pushState({ yidhanHistoryKey: historyKeyRef.current }, '', path);
      setRoute(next);

      // A forward navigation is a fresh visit, not a return: start at the top.
      cancelPendingRestore();
      applyScrollOffset(0);
    },
    [cancelPendingRestore, captureScroll]
  );

  const replaceRoute = useCallback((next: Route) => navigate(next, { replace: true }), [navigate]);

  return { route, navigate, replaceRoute };
}
