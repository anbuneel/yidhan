/**
 * The three things a reader can do to sync itself: resolve a conflict, pull to refresh,
 * and retry the writes that blocked.
 *
 * All three end the same way — re-read notes and tags from IndexedDB, because the
 * authoritative copy after any of them is the local database, not React state.
 */

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import type { Note, Tag } from '../types';
import type { DerivedKeys } from '../lib/encryption';
import { resolveConflict, type useSyncEngine } from './useSyncEngine';
import { fetchDecryptedNotes } from '../services/encryptedNotes';
import { fetchTagsOffline } from '../services/offlineTags';
import {
  getBlockedSyncReason,
  retryBlockedSyncEntries,
} from '../services/offlineNotes';
import { describeSyncFailure } from '../utils/syncErrorMessages';

type SyncConflict = ReturnType<typeof useSyncEngine>['conflicts'][number];

export interface UseSyncActionsOptions {
  userId: string | undefined;
  keys: DerivedKeys | null;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setTags: Dispatch<SetStateAction<Tag[]>>;
  conflicts: SyncConflict[];
  removeConflict: (entityId: string) => void;
  triggerSync: ReturnType<typeof useSyncEngine>['triggerSync'];
  openNoteIdRef: React.RefObject<string | null>;
  /** Close the editor when conflict resolution leaves its note without a version. */
  onOpenNoteClosed: () => void;
}

export interface SyncActions {
  activeConflict: SyncConflict | null;
  isRetryingBlockedChanges: boolean;
  handleConflictResolve: (choice: 'local' | 'server' | 'both') => Promise<void>;
  handleConflictDismiss: () => void;
  handleRefresh: () => Promise<void>;
  handleRetryBlockedChanges: () => Promise<void>;
}

export function useSyncActions({
  userId,
  keys,
  setNotes,
  setTags,
  conflicts,
  removeConflict,
  triggerSync,
  openNoteIdRef,
  onOpenNoteClosed,
}: UseSyncActionsOptions): SyncActions {
  const [activeConflict, setActiveConflict] = useState<SyncConflict | null>(null);
  const [isRetryingBlockedChanges, setIsRetryingBlockedChanges] = useState(false);

  // Show the first conflict as soon as one appears.
  useEffect(() => {
    if (conflicts.length > 0 && !activeConflict) {
      setActiveConflict(conflicts[0]);
    }
  }, [conflicts, activeConflict]);

  // Conflict resolution handler
  const handleConflictResolve = async (choice: 'local' | 'server' | 'both') => {
    if (!activeConflict || !userId) return;
    if (!keys) {
      toast.error('Please unlock your vault before resolving sync conflicts');
      return;
    }

    const conflictToResolve = activeConflict;

    try {
      await resolveConflict(userId, conflictToResolve, choice, keys);
      removeConflict(conflictToResolve.entityId);
      setActiveConflict(null);

      // Refresh notes from IndexedDB after conflict resolution
      const refreshedNotes = await fetchDecryptedNotes(userId, keys);
      setNotes(refreshedNotes);

      const resolvedOriginalMissing = !refreshedNotes.some(
        (note) => note.id === conflictToResolve.entityId
      );
      if (
        openNoteIdRef.current === conflictToResolve.entityId &&
        resolvedOriginalMissing
      ) {
        onOpenNoteClosed();
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      toast.error('Failed to resolve conflict. Please try again.');
      // Still remove the conflict to prevent infinite retry loops
      // User can trigger a sync to re-detect conflicts if needed
      removeConflict(conflictToResolve.entityId);
      setActiveConflict(null);
    }
  };

  const handleConflictDismiss = () => {
    if (activeConflict) {
      removeConflict(activeConflict.entityId);
    }
    setActiveConflict(null);
  };

  // Pull-to-refresh handler - syncs with server first, then rehydrates state
  const handleRefresh = useCallback(async () => {
    if (!userId) return;
    if (!keys) {
      toast.error('Please unlock your vault first');
      return;
    }

    try {
      // Sync with server first (push + pull)
      const { outcome } = await triggerSync();

      // Rehydrate React state from IndexedDB (now has fresh server data)
      const refreshedNotes = await fetchDecryptedNotes(userId, keys);
      setNotes(refreshedNotes);
      const refreshedTags = await fetchTagsOffline(userId);
      setTags(refreshedTags);

      // Show outcome-specific feedback
      switch (outcome) {
        case 'ok':
          toast.success('Notes refreshed', { duration: 1500 });
          break;
        case 'partial':
          toast('Refreshed, but some changes couldn\u2019t sync', {
            duration: 3000,
            icon: '\u26A0\uFE0F',
          });
          break;
        case 'offline':
          toast('You\u2019re offline. Showing local notes.', {
            duration: 2000,
          });
          break;
        case 'error':
          toast.error('Couldn\u2019t reach server. Showing local notes.', {
            duration: 3000,
          });
          break;
      }
    } catch (error) {
      console.error('Refresh failed:', error);
      toast.error('Failed to refresh notes');
    }
  }, [userId, triggerSync, keys, setNotes, setTags]);

  const handleRetryBlockedChanges = useCallback(async () => {
    if (!userId || isRetryingBlockedChanges) {
      return;
    }

    setIsRetryingBlockedChanges(true);
    try {
      const retriedCount = await retryBlockedSyncEntries(userId);
      if (retriedCount === 0) {
        return;
      }

      const { outcome } = await triggerSync();

      if (outcome === 'ok') {
        toast.success('Blocked changes sent again', { duration: 2000 });
        return;
      }

      if (outcome === 'offline') {
        toast('Queued blocked changes for the next connection.', {
          duration: 2500,
        });
        return;
      }

      // Say why. A bare "still need attention" is what left blocked changes
      // undiagnosable — the reason is already recorded on the queue entry.
      // The raw Postgres text goes to the console; the toast stays readable.
      const rawReason = await getBlockedSyncReason(userId);
      if (rawReason) console.warn('[sync] blocked entry:', rawReason);
      const reason = describeSyncFailure(rawReason);
      toast(
        reason
          ? `Some changes are still blocked. ${reason}`
          : 'Retried blocked changes, but some still need attention.',
        {
          duration: 6000,
          icon: '\u26A0\uFE0F',
        }
      );
    } catch (error) {
      console.error('Failed to retry blocked changes:', error);
      toast.error('Failed to retry blocked changes');
    } finally {
      setIsRetryingBlockedChanges(false);
    }
  }, [userId, triggerSync, isRetryingBlockedChanges]);


  return {
    activeConflict,
    isRetryingBlockedChanges,
    handleConflictResolve,
    handleConflictDismiss,
    handleRefresh,
    handleRetryBlockedChanges,
  };
}
