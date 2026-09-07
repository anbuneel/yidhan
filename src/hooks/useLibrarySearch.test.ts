import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLibrarySearch } from './useLibrarySearch';

describe('useLibrarySearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the typed query immediately and the debounced one later', () => {
    const { result } = renderHook(() => useLibrarySearch());

    act(() => result.current.handleSearchChange('harvest'));
    expect(result.current.searchQuery).toBe('harvest');
    expect(result.current.debouncedSearchQuery).toBe('');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.debouncedSearchQuery).toBe('harvest');
  });

  it('only runs the last query of a burst', () => {
    const { result } = renderHook(() => useLibrarySearch());

    act(() => result.current.handleSearchChange('h'));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => result.current.handleSearchChange('ha'));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => result.current.handleSearchChange('har'));

    expect(result.current.debouncedSearchQuery).toBe('');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.debouncedSearchQuery).toBe('har');
  });

  it('clears without waiting — the whole library comes back at once', () => {
    const { result } = renderHook(() => useLibrarySearch());

    act(() => result.current.handleSearchChange('harvest'));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.debouncedSearchQuery).toBe('harvest');

    act(() => result.current.handleSearchChange(''));
    expect(result.current.debouncedSearchQuery).toBe('');
  });

  it('treats a whitespace-only query as cleared', () => {
    const { result } = renderHook(() => useLibrarySearch());

    act(() => result.current.handleSearchChange('   '));
    expect(result.current.debouncedSearchQuery).toBe('');
    expect(result.current.isSearching).toBe(false);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.debouncedSearchQuery).toBe('');
  });

  it('reports isSearching only once the debounced query has landed', () => {
    const { result } = renderHook(() => useLibrarySearch());

    act(() => result.current.handleSearchChange('harvest'));
    expect(result.current.isSearching).toBe(false);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.isSearching).toBe(true);
  });

  it('advances the focus token each time focus is requested', () => {
    const { result } = renderHook(() => useLibrarySearch());
    const start = result.current.searchFocusToken;

    act(() => result.current.requestSearchFocus());
    act(() => result.current.requestSearchFocus());

    expect(result.current.searchFocusToken).toBe(start + 2);
  });

  it('does not fire a pending debounce after unmount', () => {
    const { result, unmount } = renderHook(() => useLibrarySearch());

    act(() => result.current.handleSearchChange('harvest'));
    unmount();

    expect(() =>
      act(() => {
        vi.advanceTimersByTime(300);
      })
    ).not.toThrow();
  });
});
