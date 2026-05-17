import { reloadWithPreservedShareContext } from './shareRoute';

const UPDATE_RELOAD_ATTEMPT_KEY = 'yidhan-update-reload-attempted';
const UPDATE_RELOAD_COOLDOWN_MS = 30_000;

const pendingReload = new Promise<never>(() => {
  // Keep Suspense active until the browser performs the reload.
});

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isChunkLoadError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('Loading CSS chunk') ||
    message.includes("Importing a module script failed") ||
    message.includes('error loading dynamically imported module')
  );
}

export function reloadForUpdatedApp(options?: {
  locationLike?: Pick<Location, 'pathname' | 'hash'>;
  now?: number;
  reload?: () => void;
  storage?: Storage | null;
}): boolean {
  const now = options?.now ?? Date.now();
  const storage = options?.storage ?? getSessionStorage();

  if (storage) {
    try {
      const previousAttempt = storage.getItem(UPDATE_RELOAD_ATTEMPT_KEY);
      const previousTimestamp = previousAttempt ? Number.parseInt(previousAttempt, 10) : Number.NaN;

      if (Number.isFinite(previousTimestamp) && now - previousTimestamp < UPDATE_RELOAD_COOLDOWN_MS) {
        return false;
      }

      storage.setItem(UPDATE_RELOAD_ATTEMPT_KEY, String(now));
    } catch {
      // Storage failures should not prevent recovery from a stale chunk.
    }
  }

  reloadWithPreservedShareContext(options?.locationLike ?? window.location, options?.reload);
  return true;
}

export function waitForUpdateReload(): Promise<never> {
  return pendingReload;
}
