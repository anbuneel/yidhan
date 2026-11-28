/**
 * Sync Status Hook
 *
 * Provides sync state information for UI components.
 * Follows the IndexedDB sync queue through a Dexie liveQuery (writes from this tab
 * and from other tabs), plus visibility and online transitions, instead of polling
 * every 10 seconds.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { liveQuery } from 'dexie';
import { useAuth } from '../contexts/AuthContext';
import { getSyncQueueSnapshot } from '../services/offlineNotes';
import { describeSyncFailure } from '../utils/syncErrorMessages';
import { useNetworkStatus } from './useNetworkStatus';

// On native platforms, assume online (network detection is unreliable in WebViews)
const isNative = Capacitor.isNativePlatform();

/** Show pending indicator only after items have been stuck this long */
const STUCK_THRESHOLD_MS = 30_000;

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
  const mountedRef = useRef(true);
  const requestSeqRef = useRef(0);

  const clearStuckTimer = useCallback(() => {
    if (stuckTimerRef.current !== null) {
      clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = null;
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

  const refreshRef = useRef<() => Promise<void>>(async () => {});

  // Apply one queue snapshot: counts, reason, and the 30s stuck timer.
  const applyCounts = useCallback(
    (counts: { pendingCount: number; blockedCount: number; blockedReason: string | null }) => {
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
        scheduleStuckCheck(() => refreshRef.current());
      } else {
        clearStuckTimer();
      }
    },
    [clearStuckTimer, commitSnapshot, scheduleStuckCheck]
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
      applyCounts(counts);
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  }, [user, clearStuckTimer, commitSnapshot, applyCounts]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearStuckTimer();
    };
  }, [clearStuckTimer]);

  // Live queue snapshot while the tab is visible. Dexie's liveQuery re-runs the snapshot
  // after any write to syncQueue, from this tab or another one (Dexie broadcasts its
  // mutations between tabs), so the indicator never waits on a poll. Hidden tabs drop
  // the subscription; becoming visible subscribes again, which reads the queue at once.
  useEffect(() => {
    if (!user) {
      const timeout = setTimeout(() => {
        void refresh();
      }, 0);
      return () => clearTimeout(timeout);
    }

    const userId = user.id;
    let subscription: { unsubscribe: () => void } | null = null;

    const subscribe = () => {
      if (subscription || isDocumentHidden()) return;
      try {
        subscription = liveQuery(() => getSyncQueueSnapshot(userId)).subscribe({
          next: (counts) => {
            if (!mountedRef.current || isDocumentHidden()) return;
            // Supersede any one-off refresh still in flight with an older reading.
            requestSeqRef.current += 1;
            applyCounts(counts);
          },
          error: (error) => {
            console.error('Failed to get sync status:', error);
          },
        });
      } catch (error) {
        // IndexedDB unavailable in restricted contexts; visibility/online triggers still apply.
        console.error('Failed to get sync status:', error);
      }
    };

    const unsubscribe = () => {
      subscription?.unsubscribe();
      subscription = null;
    };

    const handleVisibilityChange = () => {
      if (isDocumentHidden()) {
        unsubscribe();
        clearStuckTimer();
      } else {
        subscribe();
      }
    };

    subscribe();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribe();
      clearStuckTimer();
    };
  }, [user, refresh, applyCounts, clearStuckTimer]);

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
