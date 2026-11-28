/**
 * Sync Status Hook
 *
 * Provides sync state information for UI components.
 * Reacts to local IndexedDB sync-queue mutations and visibility/online transitions
 * instead of polling every 10 seconds forever.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../contexts/AuthContext';
import { getOfflineDb } from '../lib/offlineDb';
import { getSyncQueueSnapshot } from '../services/offlineNotes';
import { describeSyncFailure } from '../utils/syncErrorMessages';
import { useNetworkStatus } from './useNetworkStatus';

// On native platforms, assume online (network detection is unreliable in WebViews)
const isNative = Capacitor.isNativePlatform();

/** Show pending indicator only after items have been stuck this long */
const STUCK_THRESHOLD_MS = 30_000;
/** Coalesce burst queue writes (e.g. batch sync draining) into one snapshot read */
const QUEUE_REFRESH_DEBOUNCE_MS = 50;

interface SyncSnapshotState {
  pendingCount: number;
  blockedCount: number;
  blockedReason: string | null;
  isStuck: boolean;
}

const EMPTY_SNAPSHOT: SyncSnapshotState = {
  pendingCount: 0,
  blockedCount: 0,
  blockedReason: null,
  isStuck: false,
};

function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden;
}

export interface SyncStatus {
  /** Number of pending operations in the sync queue */
  pendingCount: number;
  /** Number of blocked operations awaiting manual retry */
  blockedCount: number;
  /** Plain-language reason the most recent blocked operation failed */
  blockedReason: string | null;
  /** Whether we're currently online */
  isOnline: boolean;
  /** Whether all changes are synced */
  isSynced: boolean;
  /** Whether pending items have been stuck for 30+ seconds */
  isStuck: boolean;
  /** Last time sync status changed */
  lastChecked: Date | null;
  /** Force a refresh of the sync status */
  refresh: () => Promise<void>;
}

/**
 * Hook to track offline sync status
 * Returns sync state for UI indicators (ink dot, cloud icon, etc.)
 */
