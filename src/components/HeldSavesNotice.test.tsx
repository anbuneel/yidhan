/**
 * Issue #288: a save that fails after the writer left the note is held above the
 * Editor, shown with Retry and Copy, and Retry never overwrites newer text.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { NoteEditorView } from './NoteEditorView';
import { Editor } from './Editor';
import { HeldSavesNotice } from './HeldSavesNotice';
import { heldSaves, resetHeldSaves, useHeldSaves, type HeldSave } from '../stores/heldSaves';
import { resetNoteSaveQueue } from '../stores/noteSaveQueue';
import { useHeldSaveActions } from '../hooks/useHeldSaveActions';
import { useLockAfterSaving } from '../hooks/useLockAfterSaving';
import { retryHeldSave } from '../utils/retryHeldSave';
import { VaultLockedSaveError } from '../utils/saveErrors';
import { createMockNote } from '../test/factories';
import { useAuth } from '../contexts/AuthContext';
import type { DerivedKeys } from '../lib/encryption';
import type { Note } from '../types';

const keepMock = vi.hoisted(() => ({ keepReleasedDraft: vi.fn() }));
const clipboardMock = vi.hoisted(() => ({ copyNoteToClipboard: vi.fn() }));

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../utils/keepReleasedDraft', () => keepMock);
vi.mock('./RichTextEditor', () => ({
  RichTextEditor: ({ content, onChange }: { content: string; onChange: (c: string) => void }) => (
    <textarea data-testid="editor-content" value={content} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock('./EditorSidebar', () => ({ EditorSidebar: () => null }));
vi.mock('./EditorToolbar', () => ({ EditorToolbar: () => null }));
vi.mock('./TagSelector', () => ({ TagSelector: () => null }));
vi.mock('./WhisperBack', () => ({ WhisperBack: () => null }));
vi.mock('./ShareModal', () => ({ ShareModal: () => null }));
vi.mock('./HeaderShell', () => ({
  HeaderShell: ({ leftContent, rightActions }: { leftContent?: ReactNode; rightActions?: ReactNode }) => (
    <div>{leftContent}{rightActions}</div>
  ),
}));
vi.mock('../utils/exportImport', () => ({
  exportNoteToMarkdown: vi.fn().mockReturnValue('# Test'),
  getSanitizedFilename: vi.fn().mockReturnValue('test'),
  downloadFile: vi.fn(),
  copyNoteToClipboard: clipboardMock.copyNoteToClipboard,
  copyNoteWithFormatting: vi.fn().mockResolvedValue(undefined),
}));

const keys = {} as DerivedKeys;
const noteA = createMockNote({ id: 'note-a', title: 'Note A', content: '<p>A words</p>' });
const noteB = createMockNote({ id: 'note-b', title: 'Note B', content: '<p>B words</p>' });

function heldEntry(overrides: Partial<HeldSave> = {}): HeldSave {
  return {
    key: 'editor-x',
    noteId: 'note-a',
    title: 'Held title',
    content: '<p>Held words</p>',
    baseTitle: 'Note A',
    baseContent: '<p>A words</p>',
    attemptedAt: 1,
    detail: '',
    ...overrides,
  };
}

type Save = (note: Note) => Promise<void>;

interface HarnessApi {
  open: (id: string | null) => void;
  setNotes: (update: (prev: Note[]) => Note[]) => void;
  notes: () => Note[];
}

/** NoteEditorView plus the held-save notice, wired the way App wires them. */
function Harness({ save, api }: { save: Save; api: { current: HarnessApi | null } }) {
  const [notes, setNotes] = useState([noteA, noteB]);
  const [openId, setOpenId] = useState<string | null>('note-a');
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const onUpdate = useCallback(async (updated: Note) => {
    const previous = notesRef.current.find((n) => n.id === updated.id);
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    try {
      await save(updated);
    } catch (error) {
      if (previous) setNotes((prev) => prev.map((n) => (n.id === updated.id ? previous : n)));
      throw error;
    }
  }, [save]);
  const entries = useHeldSaves();
  const actions = useHeldSaveActions({
    userId: 'user-1',
    keys,
    notesRef,
    tags: [],
    setNotes,
    saveNote: onUpdate,
    triggerCoalescedSync: vi.fn(),
    trackLocalWrite: (write) => write(),
  });
  api.current = {
    open: (id) => act(() => setOpenId(id)),
    setNotes: (update) => act(() => setNotes(update)),
    notes: () => notesRef.current,
  };
  const note = notes.find((n) => n.id === openId);
  return (
    <>
      {note ? (
        <NoteEditorView
          note={note}
          tags={[]}
          userId="user-1"
          theme="dark"
          onBack={() => setOpenId(null)}
          onRequestSearch={vi.fn()}
          onUpdate={onUpdate}
          onDelete={vi.fn().mockResolvedValue(true)}
          onToggleTag={vi.fn()}
          onCreateTag={vi.fn()}
          onThemeToggle={vi.fn()}
          onSettingsClick={vi.fn()}
          loadedEditor={Editor}
        />
      ) : (
        <div>library</div>
      )}
      <HeldSavesNotice
        entries={entries}
        onRetry={async (key) => { await actions.retry(key); }}
        onCopy={actions.copy}
      />
    </>
  );
}

