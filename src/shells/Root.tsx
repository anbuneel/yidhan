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
import { readGateInput, shouldStartApp } from '../appGate';
import { LoadingFallback } from '../components/LoadingFallback';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { markAppShellStarted } from './appShellStarted';
import { PublicShell, type AppStart } from './PublicShell';

const AppShell = lazyWithRetry(() => import('./AppShell'));

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

  const startApp = useCallback((next: AppStart) => {
    // Only sign-in and sign-up remount the landing page under the auth modal.
    if (next.authModal) document.documentElement.classList.add(LANDING_HANDOFF_CLASS);
    startTransition(() => {
      // Once started, the app shell owns every route; a second request changes nothing.
      setStart((current) => current ?? next);
    });
  }, []);

  return (
    <Suspense fallback={<LoadingFallback message="Preparing your space..." />}>
      {start ? <AppShell start={start} /> : <PublicShell onStartApp={startApp} />}
    </Suspense>
  );
}
