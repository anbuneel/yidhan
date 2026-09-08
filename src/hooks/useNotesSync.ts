/**
 * The library's data layer: notes, tags, the faded count, and the realtime and sync
 * wiring that keeps them current.
 *
 * This was App.tsx's largest tenant — six effects, two realtime subscriptions and the
 * failure reporting they share, interleaved with routing and rendering. Nothing about
 * its behaviour changes here; it simply now has a name and one place to live.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import toast from 'react-hot-toast';
import type { Note, Tag } from '../types';
import type { DerivedKeys } from '../lib/encryption';
import {
  subscribeToNotes,
  cleanupExpiredFadedNotes,
} from '../services/notes';
import { subscribeToTags } from '../services/tags';
import {
  countFadedNotesOffline,
  upsertNoteFromServer,
  deleteNoteFromServer,
  upsertTagFromServer,
  deleteTagFromServer,
} from '../services/offlineNotes';
import type { LocalNote } from '../lib/offlineDb';
import { fetchDecryptedNotes, decryptNoteFromServer } from '../services/encryptedNotes';
import { fetchTagsOffline } from '../services/offlineTags';
import { subscribeToNoteTags } from '../services/noteTagSync';
import { useSyncEngine } from './useSyncEngine';
import { useStoragePersistence } from './useStoragePersistence';
import {
  reportConflict,
  invalidateSyncPullCursors,
  type HardDeletedServerNoteVersion,
} from '../services/syncEngine';
import { reportReliabilityIssue } from '../utils/reliabilityTelemetry';

/**
 * Realtime tag events arrive one per row, and each full refresh decrypts the whole
 * library. Collapse a burst — a bulk retag, or a reconnect replaying missed events —
 * into a single pass.
 */
const SYNC_REFRESH_COALESCE_MS = 150;

/** After a save, wait before syncing so rapid typing does not flood the queue. */
const COALESCED_SYNC_DELAY_MS = 2000;

/** Maximum wait for hydration before fetching anyway (Android WebView edge cases). */
const HYDRATION_FAILSAFE_MS = 15000;

export interface UseNotesSyncOptions {
  userId: string | undefined;
  keys: DerivedKeys | null;
  isHydrating: boolean;
  /** The note currently open, so a remote delete can close it. Read through a ref. */
  openNoteIdRef: React.RefObject<string | null>;
  /** Called when the open note is removed underneath the reader. */
  onOpenNoteRemoved: () => void;
  /** Called when the user signs out, after the per-user state has been cleared. */
  onSignedOut?: () => void;
}

export interface NotesSync {
  notes: Note[];
  setNotes: Dispatch<SetStateAction<Note[]>>;
  loading: boolean;
  tags: Tag[];
  setTags: Dispatch<SetStateAction<Tag[]>>;
  selectedTagIds: string[];
  setSelectedTagIds: Dispatch<SetStateAction<string[]>>;
  fadedNotesCount: number;
  /** Recount faded notes from IndexedDB after a local membership mutation. */
  refreshFadedNotesCount: () => Promise<void>;
  conflicts: ReturnType<typeof useSyncEngine>['conflicts'];
  removeConflict: ReturnType<typeof useSyncEngine>['removeConflict'];
  triggerSync: ReturnType<typeof useSyncEngine>['triggerSync'];
  /** Sync after a save, coalesced so rapid typing does not flood the queue. */
  triggerCoalescedSync: () => void;
  /** Re-read notes and tags from local storage after a sync pulled remote changes. */
  refreshFromSync: () => Promise<void>;
}

/** Build a synthetic server version representing a note deleted on another device. */
function buildDeletedServerVersion(note: LocalNote): HardDeletedServerNoteVersion {
  const serverTimestamp = new Date(note.serverUpdatedAt ?? Date.now()).toISOString();

  return {
    id: note.id,
    user_id: note.userId,
    title: '',
    content: '',
    pinned: note.pinned,
    deleted_at: new Date().toISOString(),
    created_at: new Date(note.createdAt).toISOString(),
    display_updated_at: new Date(note.updatedAt).toISOString(),
    updated_at: serverTimestamp,
    encrypted_payload: note.encryptedPayload ?? null,
    encryption_iv: note.encryptionIv ?? null,
    encryption_version: note.encryptionVersion ?? null,
    content_hash: note.contentHash ?? null,
    hard_deleted: true as const,
  };
}

