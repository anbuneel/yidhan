/**
 * Sync Engine Hook
 *
 * Integrates the sync engine with React.
 * Triggers sync on reconnect and provides sync state.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { MAX_NOTE_TITLE_LENGTH } from '../utils/validation';
import { Capacitor } from '@capacitor/core';
import { addReliabilityBreadcrumb } from '../utils/reliabilityTelemetry';
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
  type NoteConflictServerVersion,
} from '../services/syncEngine';
import { getPendingSyncCount } from '../services/offlineNotes';
import {
  hasEmptyPlaintextColumns,
  hasRequiredCamelEncryptionFields,
  isLaunchEncryptedDbNote,
} from '../utils/noteEncryptionInvariant';
import { withCrossTabSyncLock } from '../services/syncLock';

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

function getDisplayUpdatedAt(
  note: Pick<NoteConflictServerVersion, 'updated_at' | 'display_updated_at'>
): string {
  return note.display_updated_at ?? note.updated_at;
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
  if (failedDataEntities.size > 0 || result.failed > 0 || result.blocked > 0 || hasMembershipErrors) {
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
        if (outcome !== 'ok') {
          addReliabilityBreadcrumb({
            category: 'sync',
            message: 'Sync completed with non-ideal outcome',
            level: outcome === 'error' ? 'error' : 'warning',
            data: {
              outcome,
              processed: result.processed,
              failed: result.failed,
              blocked: result.blocked,
              pullErrors: result.pullErrors.length,
            },
          });
        }
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
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    const cleanup = onReconnect(() => {
      // Small delay to ensure network is stable
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      reconnectTimeout = setTimeout(doSync, 1000);
    });

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      cleanup();
    };
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
 * Conflict copies already written in this session, keyed by note and losing
 * ciphertext. A resolution that throws part-way has already written the copy,
 * and App's handler clears the conflict rather than rethrowing, so the same
 * conflict returns on a later sync pull and resolveConflict runs again from the
 * top; without this the losing version would be copied once per attempt.
 *
 * The get and the set are separated by awaits. Only one resolution runs at a
 * time through the modal, which disables its buttons while resolving; direct
 * callers should not race two resolutions for one conflict.
 */
const writtenConflictCopies = new Map<string, string>();

/**
 * Resolve a conflict by choosing a version.
 *
 * E2EE-aware: for encrypted notes, pushes encrypted fields (not empty
 * plaintext title/content) and preserves encryption metadata through
 * all resolution paths. The optional `keys` parameter is required for
 * the "both" path on encrypted notes (re-encrypts the copy with a new
 * noteId so AAD is correct). Hard-delete conflicts use a delete-aware
 * path: "local" recreates the note, "server" accepts the deletion,
 * and "both" keeps a copy while letting the original stay deleted.
 */
export function resolveConflict(
  userId: string,
  conflict: ConflictInfo,
  choice: 'local' | 'server' | 'both',
  keys?: import('../lib/encryption').DerivedKeys
): Promise<void> {
  return withCrossTabSyncLock(userId, () =>
    resolveConflictWithQueueOwnership(userId, conflict, choice, keys)
  );
}

