/**
 * The blocking loader shown while the app boots (shell-size plan C7).
 *
 * A fast boot shows no loader. For the first APP_LOADER_DELAY_MS the screen is blank
 * in the theme's background; if boot finishes inside that window, the destination
 * paints straight away. Past it, the loader shows until boot finishes, with no
 * minimum hold. The old rule held the loader for at least 200 ms, which made every
 * fast boot wait.
 *
 * The delay is counted once per page load, from the first boot screen that renders:
 * Root's Suspense fallback while the app shell chunk loads, then App's own gate. So a
 * slow chunk followed by a slow notes load does not wait the delay twice.
 *
 * The loader shows only on the initial cold boot. Once that boot finishes, later
 * loads (post-login note priming, a sign-in after sign-out, a remount of App) keep
 * the current screen instead of dropping the reader onto a blocking screen they had
 * already left.
 */

import { useEffect, useState } from 'react';

export const APP_LOADER_DELAY_MS = 150;

let bootClockStartedAt: number | null = null;
let initialBootCompleted = false;

function msUntilLoaderShows(): number {
  if (bootClockStartedAt === null) bootClockStartedAt = Date.now();
  return Math.max(0, APP_LOADER_DELAY_MS - (Date.now() - bootClockStartedAt));
}

/** Test hook: a fresh page load. */
export function resetAppBootForTests(): void {
  bootClockStartedAt = null;
  initialBootCompleted = false;
}

/**
 * True once the boot delay has passed while `active` stays true. The timer is cleared
 * when `active` turns false and on unmount.
 */
export function useBootDelayElapsed(active: boolean): boolean {
  const [elapsed, setElapsed] = useState(() => active && msUntilLoaderShows() === 0);

  useEffect(() => {
    if (!active) return;
    const remaining = msUntilLoaderShows();
    if (remaining === 0) {
      setElapsed(true);
      return;
    }
    const timeoutId = setTimeout(() => setElapsed(true), remaining);
    return () => clearTimeout(timeoutId);
  }, [active]);

  return active && elapsed;
}

/**
 * - `waiting`: booting, inside the delay. Render a blank screen.
 * - `loader`: booting, past the delay. Render the loader.
 * - `done`: the initial boot has finished, now or earlier in this page load.
 */
export type AppBootPhase = 'waiting' | 'loader' | 'done';

export function useAppBoot(appLoading: boolean): AppBootPhase {
  const booting = appLoading && !initialBootCompleted;
  const delayElapsed = useBootDelayElapsed(booting);

  useEffect(() => {
    if (!appLoading) initialBootCompleted = true;
  }, [appLoading]);

  if (!booting) return 'done';
  return delayElapsed ? 'loader' : 'waiting';
}

/**
 * What App renders before anything else, given the boot phase. `null` means go on to
 * the entry screens and the account gate.
 *
 * `authLoading` blocks on its own, even in the `done` phase: `user` is null until auth
 * resolves, and renderEntryScreen reads a null user as signed out and paints the
 * landing page. The public shell's handoff is the one exception, because that visitor
 * has no session and was already looking at the landing page.
 */
export function appBootScreen(
  phase: AppBootPhase,
  { authLoading, fromPublicShell }: { authLoading: boolean; fromPublicShell: boolean },
): 'loader' | 'blank' | null {
  if (phase === 'loader') return 'loader';
  if (phase === 'waiting') return 'blank';
  if (authLoading && !fromPublicShell) return 'blank';
  return null;
}
