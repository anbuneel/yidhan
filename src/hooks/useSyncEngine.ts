/**
 * Sync Engine Hook
 *
 * Integrates the sync engine with React.
 * Triggers sync on reconnect and provides sync state.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../contexts/AuthContext';
import { useNetworkStatus } from './useNetworkStatus';
import {
  fullSync,
  setConflictHandler,
  isSyncInProgress,
  clearSyncState,
  type SyncResult,
  type ConflictInfo,
  type FullSyncResult,
  type PullError,
} from '../services/syncEngine';
import { getPendingSyncCount } from '../services/offlineNotes';

// On native platforms, always attempt sync (let API calls fail naturally)
const isNative = Capacitor.isNativePlatform();

export type SyncOutcome = 'ok' | 'partial' | 'offline' | 'error';

export interface TriggerSyncResult {
  outcome: SyncOutcome;
  result?: FullSyncResult;
}

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
  /** Trigger a manual sync, returns outcome */
  triggerSync: () => Promise<TriggerSyncResult>;
  /** Remove a conflict after resolution */
  removeConflict: (entityId: string) => void;
}

/**
 * Map a FullSyncResult to a SyncOutcome.
 *
 * Deterministic mapping based on unique failed entities in data pulls only.
 * Membership-query failures map to 'partial' (not 'error') since they only
 * affect reconciliation, not data freshness.
 *
 * Key: even when both entities report data errors, if partial data was
 * applied (mid-pagination success), we classify as 'partial' not 'error'.
 */
export function mapSyncOutcome(result: FullSyncResult): SyncOutcome {
  const failedDataEntities = new Set(
    result.pullErrors
      .filter((e: PullError) => e.operation === 'data')
      .map((e: PullError) => e.entity)
  );
  const hasMembershipErrors = result.pullErrors.some(
    (e: PullError) => e.operation === 'membership'
  );
  const totalPulled = result.pulled.notes + result.pulled.tags;

  // Both note and tag DATA pulls failed AND zero data was actually applied
  if (failedDataEntities.size === 2 && totalPulled === 0) return 'error';

  // Some failures (data errors with partial data, push failures, or membership issues)
  if (failedDataEntities.size > 0 || result.failed > 0 || hasMembershipErrors) {
    return 'partial';
  }

  return 'ok';
}

/**
 * Hook that manages the sync engine lifecycle
 */
