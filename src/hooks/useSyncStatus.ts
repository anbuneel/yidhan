/**
 * Sync Status Hook
 *
 * Provides sync state information for UI components.
 * Tracks pending operations and sync health.
 */

import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../contexts/AuthContext';
import { getPendingSyncCount } from '../services/offlineNotes';
import { useNetworkStatus } from './useNetworkStatus';

// On native platforms, assume online (network detection is unreliable in WebViews)
const isNative = Capacitor.isNativePlatform();

export interface SyncStatus {
  /** Number of pending operations in the sync queue */
  pendingCount: number;
  /** Whether we're currently online */
  isOnline: boolean;
  /** Whether all changes are synced */
  isSynced: boolean;
  /** Last time we checked sync status */
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
  const [pendingCount, setPendingCount] = useState(0);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setPendingCount(0);
      return;
    }

    try {
      const count = await getPendingSyncCount(user.id);
      setPendingCount(count);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  }, [user]);

  // Initial load and periodic refresh
  useEffect(() => {
    // Schedule initial load to avoid synchronous setState in effect
    const timeout = setTimeout(refresh, 0);

    // Refresh every 10 seconds while app is active
    const interval = setInterval(refresh, 10000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [refresh]);

  // Refresh when coming back online
  useEffect(() => {
    if (isOnline) {
      // Schedule to avoid synchronous setState in effect
      const timeout = setTimeout(refresh, 0);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, refresh]);

  // On native, treat as always online (sync will naturally fail if truly offline)
  const effectiveOnline = isNative || isOnline;

  return {
    pendingCount,
    isOnline: effectiveOnline,
    isSynced: pendingCount === 0 && effectiveOnline,
    lastChecked,
    refresh,
  };
}
