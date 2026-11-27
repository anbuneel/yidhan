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

/**
 * A refresh that loses the race with a local change re-reads this many times before
 * handing over to the next scheduled refresh.
 */
const MAX_REFRESH_READS = 3;

/** How long a refresh waits for an in-flight local write before deferring itself. */
const LOCAL_WRITE_WAIT_MS = 5000;

/** Ceiling for the delay between deferred refreshes. */
const MAX_REFRESH_BACKOFF_MS = 5000;

/** Deferrals in a row before the stall is reported. */
const REPORT_REFRESH_DEFERRALS = 5;

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
  /**
   * Called when the open note is removed underneath the reader. The caller decides
   * whether to close it: an editor holding unsaved words stays open (issue #205).
   */
  onOpenNoteRemoved: (noteId: string) => void;
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
  /**
   * Run a local write whose change is already on screen (an optimistic update). A
   * sync refresh does not replace the list while one is in flight, or with a read
   * taken before it finished: that read would put the old copy back.
   *
   * Call it in the same synchronous step as the optimistic `setNotes`, with no
   * `await` between them. Any writer that changes the list before IndexedDB needs it.
   */
  trackLocalWrite: <T>(write: () => Promise<T>) => Promise<T>;
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
  const [notes, setNotesState] = useState<Note[]>([]);

  // Counts every change to the list except a refresh snapshot. A refresh reads
  // IndexedDB and decrypts the whole library before it replaces the list; if the count
  // moved meanwhile, the snapshot predates a local change (a note just created, an
  // edit, a realtime insert) and applying it would undo that change on screen. A note
  // created that way vanished and App closed it as "no longer here".
  const listVersionRef = useRef(0);
  const setNotes = useCallback<Dispatch<SetStateAction<Note[]>>>((action) => {
    listVersionRef.current += 1;
    setNotesState(action);
  }, []);

  // Writes whose change reached the list before it reached IndexedDB. A refresh read
  // during one sees the old copy and the version alone cannot tell.
  const pendingLocalWritesRef = useRef(new Set<Promise<unknown>>());
  const trackLocalWrite = useCallback(async <T,>(write: () => Promise<T>): Promise<T> => {
    const pending = write();
    pendingLocalWritesRef.current.add(pending);
    try {
      return await pending;
    } finally {
      pendingLocalWritesRef.current.delete(pending);
      listVersionRef.current += 1;
    }
  }, []);

  /** Resolves true once the writes in flight now have settled, false on timeout. */
  const waitForLocalWrites = useCallback(async (): Promise<boolean> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), LOCAL_WRITE_WAIT_MS);
    });
    try {
      return await Promise.race([
        Promise.allSettled([...pendingLocalWritesRef.current]).then(() => true as const),
        timedOut,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const [loadingState, setLoading] = useState(true);
  // The user and keys the list was last read for. On the render where the keys arrive
  // (a reload restores the session first) the fetch effect has not run yet, so
  // `loadingState` still says "done" from the no-keys branch. App would read that as
  // the open note being missing and leave it.
  const [loadedFor, setLoadedFor] = useState<{ userId: string; keys: DerivedKeys } | null>(null);
  const loading =
    loadingState ||
    (Boolean(userId) && keys !== null && (loadedFor?.userId !== userId || loadedFor?.keys !== keys));
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

  // Only the latest refresh may replace the list; an older one that resolves last
  // would put back what the newer one removed or miss what it added.
  const refreshIdRef = useRef(0);
  const deferRefreshRef = useRef<() => void>(() => {});
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  // A refresh started for one user must not land after a switch to another.
  const currentUserIdRef = useRef(userId);
  currentUserIdRef.current = userId;

  const refreshFromSync = useCallback(async () => {
    if (!userId || !keys) return;
    const refreshId = ++refreshIdRef.current;
    // Superseded, unmounted, signed out, or the vault locked or changed keys. A lock in
    // particular: a read with the old keys must not put plaintext back on screen.
    const abandoned = () =>
      !mountedRef.current ||
      refreshId !== refreshIdRef.current ||
      currentUserIdRef.current !== userId ||
      keysRef.current !== keys;
    try {
      for (let read = 1; ; read++) {
        // Wait for a write in flight instead of reading the copy it is replacing.
        if (pendingLocalWritesRef.current.size > 0) {
          const settled = await waitForLocalWrites();
          if (abandoned()) return;
          if (!settled) {
            deferRefreshRef.current();
            break;
          }
        }
        const versionAtRead = listVersionRef.current;
        const snapshot = await fetchDecryptedNotes(userId, keys);
        if (abandoned()) return;
        if (versionAtRead === listVersionRef.current && pendingLocalWritesRef.current.size === 0) {
          setNotesState(snapshot);
          refreshDeferralsRef.current = 0;
          break;
        }
        // The list changed while we read. A fresh read includes the change, because
        // local writes reach IndexedDB before the version moves past them.
        if (read >= MAX_REFRESH_READS) {
          deferRefreshRef.current();
          break;
        }
      }
      // Tags do not race with the list, so they refresh even when the notes deferred.
      const refreshedTags = await fetchTagsOffline(userId);
      if (abandoned()) return;
      setTags(refreshedTags);
    } catch (error) {
      console.error('Failed to rehydrate after sync:', error);
    }
  }, [userId, keys, waitForLocalWrites]);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSyncRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshFromSync();
    }, SYNC_REFRESH_COALESCE_MS);
  }, [refreshFromSync]);

  // A refresh that keeps losing to local changes (steady typing, a slow write) backs
  // off instead of decrypting the library every 150ms, and a long stall is reported.
  const refreshDeferralsRef = useRef(0);
  deferRefreshRef.current = () => {
    if (!mountedRef.current) return;
    refreshDeferralsRef.current += 1;
    const deferrals = refreshDeferralsRef.current;
    if (deferrals === REPORT_REFRESH_DEFERRALS) {
      reportReliabilityIssue({
        category: 'sync',
        message: 'Sync refresh deferred repeatedly by local changes',
        level: 'warning',
        data: { deferrals, pendingWrites: pendingLocalWritesRef.current.size },
      });
    }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshFromSync();
    }, Math.min(SYNC_REFRESH_COALESCE_MS * 2 ** deferrals, MAX_REFRESH_BACKOFF_MS));
  };

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

    let current = true;
    fetchDecryptedNotes(userId, keys)
      .then((loaded) => { if (current) setNotes(loaded); })
      .catch((error) => {
        if (!current) return;
        console.error('Failed to decrypt notes:', error);
        setNotes([]);
        toast.error('Could not decrypt your notes. Lock and unlock your vault, then try again.');
      })
      .finally(() => {
        if (!current) return;
        setLoadedFor({ userId, keys });
        setLoading(false);
      });

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
              onOpenNoteRemovedRef.current(updatedNote.id);
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
              onOpenNoteRemovedRef.current(deletedId);
            }
          })
          .catch((error) => {
            console.error('Failed to persist realtime note delete:', error);
            void reportRealtimePersistenceFailure('note', 'delete', error);
          });
      }
    );

    return () => {
      current = false;
      unsubscribe();
    };
  }, [
    userId,
    keys,
    isHydrating,
    hydrationBypassed,
    openNoteIdRef,
    reportRealtimeDisplayFailure,
    reportRealtimePersistenceFailure,
    scheduleFadedNotesCountRefresh,
    setNotes,
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
    trackLocalWrite,
  };
}
