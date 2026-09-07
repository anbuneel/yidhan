/**
 * The library's search box: the query as typed, the debounced query the filter runs on,
 * and the token that asks the input to take focus.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const SEARCH_DEBOUNCE_MS = 300;

export interface LibrarySearch {
  searchQuery: string;
  debouncedSearchQuery: string;
  isSearching: boolean;
  searchFocusToken: number;
  handleSearchChange: (query: string) => void;
  requestSearchFocus: () => void;
}

export function useLibrarySearch(): LibrarySearch {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchFocusToken, setSearchFocusToken] = useState(0);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSearchTimeout = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
  }, []);

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      clearSearchTimeout();

      // Clearing is immediate. Waiting 300ms to show the whole library back is the
      // one case where the debounce reads as lag rather than as calm.
      if (!query.trim()) {
        setDebouncedSearchQuery('');
        return;
      }

      searchTimeoutRef.current = setTimeout(() => {
        searchTimeoutRef.current = null;
        setDebouncedSearchQuery(query);
      }, SEARCH_DEBOUNCE_MS);
    },
    [clearSearchTimeout]
  );

  useEffect(() => clearSearchTimeout, [clearSearchTimeout]);

  const requestSearchFocus = useCallback(() => setSearchFocusToken((prev) => prev + 1), []);

  return {
    searchQuery,
    debouncedSearchQuery,
    isSearching: debouncedSearchQuery.trim().length > 0,
    searchFocusToken,
    handleSearchChange,
    requestSearchFocus,
  };
}
