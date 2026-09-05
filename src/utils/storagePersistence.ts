/**
 * Persistent storage for the offline database.
 *
 * Why this exists: an unsynced note lives only in this browser's IndexedDB
 * until it reaches the server. By default a browser treats that storage as
 * "best effort" and may clear it under disk pressure — silently, with no
 * error, typically across a restart. That is how two notes that had been
 * blocked from syncing for months were lost the moment Chrome restarted.
 *
 * `navigator.storage.persist()` asks the browser to exempt this origin from
 * eviction. Chrome grants it without a prompt when the site is installed as an
 * app, bookmarked, has notification permission, or is used often; otherwise it
 * answers no. So the request is cheap, worth repeating (eligibility changes),
 * and its answer is worth showing: "denied" means unsynced notes are at risk.
 *
 * Framework-free so it can be exercised directly; `useStoragePersistence`
 * subscribes React to it.
 */

import { Capacitor } from '@capacitor/core';
import { addReliabilityBreadcrumb, reportReliabilityIssue } from './reliabilityTelemetry';

export type PersistenceState =
  /** The browser has promised not to evict this origin's storage. */
  | 'granted'
  /** The browser declined; unsynced data is evictable under pressure. */
  | 'denied'
  /** No Storage API here (older browser, non-secure context, some WebViews). */
  | 'unsupported'
  /** Not yet asked. */
  | 'unknown';

export interface StoragePersistenceSnapshot {
  state: PersistenceState;
  /** Bytes in use / available, when the browser reports them. */
  usageBytes: number | null;
  quotaBytes: number | null;
}

type Listener = () => void;

let snapshot: StoragePersistenceSnapshot = { state: 'unknown', usageBytes: null, quotaBytes: null };
let inFlight: Promise<PersistenceState> | null = null;
let deniedReported = false;
const listeners = new Set<Listener>();

function getStorageManager(): StorageManager | null {
  if (typeof navigator === 'undefined') return null;
  const manager = (navigator as Navigator & { storage?: StorageManager }).storage;
  return manager && typeof manager.persist === 'function' ? manager : null;
}

function publish(next: Partial<StoragePersistenceSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

async function readEstimate(manager: StorageManager): Promise<void> {
  if (typeof manager.estimate !== 'function') return;
  try {
    const { usage, quota } = await manager.estimate();
    publish({ usageBytes: usage ?? null, quotaBytes: quota ?? null });
  } catch {
    // Informational only; a failed estimate changes nothing.
  }
}

/**
 * Check, and if necessary request, persistent storage.
 *
 * Idempotent and safe to call on every launch: an already-granted origin
 * returns immediately, and concurrent callers share one request. Returns the
 * resulting state.
 */
export async function ensurePersistentStorage(
  trigger: 'launch' | 'installed' | 'manual' = 'launch'
): Promise<PersistenceState> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    // Native app data is not subject to browser eviction heuristics; reporting
    // it as at-risk would be a false alarm.
    if (Capacitor.isNativePlatform()) {
      publish({ state: 'granted' });
      return 'granted' as const;
    }

    const manager = getStorageManager();
    if (!manager) {
      publish({ state: 'unsupported' });
      addReliabilityBreadcrumb({
        category: 'storage',
        message: 'Persistent storage unsupported',
        data: { trigger },
      });
      return 'unsupported' as const;
    }

    let state: PersistenceState;
    try {
      const already =
        typeof manager.persisted === 'function' ? await manager.persisted() : false;
      state = already || (await manager.persist()) ? 'granted' : 'denied';
    } catch {
      // Treat a throwing API the same as an absent one: we cannot rely on it.
      state = 'unsupported';
    }

    publish({ state });
    void readEstimate(manager);

    addReliabilityBreadcrumb({
      category: 'storage',
      message: `Persistent storage ${state}`,
      level: state === 'denied' ? 'warning' : 'info',
      data: { trigger },
    });

    // Once per session: this is the population whose unsynced notes can be
    // lost, which is the number worth knowing.
    if (state === 'denied' && !deniedReported) {
      deniedReported = true;
      reportReliabilityIssue({
        category: 'storage',
        message: 'Persistent storage denied; unsynced notes are evictable',
        level: 'warning',
        data: { trigger },
      });
    }

    return state;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

export function getStoragePersistenceSnapshot(): StoragePersistenceSnapshot {
  return snapshot;
}

export function subscribeToStoragePersistence(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam — returns the module to its pre-request state. */
export function resetStoragePersistenceForTests(): void {
  snapshot = { state: 'unknown', usageBytes: null, quotaBytes: null };
  inFlight = null;
  deniedReported = false;
  listeners.clear();
}