async function flush() {
  await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });
}

function notice() {
  return screen.queryByTestId('held-saves-notice');
}

describe('held saves (issue #288)', () => {
  let api: { current: HarnessApi | null };

  beforeEach(() => {
    api = { current: null };
    resetHeldSaves();
    resetNoteSaveQueue();
    keepMock.keepReleasedDraft.mockReset();
    clipboardMock.copyNoteToClipboard.mockReset().mockResolvedValue(undefined);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function leaveWithFailedSave(save: ReturnType<typeof vi.fn<Save>>) {
    render(<Harness save={save} api={api} />);
    fireEvent.change(screen.getByPlaceholderText('Untitled'), { target: { value: 'Left behind' } });
    api.current!.open(null);
  }

  it('shows the notice when a save fails after the editor closed', async () => {
    const save = vi.fn<Save>().mockRejectedValue(new Error('disk full'));
    leaveWithFailedSave(save);
    await flush();
    expect(screen.getByText('library')).toBeInTheDocument();
    expect(notice()).toHaveTextContent('Not saved: Left behind');
    expect(heldSaves.getSnapshot()).toEqual([
      expect.objectContaining({ noteId: 'note-a', title: 'Left behind', baseTitle: 'Note A' }),
    ]);
    // The list was rolled back, so the library shows the stored copy, not a lie.
    expect(api.current!.notes().find((n) => n.id === 'note-a')?.title).toBe('Note A');
  });

  it('keeps showing the notice on the next note', async () => {
    const save = vi.fn<Save>().mockRejectedValue(new Error('disk full'));
    render(<Harness save={save} api={api} />);
    fireEvent.change(screen.getByPlaceholderText('Untitled'), { target: { value: 'Left behind' } });
    api.current!.open('note-b');
    await flush();
    expect((screen.getByPlaceholderText('Untitled') as HTMLTextAreaElement).value).toBe('Note B');
    expect(notice()).toHaveTextContent('Not saved: Left behind');
  });

  it('Retry saves over the note when nothing changed since', async () => {
    const save = vi.fn<Save>().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined);
    leaveWithFailedSave(save);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await flush();
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'note-a', title: 'Left behind' }));
    expect(keepMock.keepReleasedDraft).not.toHaveBeenCalled();
    expect(notice()).toBeNull();
  });

  it('Retry after newer edits keeps both, as a new note', async () => {
    const save = vi.fn<Save>().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined);
    leaveWithFailedSave(save);
    await flush();
    // The writer reopens A, which shows the stored copy, and writes something new.
    api.current!.open('note-a');
    fireEvent.change(screen.getByPlaceholderText('Untitled'), { target: { value: 'Newer A' } });
    await act(async () => { vi.advanceTimersByTime(800); });
    await flush();
    expect(api.current!.notes().find((n) => n.id === 'note-a')?.title).toBe('Newer A');
    // A save from the new editor does not clear words it never had.
    expect(notice()).toHaveTextContent('Not saved: Left behind');

    const kept = createMockNote({ id: 'kept', title: 'Left behind' });
    keepMock.keepReleasedDraft.mockResolvedValue(kept);
    save.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await flush();
    expect(save).not.toHaveBeenCalled();
    expect(keepMock.keepReleasedDraft).toHaveBeenCalledWith('user-1', keys, 'Left behind', '<p>A words</p>', expect.objectContaining({ id: 'note-a' }), []);
    expect(api.current!.notes().find((n) => n.id === 'note-a')?.title).toBe('Newer A');
    expect(api.current!.notes().map((n) => n.id)).toContain('kept');
    expect(notice()).toBeNull();
  });

  it('a later save from the same editor clears its held words', async () => {
    let fail!: (e: Error) => void;
    const save = vi.fn<Save>()
      .mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }))
      .mockResolvedValue(undefined);
    render(<Harness save={save} api={api} />);
    fireEvent.change(screen.getByPlaceholderText('Untitled'), { target: { value: 'v1' } });
    await act(async () => { vi.advanceTimersByTime(800); });
    fireEvent.change(screen.getByPlaceholderText('Untitled'), { target: { value: 'v2' } });
    // Leave while v1 is in flight: the leave save waits behind it.
    api.current!.open(null);
    await act(async () => { fail(new Error('offline')); });
    await flush();
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'note-a', title: 'v2' }));
    expect(notice()).toBeNull();
  });

  it('Copy puts the words on the clipboard and then drops them', async () => {
    const save = vi.fn<Save>().mockRejectedValue(new Error('disk full'));
    leaveWithFailedSave(save);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await flush();
    expect(clipboardMock.copyNoteToClipboard).toHaveBeenCalledWith(expect.objectContaining({ title: 'Left behind' }));
    expect(notice()).toBeNull();
  });

  it('keeps the words when Copy fails', async () => {
    clipboardMock.copyNoteToClipboard.mockRejectedValue(new Error('denied'));
    const save = vi.fn<Save>().mockRejectedValue(new Error('disk full'));
    leaveWithFailedSave(save);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await flush();
    expect(notice()).toHaveTextContent('Could not copy');
    expect(heldSaves.getSnapshot()).toHaveLength(1);
  });

  it('does not hold words when the save failed because the vault locked', async () => {
    const save = vi.fn<Save>().mockRejectedValue(new VaultLockedSaveError());
    leaveWithFailedSave(save);
    await flush();
    expect(notice()).toBeNull();
  });
});