export function useSyncEngine(
  onSyncComplete?: (result: FullSyncResult) => void
): SyncState {
  const { user, isHydrating } = useAuth();
  const { isOnline, onReconnect } = useNetworkStatus();

  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);

  // Track if we're mounted
  const mountedRef = useRef(true);

  // Stable ref for onSyncComplete to avoid re-creating doSync on every render
  const onSyncCompleteRef = useRef(onSyncComplete);
  onSyncCompleteRef.current = onSyncComplete;

  // Re-run latch: when triggerSync is called while a sync is in progress,
  // set this flag. After doSync completes, if the latch is set, run again.
  // Binary (not counter) to avoid runaway re-runs.
  const syncRequestedWhileRunningRef = useRef(false);

  // Track the in-flight sync promise so callers can await it
  const activeSyncPromiseRef = useRef<Promise<TriggerSyncResult> | null>(null);

  // Core sync function — returns TriggerSyncResult
  const doSync = useCallback(async (): Promise<TriggerSyncResult> => {
    // On native platforms, always try to sync (network detection is unreliable)
    // On web, respect the isOnline status
    if (!user || isHydrating || (!isNative && !isOnline)) {
      return { outcome: 'offline' };
    }
    if (isSyncInProgress()) {
      // Signal re-run after current sync completes
      syncRequestedWhileRunningRef.current = true;
      // Await the in-flight sync so callers get the actual result
      // (prevents handleRefresh from showing false "Notes refreshed")
      if (activeSyncPromiseRef.current) {
        return activeSyncPromiseRef.current;
      }
      return { outcome: 'ok' };
    }

    setIsSyncing(true);

    // Store the promise so concurrent callers can await the same sync
    const syncExecution = (async (): Promise<TriggerSyncResult> => {
      try {
        const result = await fullSync(user.id);
        if (mountedRef.current) {
          setLastResult(result);
          setLastSyncAt(new Date());

          // Refresh pending count
          const count = await getPendingSyncCount(user.id);
          setPendingCount(count);

          // Conditional rehydration: only call when sync had meaningful changes
          if (result.processed > 0 || result.conflicts > 0 ||
              result.pulled.notes > 0 || result.pulled.tags > 0 ||
              result.deleted.notes > 0 || result.deleted.tags > 0) {
            onSyncCompleteRef.current?.(result);
          }
        }

        const outcome = mapSyncOutcome(result);
        return { outcome, result };
      } catch (error) {
        console.error('Sync failed:', error);
        return { outcome: 'error' };
      } finally {
        activeSyncPromiseRef.current = null;
        if (mountedRef.current) {
          setIsSyncing(false);
        }

        // Check re-run latch: if sync was requested during this run, run again
        if (syncRequestedWhileRunningRef.current) {
          syncRequestedWhileRunningRef.current = false;
          // Use setTimeout to avoid stack overflow and allow React to update
          setTimeout(() => {
            if (mountedRef.current) {
              doSync();
            }
          }, 100);
        }
      }
    })();

    activeSyncPromiseRef.current = syncExecution;
    return syncExecution;
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
    // On native, always try; on web, respect isOnline
    if (user && !isHydrating && (isNative || isOnline)) {
      // Delay initial sync slightly
      const timeout = setTimeout(doSync, 2000);
      return () => clearTimeout(timeout);
    }
  }, [user, isHydrating, isOnline, doSync]);

  // Periodic sync every 60 seconds while online (or always on native)
  // Relaxed from 30s since saves now trigger immediate sync — interval is a safety net
  useEffect(() => {
    if (!user || (!isNative && !isOnline)) return;

    const interval = setInterval(() => {
      if (!isSyncInProgress()) {
        doSync();
      }
    }, 60000);

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

  // Clear sync state on logout (user → null). The hook lives at the App
  // root which never unmounts, so we react to `user` becoming null instead.
  useEffect(() => {
    if (!user) {
      clearSyncState();
    }
  }, [user]);

  // Track mounted state for safe state updates
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSyncState();
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
 * Resolve a conflict by choosing a version.
 *
 * E2EE-aware: for encrypted notes, pushes encrypted fields (not empty
 * plaintext title/content) and preserves encryption metadata through
 * all resolution paths. The optional `keys` parameter is required for
 * the "both" path on encrypted notes (re-encrypts the copy with a new
 * noteId so AAD is correct).
 */
export async function resolveConflict(
  userId: string,
  conflict: ConflictInfo,
  choice: 'local' | 'server' | 'both',
  keys?: import('../lib/encryption').DerivedKeys
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
    encrypted_payload: string | null;
    encryption_iv: string | null;
    encryption_version: number | null;
    content_hash: string | null;
  };

  const isEncrypted = Boolean(localNote.encryptedPayload);

  switch (choice) {
    case 'local': {
      // Push local version to server (or queue if offline).
      // For encrypted notes, push encrypted fields instead of empty plaintext.
      const { queueSyncOperation } = await import('../services/offlineNotes');

      const pushPayload = isEncrypted
        ? {
            title: '' as string,
            content: '' as string,
            encrypted_payload: localNote.encryptedPayload,
            encryption_iv: localNote.encryptionIv,
            encryption_version: localNote.encryptionVersion,
            content_hash: localNote.contentHash,
          }
        : {
            title: localNote.title,
            content: localNote.content,
          };

      if (navigator.onLine) {
        // Try to push directly when online
        const { data: pushed, error } = await supabase
          .from('notes')
          .update(pushPayload)
          .eq('id', localNote.id)
          .select('updated_at')
          .single();

        if (error) {
          // Queue for retry if server update failed
          await queueSyncOperation(userId, 'update', 'note', localNote.id, pushPayload);
          await db.notes.update(localNote.id, {
            syncStatus: 'pending',
          });
        } else {
          // Mark as synced using server timestamp to avoid clock skew
          const serverTime = new Date(pushed.updated_at).getTime();
          await db.notes.update(localNote.id, {
            syncStatus: 'synced',
            lastSyncedAt: serverTime,
            serverUpdatedAt: serverTime,
          });
        }
      } else {
        // Queue for sync when back online
        await queueSyncOperation(userId, 'update', 'note', localNote.id, pushPayload);
        await db.notes.update(localNote.id, {
          syncStatus: 'pending',
        });
      }
      break;
    }

    case 'server': {
      // Apply server version locally — include encrypted fields from server
      const serverTime = new Date(serverNote.updated_at).getTime();
      await db.notes.update(serverNote.id, {
        title: serverNote.title,
        content: serverNote.content,
        pinned: serverNote.pinned,
        deletedAt: serverNote.deleted_at
          ? new Date(serverNote.deleted_at).getTime()
          : null,
        updatedAt: serverTime,
        syncStatus: 'synced',
        lastSyncedAt: serverTime,
        serverUpdatedAt: serverTime,
        localUpdatedAt: serverTime,
        encryptedPayload: serverNote.encrypted_payload ?? null,
        encryptionIv: serverNote.encryption_iv ?? null,
        encryptionVersion: serverNote.encryption_version ?? null,
        contentHash: serverNote.content_hash ?? null,
      });
      break;
    }

    case 'both': {
      // Keep both: update local with server version, create new note with local content
      const { queueSyncOperation } = await import('../services/offlineNotes');
      const newNoteId = crypto.randomUUID();
      const now = Date.now();

      if (isEncrypted && keys) {
        // Encrypted note: decrypt local content, re-encrypt with new noteId
        // (AAD includes noteId, so a raw copy would fail decryption)
        const { decryptNote, encryptNote } = await import('../lib/encryption');
        const { title, content } = await decryptNote(
          localNote.id, userId,
          { ciphertext: localNote.encryptedPayload!, iv: localNote.encryptionIv! },
          keys.encryptionKey
        );
        const reEncrypted = await encryptNote(
          newNoteId, userId, `${title} (copy)`, content, keys
        );

        await db.notes.add({
          id: newNoteId,
          userId,
          title: '',
          content: '',
          pinned: false,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
          syncStatus: 'pending',
          lastSyncedAt: null,
          serverUpdatedAt: null,
          localUpdatedAt: now,
          encryptedPayload: reEncrypted.ciphertext,
          encryptionIv: reEncrypted.iv,
          encryptionVersion: reEncrypted.version,
          contentHash: reEncrypted.contentHash,
        });

        await queueSyncOperation(userId, 'create', 'note', newNoteId, {
          title: '',
          content: '',
          pinned: false,
          encrypted_payload: reEncrypted.ciphertext,
          encryption_iv: reEncrypted.iv,
          encryption_version: reEncrypted.version,
          content_hash: reEncrypted.contentHash,
        });
      } else {
        // Unencrypted note: copy plaintext directly
        const copyTitle = `${localNote.title} (copy)`;

        await db.notes.add({
          id: newNoteId,
          userId,
          title: copyTitle,
          content: localNote.content,
          pinned: false,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
          syncStatus: 'pending',
          lastSyncedAt: null,
          serverUpdatedAt: null,
          localUpdatedAt: now,
          encryptedPayload: null,
          encryptionIv: null,
          encryptionVersion: null,
          contentHash: null,
        });

        await queueSyncOperation(userId, 'create', 'note', newNoteId, {
          title: copyTitle,
          content: localNote.content,
          pinned: false,
        });
      }

      // Update original with server version (including encrypted fields)
      const serverUpdatedTime = new Date(serverNote.updated_at).getTime();
      await db.notes.update(serverNote.id, {
        title: serverNote.title,
        content: serverNote.content,
        pinned: serverNote.pinned,
        deletedAt: serverNote.deleted_at
          ? new Date(serverNote.deleted_at).getTime()
          : null,
        updatedAt: serverUpdatedTime,
        syncStatus: 'synced',
        lastSyncedAt: serverUpdatedTime,
        serverUpdatedAt: serverUpdatedTime,
        localUpdatedAt: serverUpdatedTime,
        encryptedPayload: serverNote.encrypted_payload ?? null,
        encryptionIv: serverNote.encryption_iv ?? null,
        encryptionVersion: serverNote.encryption_version ?? null,
        contentHash: serverNote.content_hash ?? null,
      });
      break;
    }
  }
}
