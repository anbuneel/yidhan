/**
 * Service worker registration and update handling.
 *
 * History worth knowing before changing `registerType` in vite.config.ts:
 * the app previously used `registerType: 'prompt'` while nothing in the app
 * ever sent the SKIP_WAITING message that mode requires. New workers installed,
 * moved to `waiting`, and stayed there — browsers kept serving the precached
 * shell from whenever they first installed, for as long as that lasted. Clients
 * ran months-old code against a migrated database.
 *
 * `autoUpdate` is what rescues those clients: a waiting worker cannot be
 * activated by code the stale client is not running, so the worker has to
 * activate itself. The known cost is that activating mid-session can invalidate
 * the lazy chunk URLs the running page still expects; `lazyWithRetry` and the
 * `unhandledrejection` handler in main.tsx already recover from that with a
 * single cooldown-guarded reload.
 */

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export type UpdateApplier = (reloadPage?: boolean) => Promise<void>;

interface RegisterOptions {
  onNeedRefresh?: () => void;
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  immediate?: boolean;
}

type Registrar = (options: RegisterOptions) => UpdateApplier;

let applyUpdate: UpdateApplier | null = null;
let updateIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Ask the browser to re-check for a new service worker.
 *
 * Browsers only check on navigation by default, and this app is a long-lived
 * single-page session — without a periodic nudge an open tab can miss a deploy
 * for its entire lifetime.
 */
function scheduleUpdateChecks(registration: ServiceWorkerRegistration | undefined): void {
  if (!registration || updateIntervalId !== null) return;

  const checkForUpdate = () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    void registration.update().catch(() => {
      // A failed check is not actionable — the next one will retry.
    });
  };

  updateIntervalId = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });
  }
}

/**
 * Register the service worker and start update checks.
 *
 * `registrar` is injectable so tests can exercise this without the
 * `virtual:pwa-register` module, which only exists under a Vite build.
 */
export async function registerServiceWorker(
  options: { onNeedRefresh?: () => void; registrar?: Registrar } = {}
): Promise<boolean> {
  if (applyUpdate) return true;

  let registrar = options.registrar;

  if (!registrar) {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
    try {
      ({ registerSW: registrar } = await import('virtual:pwa-register'));
    } catch {
      // No service worker in this build (dev server, tests) — nothing to do.
      return false;
    }
  }

  applyUpdate = registrar({
    immediate: true,
    onNeedRefresh: options.onNeedRefresh,
    onRegisteredSW: (_swUrl, registration) => scheduleUpdateChecks(registration),
  });

  return true;
}

/**
 * Hand control to a waiting worker without reloading.
 *
 * Returns whether an applier was available. The caller owns the reload so the
 * cooldown in `reloadForUpdatedApp` stays the single gate on reload loops.
 */
export async function activateWaitingUpdate(): Promise<boolean> {
  if (!applyUpdate) return false;

  try {
    await applyUpdate(false);
    return true;
  } catch {
    return false;
  }
}

/** Test seam — drops the registration so each test starts clean. */
export function resetServiceWorkerRegistrationForTests(): void {
  applyUpdate = null;
  if (updateIntervalId !== null) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }
}
