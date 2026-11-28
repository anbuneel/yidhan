/**
 * Chooses the shell for this page load (item 61, step 5). src/appGate.ts decides;
 * this renders the public shell or loads the app shell, and hands over from one to
 * the other without a reload.
 *
 * The handoff runs in a transition under one Suspense boundary that is already
 * showing the public page, so React keeps that page on screen while the app chunk
 * loads instead of flashing the fallback. The app shell is a lazyWithRetry chunk: a
 * mid-session service worker activation can invalidate its URL, and that path
 * recovers it the same way it recovers every other lazy chunk.
 */

import { Suspense, startTransition, useCallback, useEffect, useState } from 'react';
import { isSupabaseSessionKey, readGateInput, shouldStartApp } from '../appGate';
import { Auth, DemoPage, NotFoundPage } from '../components/entryScreenChunks';
import { LoadingFallback } from '../components/LoadingFallback';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { parseRoute } from '../routing/routes';
import { markAppShellStarted } from './appShellStarted';
import { PublicShell, type AppStart } from './PublicShell';

const AppShell = lazyWithRetry(() => import('./AppShell'));

/**
 * Starts the fetch for the signed-out screen the app shell is about to show, beside
 * the app shell's own fetch, so it is there when the shell renders and does not flash
 * a fallback (shell-size plan A2). Signed-in readers never need these chunks.
 */
function preloadEntryScreen(start: AppStart) {
  if (start.authModal || /(^|[#&?])type=recovery(&|$)/.test(window.location.hash)) void Auth.preload();
  const route = parseRoute(window.location.pathname, { allowPlayground: import.meta.env.DEV });
  if (route.name === 'demo') void DemoPage.preload();
  else if (route.name === 'notFound') void NotFoundPage.preload();
}

/** Stops the landing hero replaying its entrance when the app shell remounts it. */
export const LANDING_HANDOFF_CLASS = 'landing-handoff';

export function Root() {
  const [start, setStart] = useState<AppStart | null>(() =>
    shouldStartApp(readGateInput()) ? { fromPublicShell: false } : null
  );

  const started = start !== null;
  useEffect(() => {
    if (started) markAppShellStarted();
  }, [started]);

  // A load that starts in the app shell (a direct visit to /demo, a 404, a recovery
  // link) warms its screen at once. Later starts warm it in startApp.
  const [initialStart] = useState(start);
  useEffect(() => {
    if (initialStart) preloadEntryScreen(initialStart);
  }, [initialStart]);

  const startApp = useCallback((next: AppStart) => {
    // Only sign-in and sign-up remount the landing page under the auth modal.
    if (next.authModal) document.documentElement.classList.add(LANDING_HANDOFF_CLASS);
    preloadEntryScreen(next);
    startTransition(() => {
      // Once started, the app shell owns every route; a second request changes nothing.
      setStart((current) => current ?? next);
    });
  }, []);

  // A sign-in in another tab writes the session to localStorage, which fires `storage`
  // here. Before the split, the always-mounted AuthProvider picked that up; the public
  // shell has no AuthProvider, so it hands over itself and the app reaches the library.
  useEffect(() => {
    if (started) return;
    const onStorage = (event: StorageEvent) => {
      if (event.newValue !== null && isSupabaseSessionKey(event.key)) {
        startApp({ fromPublicShell: true });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [started, startApp]);

  return (
    <Suspense fallback={<LoadingFallback message="Preparing your space..." />}>
      {start ? <AppShell start={start} /> : <PublicShell onStartApp={startApp} />}
    </Suspense>
  );
}
