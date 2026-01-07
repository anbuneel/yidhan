/**
 * Sync Engine Hook
 *
 * Integrates the sync engine with React.
 * Triggers sync on reconnect and provides sync state.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNetworkStatus } from './useNetworkStatus';
import {
  fullSync,
  setConflictHandler,
  isSyncInProgress,
  type SyncResult,
  type ConflictInfo,
} from '../services/syncEngine';
import { getPendingSyncCount } from '../services/offlineNotes';

export interface SyncState {
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** Number of pending operations */
  pendingCount: number;
  /** Last sync result */
  lastResult: SyncResult | null;
  /** Last sync timestamp */
  lastSyncAt: Date | null;
  /** Any unresolved conflicts */
  conflicts: ConflictInfo[];
  /** Trigger a manual sync */
  triggerSync: () => Promise<void>;
  /** Remove a conflict after resolution */
  removeConflict: (entityId: string) => void;
}

/**
 * Hook that manages the sync engine lifecycle
 */
export function useSyncEngine(): SyncState {
  const { user, isHydrating } = useAuth();
  const { isOnline, onReconnect } = useNetworkStatus();

  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);

  // Track if we're mounted
  const mountedRef = useRef(true);

  // Sync function
  const doSync = useCallback(async () => {
    if (!user || isHydrating || !isOnline) return;
    if (isSyncInProgress()) return;

    setIsSyncing(true);
    try {
      const result = await fullSync(user.id);
      if (mountedRef.current) {
        setLastResult(result);
        setLastSyncAt(new Date());

        // Refresh pending count
        const count = await getPendingSyncCount(user.id);
        setPendingCount(count);
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [user, isHydrating, isOnline]);

  // Register conflict handler
  useEffect(() => {
    setConflictHandler((conflict) => {
      setConflicts((prev) => [...prev, conflict]);
    });

    return () => {
      setConflictHandler(() => {});
    };
  }, []);

  // Sync on reconnect
  useEffect(() => {
    const cleanup = onReconnect(() => {
      // Small delay to ensure network is stable
      setTimeout(doSync, 1000);
    });

    return cleanup;
  }, [onReconnect, doSync]);

  // Initial sync after hydration
  useEffect(() => {
    if (user && !isHydrating && isOnline) {
      // Delay initial sync slightly
      const timeout = setTimeout(doSync, 2000);
      return () => clearTimeout(timeout);
    }
  }, [user, isHydrating, isOnline, doSync]);

  // Periodic sync every 30 seconds while online
  useEffect(() => {
    if (!user || !isOnline) return;

    const interval = setInterval(() => {
      if (!isSyncInProgress()) {
        doSync();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, isOnline, doSync]);

  // Update pending count periodically
  useEffect(() => {
    if (!user) {
      setPendingCount(0);
      return;
    }

    const updateCount = async () => {
      try {
        const count = await getPendingSyncCount(user.id);
        if (mountedRef.current) {
          setPendingCount(count);
        }
      } catch (error) {
        console.error('Failed to get pending count:', error);
      }
    };

    updateCount();
    const interval = setInterval(updateCount, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Remove a conflict after resolution
  const removeConflict = useCallback((entityId: string) => {
    setConflicts((prev) => prev.filter((c) => c.entityId !== entityId));
  }, []);

  return {
    isSyncing,
    pendingCount,
    lastResult,
    lastSyncAt,
    conflicts,
    triggerSync: doSync,
    removeConflict,
  };
}

/**
 * Resolve a conflict by choosing a version
 */
export async function resolveConflict(
  userId: string,
  conflict: ConflictInfo,
  choice: 'local' | 'server' | 'both'
): Promise<void> {
  const { getOfflineDb } = await import('../lib/offlineDb');
  const { supabase } = await import('../lib/supabase');
  const db = getOfflineDb(userId);

  if (conflict.entityType !== 'note') {
    throw new Error('Only note conflicts are supported');
  }

  const localNote = conflict.localVersion as import('../lib/offlineDb').LocalNote;
  const serverNote = conflict.serverVersion as {
    id: string;
    title: string;
    content: string;
    pinned: boolean;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  };

  switch (choice) {
    case 'local': {
      // Push local version to server
      await supabase
        .from('notes')
        .update({
          title: localNote.title,
          content: localNote.content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', localNote.id);

      // Mark as synced
      await db.notes.update(localNote.id, {
        syncStatus: 'synced',
        lastSyncedAt: Date.now(),
        serverUpdatedAt: Date.now(),
      });
      break;
    }

    case 'server': {
      // Apply server version locally
      await db.notes.update(serverNote.id, {
        title: serverNote.title,
        content: serverNote.content,
        pinned: serverNote.pinned,
        deletedAt: serverNote.deleted_at
          ? new Date(serverNote.deleted_at).getTime()
          : null,
        updatedAt: new Date(serverNote.updated_at).getTime(),
        syncStatus: 'synced',
        lastSyncedAt: Date.now(),
        serverUpdatedAt: new Date(serverNote.updated_at).getTime(),
        localUpdatedAt: new Date(serverNote.updated_at).getTime(),
      });
      break;
    }

    case 'both': {
      // Keep both: update local with server version, create new note with local content
      const newNoteId = crypto.randomUUID();
      const now = Date.now();

      // Create new note with local content
      await db.notes.add({
        id: newNoteId,
        userId,
        title: `${localNote.title} (copy)`,
        content: localNote.content,
        pinned: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        lastSyncedAt: null,
        serverUpdatedAt: null,
        localUpdatedAt: now,
      });

      // Create via server directly if online
      // (queueSyncOperation is internal to offlineNotes, so we sync directly)
      if (navigator.onLine) {
        await supabase.from('notes').insert({
          id: newNoteId,
          user_id: userId,
          title: `${localNote.title} (copy)`,
          content: localNote.content,
          pinned: false,
        });

        await db.notes.update(newNoteId, {
          syncStatus: 'synced',
          lastSyncedAt: now,
          serverUpdatedAt: now,
        });
      }

      // Update original with server version
      await db.notes.update(serverNote.id, {
        title: serverNote.title,
        content: serverNote.content,
        pinned: serverNote.pinned,
        deletedAt: serverNote.deleted_at
          ? new Date(serverNote.deleted_at).getTime()
          : null,
        updatedAt: new Date(serverNote.updated_at).getTime(),
        syncStatus: 'synced',
        lastSyncedAt: now,
        serverUpdatedAt: new Date(serverNote.updated_at).getTime(),
        localUpdatedAt: new Date(serverNote.updated_at).getTime(),
      });
      break;
    }
  }
}
