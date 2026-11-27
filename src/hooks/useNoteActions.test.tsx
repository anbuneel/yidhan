import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNoteActions, type UseNoteActionsOptions } from './useNoteActions';
import { VaultLockedSaveError } from '../utils/saveErrors';
import { createMockNote } from '../test/factories';
import type { DerivedKeys } from '../lib/encryption';

const updateEncryptedNote = vi.hoisted(() => vi.fn());
vi.mock('../services/encryptedNotes', () => ({ updateEncryptedNote }));
vi.mock('../services/offlineNotes', () => ({
  softDeleteNoteOffline: vi.fn(),
  restoreNoteOffline: vi.fn(),
  toggleNotePinOffline: vi.fn(),
}));

describe('useNoteActions', () => {
  it('fails closed when an older render\'s save runs after the vault locked (issue #288)', async () => {
    const note = createMockNote({ id: 'note-a' });
    const options: UseNoteActionsOptions = {
      userId: 'user-1',
      keys: {} as DerivedKeys,
      notes: [note],
      notesRef: { current: [note] },
      setNotes: vi.fn(),
      refreshFadedNotesCount: vi.fn(),
      openNoteIdRef: { current: null },
      onOpenNoteClosed: vi.fn(),
      triggerCoalescedSync: vi.fn(),
      applyOptimistic: (_update, write) => write(),
    };
    const { result, rerender } = renderHook((props: UseNoteActionsOptions) => useNoteActions(props), {
      initialProps: options,
    });
    // An Editor unmounting as the vault locks still holds this callback.
    const saveFromEarlierRender = result.current.handleNoteUpdate;
    rerender({ ...options, keys: null });

    await expect(saveFromEarlierRender({ ...note, title: 'After lock' })).rejects.toBeInstanceOf(VaultLockedSaveError);
    expect(updateEncryptedNote).not.toHaveBeenCalled();
  });
});
