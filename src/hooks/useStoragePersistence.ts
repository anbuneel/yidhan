import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  ensurePersistentStorage,
  getStoragePersistenceSnapshot,
  subscribeToStoragePersistence,
  type PersistenceState,
  type StoragePersistenceSnapshot,
} from '../utils/storagePersistence';

export interface StoragePersistence extends StoragePersistenceSnapshot {
  /**
   * True only when the browser has said no. `unknown` and `unsupported` are
   * not treated as at-risk: the first is transient, and the second is a
   * browser without the API rather than one that has declined.
   */
  isDenied: boolean;
  /** Ask again — useful after the user has done something that changes eligibility. */
  request: () => Promise<PersistenceState>;
}

let launchRequested = false;
let installListenerBound = false;

const serverSnapshot: StoragePersistenceSnapshot = {
  state: 'unknown',
  usageBytes: null,
  quotaBytes: null,
};

/**
 * Subscribe to persistent-storage state, requesting it on first use.
 *
 * Singleton behind the scenes: many components can mount this, one request
 * goes out per launch, and one `appinstalled` listener re-requests, since an
 * installed app is exactly the case Chrome grants without asking.
 */
export function useStoragePersistence(): StoragePersistence {
  const snapshot = useSyncExternalStore(
    subscribeToStoragePersistence,
    getStoragePersistenceSnapshot,
    () => serverSnapshot
  );

  useEffect(() => {
    if (!launchRequested) {
      launchRequested = true;
      void ensurePersistentStorage('launch');
    }

    if (!installListenerBound && typeof window !== 'undefined') {
      installListenerBound = true;
      window.addEventListener('appinstalled', () => {
        void ensurePersistentStorage('installed');
      });
    }
  }, []);

  const request = useCallback(() => ensurePersistentStorage('manual'), []);

  return {
    ...snapshot,
    isDenied: snapshot.state === 'denied',
    request,
  };
}

/** Test seam — lets each test start with a fresh launch. */
export function resetStoragePersistenceHookForTests(): void {
  launchRequested = false;
  installListenerBound = false;
}
