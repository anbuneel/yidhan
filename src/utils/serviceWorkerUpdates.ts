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

/**
 * Runtime caches from when fonts were fetched from Google Fonts. Fonts are
 * self-hosted and precached now, so no worker reads these; Workbox only cleans
 * up old precaches, not retired runtime caches, so the page drops them.
 */
const LEGACY_RUNTIME_CACHES = ['google-fonts-cache', 'gstatic-fonts-cache'];

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
 * Resolve once the window `load` event has fired.
 *
 * The precache is for the next visit. Registering earlier made the worker fetch
 * about 1 MB of precache while the landing page was still loading its own images
 * and fonts (item 61, step 6).
 */
function whenPageLoaded(): Promise<void> {
  if (typeof document === 'undefined' || document.readyState === 'complete') {
    return Promise.resolve();
  }
  // One task past `load`, so the registration chunk is not fetched from inside the
  // load handlers and counted against the page.
  return new Promise((resolve) => {
    window.addEventListener('load', () => setTimeout(resolve, 0), { once: true });
  });
}

let pendingRegistration: Promise<boolean> | null = null;

/**
 * Register the service worker after the page has loaded, and start update checks.
 *
 * Only the timing is deferred. `registerType` stays `'autoUpdate'` and registration
 * stays explicit here, so a waiting worker still activates itself. `immediate: true`
 * is kept: by the time it is passed the page has loaded, so it only stops Workbox
 * from waiting for a second `load` that has already happened.
 *
 * `registrar` is injectable so tests can exercise this without the
 * `virtual:pwa-register` module, which only exists under a Vite build.
 */
export function registerServiceWorker(
  options: { onNeedRefresh?: () => void; registrar?: Registrar } = {}
): Promise<boolean> {
  if (applyUpdate) return Promise.resolve(true);
  // A second call while the first waits for `load` must not register twice.
  if (pendingRegistration) return pendingRegistration;

  pendingRegistration = (async () => {
    try {
      let registrar = options.registrar;

      if (!registrar) {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
      }

      // Waits before the import too, so `workbox-window` stays off the
      // before-load path.
      await whenPageLoaded();

      if (!registrar) {
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
    } finally {
      pendingRegistration = null;
    }
  })();

  return pendingRegistration;
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

/**
 * Delete runtime caches the app no longer uses.
 *
 * Returns the names that were actually present and removed. Safe to call on
 * every load: deleting a cache that does not exist is a cheap no-op.
 */
export async function removeLegacyRuntimeCaches(): Promise<string[]> {
  if (typeof caches === 'undefined') return [];

  const removed = await Promise.all(
    LEGACY_RUNTIME_CACHES.map(async (name) => {
      try {
        return (await caches.delete(name)) ? name : null;
      } catch {
        return null;
      }
    })
  );

  return removed.filter((name): name is string => name !== null);
}

/** Test seam — drops the registration so each test starts clean. */
export function resetServiceWorkerRegistrationForTests(): void {
  applyUpdate = null;
  pendingRegistration = null;
  if (updateIntervalId !== null) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }
}
