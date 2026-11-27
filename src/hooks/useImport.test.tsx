import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DerivedKeys } from '../lib/encryption';

const toastError = vi.hoisted(() => vi.fn());
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: toastError }),
}));
// The import body is a lazy chunk. A service worker update can make its URL stale, and
// then the import() itself rejects, before anything is written.
vi.mock('../utils/importFile', () => {
  throw new Error('Failed to fetch dynamically imported module: /assets/importFile-old.js');
});

import { useImport } from './useImport';

describe('useImport when the import code cannot load', () => {
  it('says the import could not load, not that the file is bad', async () => {
    const reloadFromStorage = vi.fn();
    const { result } = renderHook(() => useImport({
      userId: 'user-1', keys: {} as DerivedKeys, notes: [], tags: [],
      setTags: vi.fn(), reloadFromStorage,
    }));

    await act(async () => {
      await result.current.handleImportFile(new File(['# A note'], 'note.md'));
    });

    expect(toastError).toHaveBeenCalledWith('Import could not load. Reload the page and try again.');
    expect(toastError).not.toHaveBeenCalledWith('Failed to import file. Please check the file format.');
    expect(reloadFromStorage).not.toHaveBeenCalled();
    expect(result.current.importProgress).toBeNull();
  });
});