describe('retryHeldSave', () => {
  const saveOver = vi.fn<(note: Note) => Promise<void>>();
  const keepAsCopy = vi.fn<(entry: HeldSave, current: Note | undefined) => Promise<void>>();

  beforeEach(() => {
    saveOver.mockReset().mockResolvedValue(undefined);
    keepAsCopy.mockReset().mockResolvedValue(undefined);
  });

  it('does nothing when the note already holds the words', async () => {
    const current = { ...noteA, title: 'Held title', content: '<p>Held words</p>' };
    expect(await retryHeldSave(heldEntry(), { current, saveOver, keepAsCopy })).toBe('already-saved');
    expect(saveOver).not.toHaveBeenCalled();
    expect(keepAsCopy).not.toHaveBeenCalled();
  });

  it('saves over an unchanged note', async () => {
    expect(await retryHeldSave(heldEntry(), { current: noteA, saveOver, keepAsCopy })).toBe('saved');
    expect(saveOver).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-a', title: 'Held title' }));
  });

  it.each([
    ['changed since', { ...noteA, content: '<p>Newer</p>' }],
    ['locked on this device', { ...noteA, decryptionFailed: true } as Note],
    ['deleted', { ...noteA, deletedAt: new Date() }],
    ['gone', undefined],
  ])('keeps both when the note was %s', async (_case, current) => {
    expect(await retryHeldSave(heldEntry(), { current, saveOver, keepAsCopy })).toBe('kept-as-copy');
    expect(saveOver).not.toHaveBeenCalled();
    expect(keepAsCopy).toHaveBeenCalledTimes(1);
  });
});