export function useNotesSync({
  userId,
  keys,
  isHydrating,
  openNoteIdRef,
  onOpenNoteRemoved,
  onSignedOut,
}: UseNotesSyncOptions): NotesSync {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [fadedNotesCount, setFadedNotesCount] = useState(0);
  const [hydrationBypassed, setHydrationBypassed] = useState(false);

  // IndexedDB is the source of truth for the badge. Keep only the latest read so a
  // slower count cannot overwrite one requested after a later mutation.
  const fadedCountRefreshIdRef = useRef(0);
  const refreshFadedNotesCount = useCallback(async () => {
    const refreshId = ++fadedCountRefreshIdRef.current;
    if (!userId) {
      setFadedNotesCount(0);
      return;
    }

    try {
      const count = await countFadedNotesOffline(userId);
      if (refreshId === fadedCountRefreshIdRef.current) {
        setFadedNotesCount(count);
      }
    } catch (error) {
      console.error('Failed to recount faded notes:', error);
    }
  }, [userId]);

  const fadedCountRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleFadedNotesCountRefresh = useCallback(() => {
    if (fadedCountRefreshTimerRef.current) clearTimeout(fadedCountRefreshTimerRef.current);
    fadedCountRefreshTimerRef.current = setTimeout(() => {
      fadedCountRefreshTimerRef.current = null;
      void refreshFadedNotesCount();
    }, SYNC_REFRESH_COALESCE_MS);
  }, [refreshFadedNotesCount]);

  // Read the latest keys inside realtime handlers without resubscribing the Supabase
  // channel every time the vault locks or unlocks.
  const keysRef = useRef(keys);
  keysRef.current = keys;

  // Distinguish an initial null userId (auth still hydrating) from a sign-out.
  const prevUserIdRef = useRef<string | undefined>(undefined);

  const onOpenNoteRemovedRef = useRef(onOpenNoteRemoved);
  onOpenNoteRemovedRef.current = onOpenNoteRemoved;
  const onSignedOutRef = useRef(onSignedOut);
  onSignedOutRef.current = onSignedOut;

  // --- Sync engine wiring ---------------------------------------------------

  const refreshFromSync = useCallback(async () => {
    if (!userId || !keys) return;
    try {
      setNotes(await fetchDecryptedNotes(userId, keys));
      setTags(await fetchTagsOffline(userId));
    } catch (error) {
      console.error('Failed to rehydrate after sync:', error);
    }
  }, [userId, keys]);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSyncRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshFromSync();
    }, SYNC_REFRESH_COALESCE_MS);
  }, [refreshFromSync]);

  useEffect(() => () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (fadedCountRefreshTimerRef.current) clearTimeout(fadedCountRefreshTimerRef.current);
  }, []);

  const { conflicts, removeConflict, triggerSync } = useSyncEngine(
    refreshFromSync,
    scheduleFadedNotesCountRefresh
  );

  // Ask the browser not to evict the offline database. An unsynced note lives only
  // there, and best-effort storage can be cleared silently under disk pressure —
  // which is how blocked notes were lost across a restart.
  useStoragePersistence();

  const triggerSyncRef = useRef(triggerSync);
  triggerSyncRef.current = triggerSync;

  const coalescedSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearCoalescedSyncTimeout = useCallback(() => {
    if (coalescedSyncTimeoutRef.current) {
      clearTimeout(coalescedSyncTimeoutRef.current);
      coalescedSyncTimeoutRef.current = null;
    }
  }, []);
  const triggerCoalescedSync = useCallback(() => {
    clearCoalescedSyncTimeout();
    coalescedSyncTimeoutRef.current = setTimeout(() => {
      coalescedSyncTimeoutRef.current = null;
      triggerSync();
    }, COALESCED_SYNC_DELAY_MS);
  }, [clearCoalescedSyncTimeout, triggerSync]);

  useEffect(() => clearCoalescedSyncTimeout, [clearCoalescedSyncTimeout]);

  // --- Realtime failure reporting -------------------------------------------

  const reportRealtimeDisplayFailure = useCallback(
    (operation: 'insert' | 'update', error: unknown) => {
      reportReliabilityIssue(
        {
          category: 'sync',
          message: 'Realtime note could not be decrypted for display',
          level: 'warning',
          data: { operation, userId: userId ?? null },
        },
        error
      );
      toast.error(
        'A live note change was saved locally but could not be displayed. Please refresh.'
      );
    },
    [userId]
  );

  const realtimeRecoveryInFlightRef = useRef(false);
  const reportRealtimePersistenceFailure = useCallback(
    async (entity: 'note' | 'tag', operation: 'insert' | 'update' | 'delete', error: unknown) => {
      reportReliabilityIssue(
        {
          category: 'sync',
          message: 'Realtime change could not be persisted locally',
          level: 'warning',
          data: { entity, operation, userId: userId ?? null },
        },
        error
      );
      toast.error('A live change could not be saved locally. Recovering sync state now.');

      if (!userId || realtimeRecoveryInFlightRef.current) return;
      realtimeRecoveryInFlightRef.current = true;

      try {
        // Reset pull cursors before scheduling recovery so the next sync cannot reuse
        // a stale incremental cursor after a dropped realtime write.
        await invalidateSyncPullCursors(userId);
        const { outcome } = await triggerSyncRef.current();
        if (outcome === 'error') {
          reportReliabilityIssue({
            category: 'sync',
            message: 'Realtime persistence recovery sync failed',
            level: 'warning',
            data: { entity, operation, userId },
          });
        }
      } catch (recoveryError) {
        reportReliabilityIssue(
          {
            category: 'sync',
            message: 'Failed to schedule recovery after realtime persistence failure',
            level: 'warning',
            data: { entity, operation, userId },
          },
          recoveryError
        );
      } finally {
        realtimeRecoveryInFlightRef.current = false;
      }
    },
    [userId]
  );

  // --- Note-tag membership --------------------------------------------------

  useEffect(() => {
    if (!userId || !keys) return;
    return subscribeToNoteTags(userId, scheduleSyncRefresh, () => {
      void triggerSync();
    });
  }, [userId, keys, triggerSync, scheduleSyncRefresh]);

  useEffect(() => {
    setHydrationBypassed(false);
  }, [userId]);

  // --- Notes: fetch and realtime --------------------------------------------

  useEffect(() => {
    if (!userId) {
      setNotes([]);
      setLoading(false);

      if (prevUserIdRef.current) {
        onSignedOutRef.current?.();
      }

      prevUserIdRef.current = undefined;
      return;
    }
    prevUserIdRef.current = userId;

    // Don't fetch until hydration is complete (first-time users need server data)
    // UNLESS we've already waited too long (failsafe for Android WebView hangs).
    if (isHydrating && !hydrationBypassed) {
      setLoading(true);
      const failsafeTimeout = setTimeout(() => {
        console.warn('Hydration failsafe triggered - bypassing hydration wait');
        setHydrationBypassed(true);
      }, HYDRATION_FAILSAFE_MS);
      return () => clearTimeout(failsafeTimeout);
    }

    setLoading(true);
    if (!keys) {
      setNotes([]);
      setLoading(false);
      return;
    }

    fetchDecryptedNotes(userId, keys)
      .then(setNotes)
      .catch((error) => {
        console.error('Failed to decrypt notes:', error);
        setNotes([]);
        toast.error('Could not decrypt your notes. Lock and unlock your vault, then try again.');
      })
      .finally(() => setLoading(false));

    const maybeDecrypt = async (note: Note): Promise<Note> => {
      const currentKeys = keysRef.current;
      return currentKeys ? decryptNoteFromServer(note, userId, currentKeys) : note;
    };

    const unsubscribe = subscribeToNotes(
      userId,
      (newNote) => {
        void (async () => {
          try {
            await upsertNoteFromServer(userId, newNote);
          } catch (error) {
            console.error('Failed to persist realtime note insert:', error);
            void reportRealtimePersistenceFailure('note', 'insert', error);
            return;
          }

          scheduleFadedNotesCountRefresh();

          maybeDecrypt(newNote)
            .then((decrypted) => {
              setNotes((prev) => {
                if (prev.some((n) => n.id === decrypted.id)) return prev;
                // Realtime inserts carry no tags; they arrive on the next full load.
                return [{ ...decrypted, syncStatus: 'synced' as const }, ...prev];
              });
            })
            .catch((error) => {
              console.error('Failed to decrypt realtime note insert for display:', error);
              reportRealtimeDisplayFailure('insert', error);
            });
        })();
      },
      (updatedNote) => {
        void (async () => {
          try {
            await upsertNoteFromServer(userId, updatedNote);
          } catch (error) {
            console.error('Failed to persist realtime note update:', error);
            void reportRealtimePersistenceFailure('note', 'update', error);
            return;
          }

          scheduleFadedNotesCountRefresh();

          // A soft delete arrives as an update carrying deletedAt.
          if (updatedNote.deletedAt) {
            setNotes((prev) => prev.filter((n) => n.id !== updatedNote.id));
            if (openNoteIdRef.current === updatedNote.id) {
              onOpenNoteRemovedRef.current();
            }
            return;
          }

          maybeDecrypt(updatedNote)
            .then((decrypted) => {
              setNotes((prev) => {
                const existingNote = prev.find((n) => n.id === decrypted.id);
                if (existingNote) {
                  return prev.map((n) =>
                    n.id === decrypted.id
                      ? { ...decrypted, tags: n.tags, syncStatus: n.syncStatus }
                      : n
                  );
                }
                // Not in the active list: restored from faded on another device.
                return [{ ...decrypted, syncStatus: 'synced' as const }, ...prev];
              });
            })
            .catch((error) => {
              console.error('Failed to decrypt realtime note update for display:', error);
              reportRealtimeDisplayFailure('update', error);
            });
        })();
      },
      (deletedId) => {
        deleteNoteFromServer(userId, deletedId)
          .then((result) => {
            scheduleFadedNotesCountRefresh();
            if (!result.deleted) {
              setNotes((prev) =>
                prev.map((note) =>
                  note.id === deletedId ? { ...note, syncStatus: 'conflict' as const } : note
                )
              );

              reportConflict({
                entityType: 'note',
                entityId: deletedId,
                localVersion: result.localNote,
                serverVersion: buildDeletedServerVersion(result.localNote),
              });
              return;
            }

            setNotes((prev) => prev.filter((n) => n.id !== deletedId));
            if (openNoteIdRef.current === deletedId) {
              onOpenNoteRemovedRef.current();
            }
          })
          .catch((error) => {
            console.error('Failed to persist realtime note delete:', error);
            void reportRealtimePersistenceFailure('note', 'delete', error);
          });
      }
    );

    return () => unsubscribe();
  }, [
    userId,
    keys,
    isHydrating,
    hydrationBypassed,
    openNoteIdRef,
    reportRealtimeDisplayFailure,
    reportRealtimePersistenceFailure,
    scheduleFadedNotesCountRefresh,
  ]);

  // --- Tags: fetch and realtime ---------------------------------------------

  useEffect(() => {
    if (!userId) {
      setTags([]);
      setSelectedTagIds([]);
      return;
    }

    if (isHydrating) return;

    fetchTagsOffline(userId).then(setTags).catch(console.error);

    const unsubscribeTags = subscribeToTags(
      userId,
      (newTag) => {
        upsertTagFromServer(userId, newTag)
          .then(() => {
            setTags((prev) => {
              if (prev.some((t) => t.id === newTag.id)) return prev;
              return [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name));
            });
            // Membership and tag-definition events can arrive in either order.
            scheduleSyncRefresh();
          })
          .catch((error) => {
            console.error('Failed to persist realtime tag insert:', error);
            void reportRealtimePersistenceFailure('tag', 'insert', error);
          });
      },
      (updatedTag) => {
        upsertTagFromServer(userId, updatedTag)
          .then(() => {
            setTags((prev) => prev.map((t) => (t.id === updatedTag.id ? updatedTag : t)));
            scheduleSyncRefresh();
          })
          .catch((error) => {
            console.error('Failed to persist realtime tag update:', error);
            void reportRealtimePersistenceFailure('tag', 'update', error);
          });
      },
      (deletedId) => {
        deleteTagFromServer(userId, deletedId)
          .then(() => {
            setTags((prev) => prev.filter((t) => t.id !== deletedId));
            setSelectedTagIds((prev) => prev.filter((id) => id !== deletedId));
            scheduleSyncRefresh();
          })
          .catch((error) => {
            console.error('Failed to persist realtime tag delete:', error);
            void reportRealtimePersistenceFailure('tag', 'delete', error);
          });
      }
    );

    return () => unsubscribeTags();
  }, [
    userId,
    isHydrating,
    reportRealtimePersistenceFailure,
    scheduleSyncRefresh,
    scheduleFadedNotesCountRefresh,
  ]);

  // --- Faded count ----------------------------------------------------------

  useEffect(() => {
    if (!userId) {
      void refreshFadedNotesCount();
      return;
    }

    if (isHydrating) return;

    // Clear expired notes first, so nobody sees a note past its 30-day window.
    cleanupExpiredFadedNotes()
      .then(refreshFadedNotesCount)
      .catch(console.error);
  }, [userId, isHydrating, refreshFadedNotesCount]);

  return {
    notes,
    setNotes,
    loading,
    tags,
    setTags,
    selectedTagIds,
    setSelectedTagIds,
    fadedNotesCount,
    refreshFadedNotesCount,
    conflicts,
    removeConflict,
    triggerSync,
    triggerCoalescedSync,
    refreshFromSync,
  };
}