export function useSyncStatus(): SyncStatus {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [snapshot, setSnapshot] = useState<SyncSnapshotState>(EMPTY_SNAPSHOT);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const snapshotRef = useRef<SyncSnapshotState>(EMPTY_SNAPSHOT);
  const lastLoggedRawReasonRef = useRef<string | null>(null);
  const pendingSinceRef = useRef<number | null>(null);
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const requestSeqRef = useRef(0);

  const clearStuckTimer = useCallback(() => {
    if (stuckTimerRef.current !== null) {
      clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = null;
    }
  }, []);

  const clearQueueRefreshTimer = useCallback(() => {
    if (queueRefreshTimerRef.current !== null) {
      clearTimeout(queueRefreshTimerRef.current);
      queueRefreshTimerRef.current = null;
    }
  }, []);

  const commitSnapshot = useCallback((next: SyncSnapshotState) => {
    const prev = snapshotRef.current;
    if (
      prev.pendingCount === next.pendingCount &&
      prev.blockedCount === next.blockedCount &&
      prev.blockedReason === next.blockedReason &&
      prev.isStuck === next.isStuck
    ) {
      return;
    }
    snapshotRef.current = next;
    setSnapshot(next);
    setLastChecked(new Date());
  }, []);

  const scheduleStuckCheck = useCallback(
    (refreshFn: () => Promise<void>) => {
      clearStuckTimer();
      if (isDocumentHidden() || pendingSinceRef.current === null) return;
      const elapsed = Date.now() - pendingSinceRef.current;
      const remaining = Math.max(0, STUCK_THRESHOLD_MS - elapsed);
      stuckTimerRef.current = setTimeout(() => {
        stuckTimerRef.current = null;
        if (!mountedRef.current || isDocumentHidden()) return;
        void refreshFn();
      }, remaining);
    },
    [clearStuckTimer]
  );

  const refresh = useCallback(async () => {
    const seq = ++requestSeqRef.current;

    if (!user) {
      clearStuckTimer();
      pendingSinceRef.current = null;
      lastLoggedRawReasonRef.current = null;
      commitSnapshot(EMPTY_SNAPSHOT);
      return;
    }

    try {
      // One pass: a separate count and reason query can disagree when a sync
      // run lands between them, showing a block with no reason for a tick.
      const counts = await getSyncQueueSnapshot(user.id);
      if (!mountedRef.current || seq !== requestSeqRef.current) return;

      // The technical text belongs in the console, not the interface.
      if (counts.blockedReason && counts.blockedReason !== lastLoggedRawReasonRef.current) {
        console.warn('[sync] blocked entry:', counts.blockedReason);
      }
      lastLoggedRawReasonRef.current = counts.blockedReason;

      let nextIsStuck = false;
      if (counts.pendingCount > 0) {
        if (pendingSinceRef.current === null) {
          pendingSinceRef.current = Date.now();
        }
        nextIsStuck = Date.now() - pendingSinceRef.current >= STUCK_THRESHOLD_MS;
      } else {
        pendingSinceRef.current = null;
        clearStuckTimer();
      }

      commitSnapshot({
        pendingCount: counts.pendingCount,
        blockedCount: counts.blockedCount,
        blockedReason: describeSyncFailure(counts.blockedReason),
        isStuck: nextIsStuck,
      });

      if (counts.pendingCount > 0 && !nextIsStuck) {
        scheduleStuckCheck(refresh);
      } else {
        clearStuckTimer();
      }
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  }, [user, clearStuckTimer, commitSnapshot, scheduleStuckCheck]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearStuckTimer();
      clearQueueRefreshTimer();
    };
  }, [clearStuckTimer, clearQueueRefreshTimer]);

  // Initial load, reactive Dexie queue hooks, and visibility pause/resume
  useEffect(() => {
    const scheduleDebouncedRefresh = () => {
      if (isDocumentHidden()) return;
      if (queueRefreshTimerRef.current !== null) return;
      queueRefreshTimerRef.current = setTimeout(() => {
        queueRefreshTimerRef.current = null;
        if (!mountedRef.current || isDocumentHidden()) return;
        void refresh();
      }, QUEUE_REFRESH_DEBOUNCE_MS);
    };

    const initialTimeout = !isDocumentHidden()
      ? setTimeout(() => {
          void refresh();
        }, 0)
      : null;

    const handleVisibilityChange = () => {
      if (isDocumentHidden()) {
        clearStuckTimer();
        clearQueueRefreshTimer();
      } else {
        void refresh();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // Subscribe to Dexie syncQueue mutations so the indicator updates immediately
    // after any write, retry, block, or sync completion without background polling.
    let unsubscribeHooks: (() => void) | null = null;
    if (user) {
      try {
        const db = getOfflineDb(user.id);
        const onTransaction = (tx?: { on?: (event: string, cb: () => void) => void }) => {
          if (tx && typeof tx.on === 'function') {
            tx.on('complete', scheduleDebouncedRefresh);
          } else {
            scheduleDebouncedRefresh();
          }
        };
        const onCreating = (_primKey: number, _obj: unknown, tx: { on?: (event: string, cb: () => void) => void }) => {
          onTransaction(tx);
        };
        const onUpdating = (
          _mods: object,
          _primKey: number,
          _obj: unknown,
          tx: { on?: (event: string, cb: () => void) => void }
        ) => {
          onTransaction(tx);
        };
        const onDeleting = (_primKey: number, _obj: unknown, tx: { on?: (event: string, cb: () => void) => void }) => {
          onTransaction(tx);
        };

        db.syncQueue.hook('creating', onCreating);
        db.syncQueue.hook('updating', onUpdating);
        db.syncQueue.hook('deleting', onDeleting);

        unsubscribeHooks = () => {
          db.syncQueue.hook('creating').unsubscribe(onCreating);
          db.syncQueue.hook('updating').unsubscribe(onUpdating);
          db.syncQueue.hook('deleting').unsubscribe(onDeleting);
        };
      } catch {
        // IndexedDB unavailable in restricted contexts; visibility/online triggers still apply.
      }
    }

    return () => {
      if (initialTimeout !== null) clearTimeout(initialTimeout);
      clearStuckTimer();
      clearQueueRefreshTimer();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      unsubscribeHooks?.();
    };
  }, [user, refresh, clearStuckTimer, clearQueueRefreshTimer]);

  // Refresh when coming back online (if the tab is visible)
  useEffect(() => {
    if (isOnline && !isDocumentHidden()) {
      const timeout = setTimeout(() => {
        void refresh();
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, refresh]);

  // On native, treat as always online (sync will naturally fail if truly offline)
  const effectiveOnline = isNative || isOnline;

  return {
    pendingCount: snapshot.pendingCount,
    blockedCount: snapshot.blockedCount,
    blockedReason: snapshot.blockedReason,
    isOnline: effectiveOnline,
    isSynced: snapshot.pendingCount === 0 && snapshot.blockedCount === 0 && effectiveOnline,
    isStuck: snapshot.isStuck,
    lastChecked,
    refresh,
  };
}
