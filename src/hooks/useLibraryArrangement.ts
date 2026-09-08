import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_ARRANGEMENT,
  isChapterBasis,
  isNoteSortKey,
  type ChapterArrangement,
  type ChapterBasis,
  type NoteSortKey,
} from '../utils/temporalGrouping';

/** Storage key suffixes (prefixed with userId, as in `useSessionSettings`) */
const STORAGE_KEYS = {
  basis: 'chapter-basis',
  sort: 'note-sort',
};

const getStorageKey = (userId: string, key: string) => `yidhan-${userId}-${key}`;

function readStored(userId: string | null, key: string): string | null {
  if (!userId) return null;
  try {
    return localStorage.getItem(getStorageKey(userId, key));
  } catch {
    // Storage blocked (private mode, hardened browser): the default arrangement stands.
    return null;
  }
}

function writeStored(userId: string | null, key: string, value: string) {
  if (!userId) return;
  try {
    localStorage.setItem(getStorageKey(userId, key), value);
  } catch {
    // The choice still applies for this session; it just will not be remembered.
  }
}

/**
 * An unrecognised stored value falls back to the default rather than being trusted, so
 * a hand-edited or stale key cannot put the library into a state the code has no
 * ordering for.
 */
function loadArrangement(userId: string | null): ChapterArrangement {
  const basis = readStored(userId, STORAGE_KEYS.basis);
  const sort = readStored(userId, STORAGE_KEYS.sort);

  return {
    basis: isChapterBasis(basis) ? basis : DEFAULT_ARRANGEMENT.basis,
    sort: isNoteSortKey(sort) ? sort : DEFAULT_ARRANGEMENT.sort,
  };
}

export interface UseLibraryArrangementResult {
  /** How the library is currently grouped and ordered */
  arrangement: ChapterArrangement;
  /** Choose the timestamp chapters are grouped by */
  setBasis: (basis: ChapterBasis) => void;
  /** Choose the order of notes within a chapter */
  setSort: (sort: NoteSortKey) => void;
}

/**
 * Hook for the reader's library arrangement: which timestamp decides a chapter, and how
 * notes are ordered inside one.
 *
 * Stored per-user in localStorage, following `useSessionSettings`, so one account's
 * choice does not follow another into the same browser.
 *
 * @param userId - Current user's ID (null if not logged in)
 */
export function useLibraryArrangement(userId: string | null): UseLibraryArrangementResult {
  const initialArrangement = useMemo(() => loadArrangement(userId), [userId]);
  const [arrangement, setArrangement] = useState<ChapterArrangement>(initialArrangement);

  // Track previous userId to detect changes
  const prevUserIdRef = useRef(userId);

  // Re-read on account change: syncing state with an external store (localStorage)
  useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      setArrangement(loadArrangement(userId));
    }
  }, [userId]);

  const setBasis = useCallback((basis: ChapterBasis) => {
    writeStored(userId, STORAGE_KEYS.basis, basis);
    setArrangement((prev) => ({ ...prev, basis }));
  }, [userId]);

  const setSort = useCallback((sort: NoteSortKey) => {
    writeStored(userId, STORAGE_KEYS.sort, sort);
    setArrangement((prev) => ({ ...prev, sort }));
  }, [userId]);

  return { arrangement, setBasis, setSort };
}
