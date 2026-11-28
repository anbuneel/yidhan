import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DerivedKeys } from '../lib/encryption';
import { heldSaves, resetHeldSaves } from '../stores/heldSaves';
import { useHeldSaveActions } from './useHeldSaveActions';

// The export, import and backup code are lazy chunks (shell-size plan A5). Offline, or
// after a service worker update, their URLs fail. Copy on a held save must not need
// any of them: it is the way out when saving does not work.
const chunkGone = vi.hoisted(() => () => {
  throw new Error('Failed to fetch dynamically imported module: /assets/exportImport-old.js');
});
vi.mock('../utils/exportImport', chunkGone);
vi.mock('../utils/encryptedBackup', chunkGone);
vi.mock('../utils/importFile', chunkGone);

describe('held-save Copy, offline', () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();
  const fetchSpy = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));

  beforeEach(() => {
    resetHeldSaves();
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetHeldSaves();
  });

  it('copies the held words at once, with no network and no lazy chunk', async () => {
    heldSaves.hold(
      {
        key: 'editor-x',
        noteId: 'note-a',
        title: 'Left behind',
        content: '<p>Words that did not save</p>',
        baseTitle: 'Note A',
        baseContent: '<p>A words</p>',
        attemptedAt: 1,
        detail: '',
      },
      heldSaves.session()
    );
    const { result } = renderHook(() =>
      useHeldSaveActions({
        userId: 'user-1',
        keys: {} as DerivedKeys,
        notesRef: { current: [] },
        tags: [],
        setNotes: vi.fn(),
        saveNote: vi.fn(),
        triggerCoalescedSync: vi.fn(),
        hasOpenDraft: () => false,
      })
    );

    await expect(result.current.copy('editor-x')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('Left behind\n\nWords that did not save');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(heldSaves.get('editor-x')).toBeUndefined();
  });
});
