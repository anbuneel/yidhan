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
import { HeldSavesBoundary } from './HeldSavesBoundary';
import { heldSaves, resetHeldSaves, useHeldSaves, type HeldSave } from '../stores/heldSaves';
import { noteSaveQueue, resetNoteSaveQueue } from '../stores/noteSaveQueue';
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
}));
vi.mock('../utils/noteClipboard', () => ({
  copyNoteToClipboard: clipboardMock.copyNoteToClipboard,
  copyNoteWithFormatting: vi.fn().mockResolvedValue(undefined),
}));

const keys = {} as DerivedKeys;
const noteA = createMockNote({ id: 'note-a', title: 'Note A', content: '<p>A words</p>' });
const noteB = createMockNote({ id: 'note-b', title: 'Note B', content: '<p>B words</p>' });

function holdNow(entry: HeldSave) {
  heldSaves.hold(entry, heldSaves.session());
}

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
    hasOpenDraft: () => false,
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

  it('runs one retry per entry, so the words are never kept twice', async () => {
    const save = vi.fn<Save>().mockRejectedValue(new Error('disk full'));
    leaveWithFailedSave(save);
    await flush();
    // The note changed since, so Retry keeps the words as a new note.
    api.current!.setNotes((prev) => prev.map((n) => (n.id === 'note-a' ? { ...n, title: 'Changed' } : n)));
    let finishKeep!: () => void;
    keepMock.keepReleasedDraft.mockImplementation(() => new Promise((resolve) => {
      finishKeep = () => resolve(createMockNote({ id: 'kept' }));
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await flush();
    // A second Retry cannot start; Copy stays open, since it must not wait on saving.
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled();
    await act(async () => { finishKeep(); });
    await flush();
    expect(keepMock.keepReleasedDraft).toHaveBeenCalledTimes(1);
    expect(notice()).toBeNull();
  });

  it('says so when Retry fails again', async () => {
    const save = vi.fn<Save>().mockRejectedValue(new Error('disk full'));
    leaveWithFailedSave(save);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await flush();
    expect(notice()).toHaveTextContent('Still not saved');
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
  beforeEach(() => {
    resetHeldSaves();
    resetNoteSaveQueue();
  });

  it('replaces an instance\'s earlier entry and keeps other instances\' entries', () => {
    holdNow(heldEntry({ key: 'one', title: 'first' }));
    holdNow(heldEntry({ key: 'two', title: 'other' }));
    holdNow(heldEntry({ key: 'one', title: 'second' }));
    expect(heldSaves.getSnapshot().map((e) => [e.key, e.title])).toEqual([['two', 'other'], ['one', 'second']]);
  });

  it('refuses words from an earlier session even after the store opens again', () => {
    const before = heldSaves.session();
    heldSaves.close();
    heldSaves.open();
    heldSaves.hold(heldEntry(), before);
    expect(heldSaves.getSnapshot()).toEqual([]);
  });

  it('runs two writes for one note in turn, never at once', async () => {
    const events: string[] = [];
    let finishFirst!: () => void;
    const first = noteSaveQueue.run('note-a', () => {
      events.push('first start');
      return new Promise<void>((resolve) => { finishFirst = () => { events.push('first end'); resolve(); }; });
    });
    const second = noteSaveQueue.run('note-a', async () => { events.push('second start'); });
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(['first start']);
    finishFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(['first start', 'first end', 'second start']);
  });

  it('never offers a waiting draft from before a lock to a new Editor', () => {
    noteSaveQueue.setPendingDraft('note-a', { title: 'Before lock', content: '' });
    expect(noteSaveQueue.pendingDraft('note-a')?.title).toBe('Before lock');
    heldSaves.close();
    heldSaves.open();
    expect(noteSaveQueue.pendingDraft('note-a')).toBeUndefined();
  });

  it('releases only the revision it names', () => {
    holdNow(heldEntry({ title: 'v1' }));
    const v1 = heldSaves.get('editor-x')!.revision;
    holdNow(heldEntry({ title: 'v2' }));
    heldSaves.release('editor-x', v1);
    expect(heldSaves.get('editor-x')?.title).toBe('v2');
  });

  it('drops everything on close and takes nothing until opened again', () => {
    holdNow(heldEntry());
    heldSaves.close();
    expect(heldSaves.getSnapshot()).toEqual([]);
    holdNow(heldEntry());
    expect(heldSaves.getSnapshot()).toEqual([]);
    heldSaves.open();
    holdNow(heldEntry());
    expect(heldSaves.getSnapshot()).toHaveLength(1);
  });
});

describe('useLockAfterSaving', () => {
  beforeEach(() => {
    resetHeldSaves();
    resetNoteSaveQueue();
  });

  function setup(retryResult = true) {
    const lockVault = vi.fn();
    const flushEditor = vi.fn().mockResolvedValue(true);
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
    holdNow(heldEntry());
    expect(await result.current.lockNow()).toBe(false);
    expect(lockVault).not.toHaveBeenCalled();
    expect(heldSaves.getSnapshot()).toHaveLength(1);

    act(() => result.current.lockAnyway());
    expect(lockVault).toHaveBeenCalledWith('manual');
    expect(heldSaves.getSnapshot()).toEqual([]);
  });

  it('auto-lock saves first, then drops held words and locks', async () => {
    const { result, lockVault, flushEditor, retry } = setup(false);
    holdNow(heldEntry());
    let locking!: Promise<void>;
    act(() => { locking = result.current.lockVaultAfterSaving('auto-lock'); });
    expect(lockVault).not.toHaveBeenCalled();
    await act(async () => { await locking; });
    expect(flushEditor).toHaveBeenCalled();
    expect(retry).toHaveBeenCalled();
    expect(lockVault).toHaveBeenCalledWith('auto-lock');
    expect(heldSaves.getSnapshot()).toEqual([]);
  });

  it('Lock now waits for a save still running from an Editor already gone', async () => {
    const { result, lockVault } = setup();
    let fail!: () => void;
    const departed = heldSaves.trackSave(new Promise<boolean>((resolve) => {
      fail = () => { holdNow(heldEntry()); resolve(false); };
    }));
    const locking = result.current.lockNow();
    await act(async () => { await Promise.resolve(); });
    expect(lockVault).not.toHaveBeenCalled();
    fail();
    await departed;
    expect(await locking).toBe(false);
    expect(lockVault).not.toHaveBeenCalled();
    expect(heldSaves.getSnapshot()).toHaveLength(1);
  });

  it('auto-lock still locks when a save hangs, and says words were dropped', async () => {
    vi.useFakeTimers();
    try {
      const { result, lockVault } = setup();
      holdNow(heldEntry());
      heldSaves.trackSave(new Promise<boolean>(() => {}));
      act(() => { void result.current.lockVaultAfterSaving('auto-lock'); });
      // A second idle tick while saving does not start another round.
      act(() => { void result.current.lockVaultAfterSaving('auto-lock'); });
      await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
      expect(lockVault).toHaveBeenCalledTimes(1);
      expect(lockVault).toHaveBeenCalledWith('auto-lock');
      expect(heldSaves.getSnapshot()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Lock now gives up after the time limit and keeps the vault open', async () => {
    vi.useFakeTimers();
    try {
      const { result, lockVault } = setup();
      heldSaves.trackSave(new Promise<boolean>(() => {}));
      const locking = result.current.lockNow();
      await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
      expect(await locking).toBe(false);
      expect(lockVault).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('sign-out drops held words and locks at once', () => {
    const { result, lockVault, flushEditor } = setup();
    holdNow(heldEntry());
    act(() => { void result.current.lockVaultAfterSaving('sign-out'); });
    expect(lockVault).toHaveBeenCalledWith('sign-out');
    expect(flushEditor).not.toHaveBeenCalled();
    expect(heldSaves.getSnapshot()).toEqual([]);
  });
});

describe('HeldSavesBoundary', () => {
  it('says words are not saved when the notice cannot load', async () => {
    function Broken(): never {
      throw new Error('Failed to fetch dynamically imported module');
    }
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const lockAnyway = vi.fn();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      resetHeldSaves();
      holdNow(heldEntry({ title: 'Kept words', content: '<p>Body</p>' }));
      const { rerender } = render(<HeldSavesBoundary onLockAnyway={lockAnyway}><Broken /></HeldSavesBoundary>);
      expect(screen.getByRole('alert')).toHaveTextContent('Some words are not saved');
      // The words can still be taken out, and the vault can still be locked.
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Kept words'));
      expect(await screen.findByText(/Copied\./)).toBeInTheDocument();
      // Newer words held after the copy: no longer "Copied".
      holdNow(heldEntry({ key: 'editor-y', title: 'Newer' }));
      rerender(<HeldSavesBoundary onLockAnyway={lockAnyway}><Broken /></HeldSavesBoundary>);
      expect(screen.queryByText(/Copied\./)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Lock anyway' }));
      expect(lockAnyway).toHaveBeenCalled();
    } finally {
      vi.mocked(console.error).mockRestore();
    }
  });
});
