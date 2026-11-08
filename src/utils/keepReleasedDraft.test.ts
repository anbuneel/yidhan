import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DerivedKeys } from '../lib/encryption';
import { createMockNote, createMockTag } from '../test/factories';

const mocks = vi.hoisted(() => ({
  createEncryptedNote: vi.fn(),
  addTagToNoteOffline: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('../services/encryptedNotes', () => ({ createEncryptedNote: mocks.createEncryptedNote }));
vi.mock('../services/offlineNotes', () => ({ addTagToNoteOffline: mocks.addTagToNoteOffline }));
vi.mock('react-hot-toast', () => ({ default: mocks.toast }));

import { keepReleasedDraft } from './keepReleasedDraft';

const KEYS = {} as DerivedKeys;
const work = createMockTag({ id: 'work', name: 'Work' });
const gone = createMockTag({ id: 'gone', name: 'Gone' });

describe('keepReleasedDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createEncryptedNote.mockImplementation(async (_u, title: string, content: string, _k, pinned: boolean) =>
      createMockNote({ id: 'kept', title, content, pinned, tags: [] }));
    mocks.addTagToNoteOffline.mockResolvedValue(undefined);
  });

  it('writes the draft into a new note with the released pin and live tags', async () => {
    const released = createMockNote({ id: 'released', pinned: true, tags: [work] });
    const result = await keepReleasedDraft('u', KEYS, 'Draft', '<p>Words</p>', released, [work]);
    expect(mocks.createEncryptedNote).toHaveBeenCalledWith('u', 'Draft', '<p>Words</p>', KEYS, true);
    expect(mocks.addTagToNoteOffline).toHaveBeenCalledWith('u', 'kept', 'work');
    expect(result).toMatchObject({ id: 'kept', tags: [work] });
    expect(mocks.toast).toHaveBeenCalledWith('Kept as a new note.');
  });

  it('never writes to the released note', async () => {
    const released = createMockNote({ id: 'released', tags: [work] });
    await keepReleasedDraft('u', KEYS, 'Draft', '', released, [work]);
    expect(mocks.addTagToNoteOffline).not.toHaveBeenCalledWith('u', 'released', expect.anything());
  });

  it('skips tags that no longer exist and says so', async () => {
    const released = createMockNote({ tags: [work, gone] });
    const result = await keepReleasedDraft('u', KEYS, 'Draft', '', released, [work]);
    expect(mocks.addTagToNoteOffline).toHaveBeenCalledTimes(1);
    expect(result.tags).toEqual([work]);
    expect(mocks.toast).toHaveBeenCalledWith('Kept as a new note. Some of its tags are gone.');
  });

  it('keeps the note when a tag fails to attach', async () => {
    mocks.addTagToNoteOffline.mockRejectedValue(new Error('disk'));
    const released = createMockNote({ tags: [work] });
    const result = await keepReleasedDraft('u', KEYS, 'Draft', '', released, [work]);
    expect(result.id).toBe('kept');
    expect(mocks.toast).toHaveBeenCalledWith('Kept as a new note. Some of its tags are gone.');
  });

  it('rejects when the note cannot be written, so the editor keeps the draft', async () => {
    mocks.createEncryptedNote.mockRejectedValue(new Error('locked'));
    await expect(keepReleasedDraft('u', KEYS, 'Draft', '', undefined, [])).rejects.toThrow('locked');
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('refuses without a user or an open vault, before writing anything', async () => {
    await expect(keepReleasedDraft(undefined, KEYS, 'Draft', '', undefined, [])).rejects.toThrow('signed-in');
    await expect(keepReleasedDraft('u', null, 'Draft', '', undefined, [])).rejects.toThrow();
    expect(mocks.createEncryptedNote).not.toHaveBeenCalled();
  });
});