describe('heldSaves store', () => {
  beforeEach(() => resetHeldSaves());

  it('replaces an instance\'s earlier entry and keeps other instances\' entries', () => {
    heldSaves.hold(heldEntry({ key: 'one', title: 'first' }));
    heldSaves.hold(heldEntry({ key: 'two', title: 'other' }));
    heldSaves.hold(heldEntry({ key: 'one', title: 'second' }));
    expect(heldSaves.getSnapshot().map((e) => [e.key, e.title])).toEqual([['two', 'other'], ['one', 'second']]);
  });

  it('drops everything on close and takes nothing until opened again', () => {
    heldSaves.hold(heldEntry());
    heldSaves.close();
    expect(heldSaves.getSnapshot()).toEqual([]);
    heldSaves.hold(heldEntry());
    expect(heldSaves.getSnapshot()).toEqual([]);
    heldSaves.open();
    heldSaves.hold(heldEntry());
    expect(heldSaves.getSnapshot()).toHaveLength(1);
  });
});

describe('useLockAfterSaving', () => {
  beforeEach(() => resetHeldSaves());

  function setup(retryResult = true) {
    const lockVault = vi.fn();
    const flushEditor = vi.fn().mockResolvedValue(undefined);
    heldSaves.registerFlusher(flushEditor);
    const { result } = renderHook(() => useLockAfterSaving(lockVault));
    const retry = vi.fn().mockResolvedValue(retryResult);
    result.current.retryHeldSavesRef.current = retry;
    return { result, lockVault, flushEditor, retry };
  }

  it('Lock now saves first, then locks', async () => {
    const { result, lockVault, flushEditor, retry } = setup();
    expect(await result.current.lockNow()).toBe(true);
    expect(flushEditor).toHaveBeenCalled();
    expect(retry).toHaveBeenCalled();
    expect(lockVault).toHaveBeenCalledWith('manual');
  });

  it('Lock now keeps the vault open while words are held', async () => {
    const { result, lockVault } = setup(false);
    heldSaves.hold(heldEntry());
    expect(await result.current.lockNow()).toBe(false);
    expect(lockVault).not.toHaveBeenCalled();
    expect(heldSaves.getSnapshot()).toHaveLength(1);

    act(() => result.current.lockAnyway());
    expect(lockVault).toHaveBeenCalledWith('manual');
    expect(heldSaves.getSnapshot()).toEqual([]);
  });

  it('auto-lock saves first, then drops held words and locks', async () => {
    const { result, lockVault, flushEditor, retry } = setup(false);
    heldSaves.hold(heldEntry());
    act(() => result.current.lockVaultAfterSaving('auto-lock'));
    expect(lockVault).not.toHaveBeenCalled();
    await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });
    expect(flushEditor).toHaveBeenCalled();
    expect(retry).toHaveBeenCalled();
    expect(lockVault).toHaveBeenCalledWith('auto-lock');
    expect(heldSaves.getSnapshot()).toEqual([]);
  });

  it('sign-out drops held words and locks at once', () => {
    const { result, lockVault, flushEditor } = setup();
    heldSaves.hold(heldEntry());
    act(() => result.current.lockVaultAfterSaving('sign-out'));
    expect(lockVault).toHaveBeenCalledWith('sign-out');
    expect(flushEditor).not.toHaveBeenCalled();
    expect(heldSaves.getSnapshot()).toEqual([]);
  });
});