async function resolveConflictWithQueueOwnership(
  userId: string,
  conflict: ConflictInfo,
  choice: 'local' | 'server' | 'both',
  keys?: import('../lib/encryption').DerivedKeys
): Promise<void> {
  const { createPendingSyncQueueEntry, getOfflineDb } = await import('../lib/offlineDb');
  const { supabase } = await import('../lib/supabase');
  const db = getOfflineDb(userId);

  if (conflict.entityType !== 'note') {
    throw new Error('Only note conflicts are supported');
  }

  const localNote = conflict.localVersion;
  const serverNote: NoteConflictServerVersion = conflict.serverVersion;

  const isEncrypted = hasEmptyPlaintextColumns(localNote) && hasRequiredCamelEncryptionFields(localNote);
  const isHardDeletedConflict = serverNote.hard_deleted === true;
  const serverIsEncrypted = isLaunchEncryptedDbNote(serverNote);

  const logHardDeleteRecreateFallback = (error: unknown): void => {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn('Failed to recreate hard-deleted note online; queueing local recovery:', error);
    addReliabilityBreadcrumb({
      category: 'sync',
      message: 'Hard-delete recovery fell back to queued recreate',
      level: 'warning',
      data: {
        noteId: localNote.id,
        reason,
      },
    });
  };

  const getOriginalNoteTagLinks = async () =>
    db.noteTags.where('noteId').equals(localNote.id).toArray();

  const clearOriginalQueueEntries = async (includeTagLinks: boolean): Promise<void> => {
    const entryIds = (await db.syncQueue
      .filter((entry) =>
        (entry.entityType === 'note' && entry.entityId === localNote.id) ||
        (includeTagLinks &&
          entry.entityType === 'noteTag' &&
          entry.entityId.startsWith(`${localNote.id}:`))
      )
      .toArray())
      .map((entry) => entry.id)
      .filter((id): id is number => typeof id === 'number');

    if (entryIds.length > 0) {
      await db.syncQueue.bulkDelete(entryIds);
    }
  };

  const clearOriginalNoteWriteQueueEntries = () => clearOriginalQueueEntries(false);
  const clearOriginalNoteAndTagQueueEntries = () => clearOriginalQueueEntries(true);

  const deleteOriginalNoteLocalState = async (): Promise<void> => {
    await db.transaction('rw', [db.notes, db.noteTags, db.syncQueue], async () => {
      await db.notes.delete(localNote.id);
      await db.noteTags.where('noteId').equals(localNote.id).delete();
      await clearOriginalNoteAndTagQueueEntries();
    });
  };

  const acceptServerVersion = async (): Promise<void> => {
    if (!serverIsEncrypted) {
      throw new Error(`Refusing to keep plaintext server note ${serverNote.id}`);
    }

    const serverTime = new Date(serverNote.updated_at).getTime();
    const displayTime = new Date(getDisplayUpdatedAt(serverNote)).getTime();
    const selectedPayload = {
      title: '',
      content: '',
      pinned: serverNote.pinned,
      deleted_at: serverNote.deleted_at,
      display_updated_at: getDisplayUpdatedAt(serverNote),
      encrypted_payload: serverNote.encrypted_payload,
      encryption_iv: serverNote.encryption_iv,
      encryption_version: serverNote.encryption_version,
      content_hash: serverNote.content_hash,
    };
    const selectedLocalFields = {
      title: '',
      content: '',
      pinned: serverNote.pinned,
      deletedAt: serverNote.deleted_at
        ? new Date(serverNote.deleted_at).getTime()
        : null,
      updatedAt: displayTime,
      localUpdatedAt: serverTime,
      encryptedPayload: serverNote.encrypted_payload ?? null,
      encryptionIv: serverNote.encryption_iv ?? null,
      encryptionVersion: serverNote.encryption_version ?? null,
      contentHash: serverNote.content_hash ?? null,
    };

    // Stage the selected server snapshot as the only remaining note write.
    // This repairs the server if an entry dequeued before resolution landed
    // while the conflict modal was open, and it survives a tab dying between
    // the direct write and local acknowledgement.
    await db.transaction('rw', [db.notes, db.syncQueue], async () => {
      await clearOriginalNoteWriteQueueEntries();
      await db.syncQueue.add(createPendingSyncQueueEntry({
        operation: 'update',
        entityType: 'note',
        entityId: localNote.id,
        payload: selectedPayload,
      }));
      await db.notes.update(serverNote.id, {
        ...selectedLocalFields,
        syncStatus: 'pending',
      });
    });

    if (!navigator.onLine) return;

    try {
      const { data: pushed, error } = await supabase
        .from('notes')
        .update(selectedPayload)
        .eq('id', serverNote.id)
        .select('updated_at')
        .single();

      if (error || !pushed) return;

      const confirmedAt = new Date(pushed.updated_at).getTime();
      await db.transaction('rw', [db.notes, db.syncQueue], async () => {
        await clearOriginalNoteWriteQueueEntries();
        await db.notes.update(serverNote.id, {
          ...selectedLocalFields,
          syncStatus: 'synced',
          lastSyncedAt: confirmedAt,
          serverUpdatedAt: confirmedAt,
          confirmedContentHash: serverNote.content_hash ?? null,
        });
      });
    } catch (error) {
      addReliabilityBreadcrumb({
        category: 'sync',
        message: 'Conflict resolution queued the selected server version',
        level: 'warning',
        data: {
          noteId: localNote.id,
          reason: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  // Persist the unchosen version before touching either original. This uses the
  // existing encrypted copy path and requires no revision-history migration.
  let copyKey: string | null = null;
  if (!isHardDeletedConflict && choice !== 'both') {
    // Fail closed: choosing a version must never discard an unreadable opposite version.
    if (!keys || !isEncrypted || !serverIsEncrypted) throw new Error('Both encrypted versions must be available');
    const { decryptNote } = await import('../lib/encryption');
    const { createEncryptedNote } = await import('../services/encryptedNotes');
    const losing = choice === 'local'
      ? { ciphertext: serverNote.encrypted_payload!, iv: serverNote.encryption_iv! }
      : { ciphertext: localNote.encryptedPayload!, iv: localNote.encryptionIv! };
    copyKey = `${localNote.id}:${losing.ciphertext}`;
    const written = writtenConflictCopies.get(copyKey);
    // Only reuse a copy that is still on disk, so a user who discards one and
    // retries still gets the losing version preserved.
    if (!written || !(await db.notes.get(written))) {
      const content = await decryptNote(localNote.id, userId, losing, keys.encryptionKey);
      const suffix = ' (conflict copy)';
      const copyTitle = content.title.slice(0, MAX_NOTE_TITLE_LENGTH - suffix.length).replace(/[\uD800-\uDBFF]$/, '') + suffix;
      const copy = await createEncryptedNote(userId, copyTitle, content.content, keys, false);
      writtenConflictCopies.set(copyKey, copy.id);
    }
  }

  switch (choice) {
    case 'local': {
      const localNoteTags = await getOriginalNoteTagLinks();
      if (!isEncrypted) {
        throw new Error(`Refusing to keep plaintext local note ${localNote.id}`);
      }

      const notePayload = {
        title: '',
        content: '',
        pinned: localNote.pinned,
        encrypted_payload: localNote.encryptedPayload,
        encryption_iv: localNote.encryptionIv,
        encryption_version: localNote.encryptionVersion,
        content_hash: localNote.contentHash,
      };

      const queueRecreatedNote = async (): Promise<void> => {
        await db.transaction('rw', [db.notes, db.noteTags, db.syncQueue], async () => {
          await clearOriginalNoteAndTagQueueEntries();
          await db.syncQueue.add(createPendingSyncQueueEntry({
            operation: 'create',
            entityType: 'note',
            entityId: localNote.id,
            payload: notePayload,
          }));

          for (const noteTag of localNoteTags) {
            await db.syncQueue.add(createPendingSyncQueueEntry({
              operation: 'add_tag',
              entityType: 'noteTag',
              entityId: `${localNote.id}:${noteTag.tagId}`,
              payload: { noteId: localNote.id, tagId: noteTag.tagId },
            }));
          }

          await db.notes.update(localNote.id, {
            syncStatus: 'pending',
            deletedAt: null,
          });

          if (localNoteTags.length > 0) {
            await db.noteTags.where('noteId').equals(localNote.id).modify({
              syncStatus: 'pending',
              lastSyncedAt: null,
            });
          }
        });
      };

      if (isHardDeletedConflict) {
        // Make the selected local version durable before the network request.
        // If this tab dies after the upsert, the queued create is idempotent and
        // contains the selected payload rather than an older conflicted write.
        await queueRecreatedNote();

        if (navigator.onLine) {
          try {
            const { data: recreated, error } = await supabase
              .from('notes')
              .upsert({
                id: localNote.id,
                ...notePayload,
              })
              .select('updated_at')
              .single();

            if (!error && recreated) {
              const serverTime = new Date(recreated.updated_at).getTime();
              await db.transaction('rw', [db.notes, db.syncQueue], async () => {
                // Tag restore entries remain queued; only the now-satisfied
                // note create is retired.
                await clearOriginalNoteWriteQueueEntries();
                await db.notes.update(localNote.id, {
                  syncStatus: 'synced',
                  deletedAt: null,
                  lastSyncedAt: serverTime,
                  serverUpdatedAt: serverTime,
                  updatedAt: localNote.updatedAt,
                  localUpdatedAt: localNote.localUpdatedAt,
                  confirmedContentHash: localNote.contentHash,
                });
              });
              break;
            }

            logHardDeleteRecreateFallback(error ?? new Error('Missing recreated note timestamp'));
          } catch (error) {
            logHardDeleteRecreateFallback(error);
          }
        }
      } else {
        // Replace every pre-existing note write (including blocked entries)
        // with the version the user just selected. Staging before the request
        // makes a killed-tab recovery replay the selected payload, never an
        // older conflict candidate.
        await db.transaction('rw', [db.notes, db.syncQueue], async () => {
          await clearOriginalNoteWriteQueueEntries();
          await db.syncQueue.add(createPendingSyncQueueEntry({
            operation: 'update',
            entityType: 'note',
            entityId: localNote.id,
            payload: notePayload,
          }));
          await db.notes.update(localNote.id, { syncStatus: 'pending' });
        });

        if (navigator.onLine) {
          // Try to push directly when online
          const { data: pushed, error } = await supabase
            .from('notes')
            .update(notePayload)
            .eq('id', localNote.id)
            .select('updated_at')
            .single();

          if (error) {
            // The selected version was staged before the request and remains
            // queued for retry.
          } else {
            // Mark as synced using server timestamp to avoid clock skew
            const serverTime = new Date(pushed.updated_at).getTime();
            await db.transaction('rw', [db.notes, db.syncQueue], async () => {
              await clearOriginalNoteWriteQueueEntries();
              await db.notes.update(localNote.id, {
                syncStatus: 'synced',
                lastSyncedAt: serverTime,
                serverUpdatedAt: serverTime,
                confirmedContentHash: localNote.contentHash,
              });
            });
          }
        }
      }
      break;
    }

    case 'server': {
      if (isHardDeletedConflict) {
        await deleteOriginalNoteLocalState();
        break;
      }
      await acceptServerVersion();
      break;
    }

    case 'both': {
      if (!isHardDeletedConflict && !serverIsEncrypted) {
        throw new Error(`Refusing to keep plaintext server note ${serverNote.id}`);
      }
      if (!isEncrypted || !keys) {
        throw new Error(`Refusing to copy plaintext local note ${localNote.id}`);
      }

      // Keep both: update local with server version, create new note with local content
      const { queueSyncOperation } = await import('../services/offlineNotes');
      const newNoteId = crypto.randomUUID();
      const now = Date.now();

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

      if (isHardDeletedConflict) {
        await deleteOriginalNoteLocalState();
        break;
      }
      await acceptServerVersion();
      break;
    }
  }

  // Resolution succeeded; nothing left to retry.
  if (copyKey) writtenConflictCopies.delete(copyKey);
}
