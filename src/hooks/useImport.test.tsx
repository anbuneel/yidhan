import { act, renderHook, waitFor } from '@testing-library/react';
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
// Export and backup code are lazy too since shell-size plan A5.
vi.mock('../utils/exportImport', () => {
  throw new Error('Failed to fetch dynamically imported module: /assets/exportImport-old.js');
});
vi.mock('../utils/encryptedBackup', () => {
  throw new Error('Failed to fetch dynamically imported module: /assets/encryptedBackup-old.js');
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

  const hook = () => renderHook(() => useImport({
    userId: 'user-1', keys: {} as DerivedKeys, notes: [], tags: [],
    setTags: vi.fn(), reloadFromStorage: vi.fn(),
  }));

  it('says the export could not load, for JSON and for Markdown', async () => {
    const { result } = hook();
    toastError.mockClear();
    act(() => result.current.handleExportJSON());
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Export could not load. Reload the page and try again.'), { timeout: 3000 });
    toastError.mockClear();
    act(() => result.current.handleExportMarkdown());
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Export could not load. Reload the page and try again.'), { timeout: 3000 });
  });

  it('asks for a backup passphrase without loading code, then says the backup code could not load', async () => {
    const { result } = hook();
    await act(async () => {
      await result.current.handleImportFile(new File(['{}'], 'notes.yidhan'));
    });
    expect(result.current.backupRestore.pendingFile?.name).toBe('notes.yidhan');

    act(() => result.current.backupRestore.onSubmit('a long passphrase'));
    await waitFor(() => expect(result.current.backupRestore.error).toBe(
      'The backup code could not load. Reload the page and try again.'
    ), { timeout: 3000 });
    expect(result.current.backupRestore.isBusy).toBe(false);
  });

  it('turns away an oversized file before loading any code', async () => {
    const { result } = hook();
    toastError.mockClear();
    const big = new File(['x'], 'big.json');
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    await act(async () => {
      await result.current.handleImportFile(big);
    });
    expect(toastError).toHaveBeenCalledWith('File too large. Maximum size is 10MB.');
  });
});
