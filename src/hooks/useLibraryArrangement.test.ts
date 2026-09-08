/**
 * useLibraryArrangement.test.ts — ledger item 48
 *
 * The reader's choice of chapter basis and within-chapter order, remembered per user.
 * The cases that matter are the ones where it must not fire: a second account must not
 * inherit the first's arrangement, a junk stored value must not reach the grouping code,
 * and a browser with storage blocked must still render a library.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLibraryArrangement } from './useLibraryArrangement';
import { DEFAULT_ARRANGEMENT } from '../utils/temporalGrouping';

const USER_ID = 'user-arrangement-1';
const OTHER_USER_ID = 'user-arrangement-2';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLibraryArrangement', () => {
  it('starts at the library default', () => {
    const { result } = renderHook(() => useLibraryArrangement(USER_ID));

    expect(result.current.arrangement).toEqual(DEFAULT_ARRANGEMENT);
  });

  it('remembers a chosen basis and sort for the same user', () => {
    const { result, unmount } = renderHook(() => useLibraryArrangement(USER_ID));

    act(() => {
      result.current.setBasis('created');
      result.current.setSort('title');
    });

    expect(result.current.arrangement).toEqual({ basis: 'created', sort: 'title' });

    unmount();
    const remounted = renderHook(() => useLibraryArrangement(USER_ID));
    expect(remounted.result.current.arrangement).toEqual({ basis: 'created', sort: 'title' });
  });

  it('keeps the two choices independent', () => {
    const { result } = renderHook(() => useLibraryArrangement(USER_ID));

    act(() => {
      result.current.setSort('created');
    });

    expect(result.current.arrangement).toEqual({ basis: DEFAULT_ARRANGEMENT.basis, sort: 'created' });
  });

  it('does not carry one account’s arrangement into another', () => {
    const { result, rerender } = renderHook(
      ({ userId }: { userId: string | null }) => useLibraryArrangement(userId),
      { initialProps: { userId: USER_ID as string | null } }
    );

    act(() => {
      result.current.setBasis('created');
    });

    rerender({ userId: OTHER_USER_ID });
    expect(result.current.arrangement).toEqual(DEFAULT_ARRANGEMENT);

    rerender({ userId: USER_ID });
    expect(result.current.arrangement).toEqual({ ...DEFAULT_ARRANGEMENT, basis: 'created' });
  });

  it('stores nothing when there is no user to store it against', () => {
    const { result } = renderHook(() => useLibraryArrangement(null));

    act(() => {
      result.current.setBasis('created');
    });

    expect(result.current.arrangement.basis).toBe('created');
    expect(localStorage.length).toBe(0);
  });

  it('ignores a stored value it has no ordering for', () => {
    localStorage.setItem(`yidhan-${USER_ID}-chapter-basis`, 'sideways');
    localStorage.setItem(`yidhan-${USER_ID}-note-sort`, '{}');

    const { result } = renderHook(() => useLibraryArrangement(USER_ID));

    expect(result.current.arrangement).toEqual(DEFAULT_ARRANGEMENT);
  });

  it('still arranges the library when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    const { result } = renderHook(() => useLibraryArrangement(USER_ID));

    expect(result.current.arrangement).toEqual(DEFAULT_ARRANGEMENT);
  });

  it('still applies a choice for this session when storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    const { result } = renderHook(() => useLibraryArrangement(USER_ID));

    act(() => {
      result.current.setSort('title');
    });

    expect(result.current.arrangement.sort).toBe('title');
  });
});
