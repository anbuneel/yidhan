/**
 * Issue #288: leaving a note saves what was on screen, under that note's own id.
 *
 * These tests render NoteEditorView, the way App does, inside a small parent that keeps
 * the notes list like `useNoteActions`: an optimistic copy on save, rolled back on failure.
 */
import { StrictMode, Suspense, startTransition, useCallback, useRef, useState, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NoteEditorView } from './NoteEditorView';
import { Editor } from './Editor';
import { resetNoteSaveQueue } from '../stores/noteSaveQueue';
import { heldSaves, resetHeldSaves } from '../stores/heldSaves';
import { createMockNote } from '../test/factories';
import { useAuth } from '../contexts/AuthContext';
import type { Note } from '../types';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../utils/keepReleasedDraft', () => ({ keepReleasedDraft: vi.fn() }));
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
  copyNoteToClipboard: vi.fn().mockResolvedValue(undefined),
  copyNoteWithFormatting: vi.fn().mockResolvedValue(undefined),
}));

const noteA = createMockNote({ id: 'note-a', title: 'Note A', content: '<p>A words</p>', syncStatus: 'synced' });
const noteB = createMockNote({ id: 'note-b', title: 'Note B', content: '<p>B words</p>', syncStatus: 'synced' });

type Save = (note: Note) => Promise<void>;

interface HarnessApi {
  open: (id: string | null, opts?: { transition?: boolean }) => void;
  setNotes: (update: (prev: Note[]) => Note[]) => void;
  release: (released: boolean) => void;
}

function Harness({ save, api, initial = [noteA, noteB], suspendOn }: {
  save: Save;
  api: { current: HarnessApi | null };
  initial?: Note[];
  /** A note id whose screen suspends forever, to hold a transition pending. */
  suspendOn?: string;
}) {
  const [notes, setNotes] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(initial[0].id);
  const [released, setReleased] = useState(false);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // As useNoteActions: optimistic copy first, then the write, rolled back on failure.
  const onUpdate = useCallback(async (updated: Note) => {
    const previous = notesRef.current.find((n) => n.id === updated.id);
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? { ...updated, syncStatus: 'pending' } : n)));
    try {
      await save(updated);
    } catch (error) {
      if (previous) setNotes((prev) => prev.map((n) => (n.id === updated.id ? previous : n)));
      throw error;
    }
  }, [save]);

  api.current = {
    open: (id, opts) => (opts?.transition ? startTransition(() => setOpenId(id)) : act(() => setOpenId(id))),
    setNotes: (update) => setNotes(update),
    release: (value) => setReleased(value),
  };

  const note = notes.find((n) => n.id === openId);
  return (
    <Suspense fallback={<div>loading</div>}>
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
          releasedElsewhere={released}
          loadedEditor={Editor}
        />
      ) : (
        <div>library</div>
      )}
      {suspendOn && openId === suspendOn && <Suspender />}
    </Suspense>
  );
}

const never = new Promise<never>(() => {});
function Suspender(): never {
  throw never;
}

function titleInput() {
  return screen.getByPlaceholderText('Untitled') as HTMLTextAreaElement;
}

function type(value: string) {
  fireEvent.change(titleInput(), { target: { value } });
}

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe('leaving a note (issue #288)', () => {
  let api: { current: HarnessApi | null };

  beforeEach(() => {
    api = { current: null };
    resetNoteSaveQueue();
    resetHeldSaves();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves the leaving note under its own id when switching inside the debounce', async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} api={api} />);
    type('A, last words');
    await act(async () => { vi.advanceTimersByTime(300); });

    api.current!.open('note-b');
    await flush();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-a', title: 'A, last words' }));
    expect(titleInput().value).toBe('Note B');
    // B stays clean: nothing of A's is written under B's id.
    await act(async () => { vi.advanceTimersByTime(11_000); });
    expect(save).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'note-b' }));
  });

  it('saves the note when the editor closes inside the debounce', async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} api={api} />);
    type('Closing now');
    api.current!.open(null);
    await flush();
    expect(screen.getByText('library')).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-a', title: 'Closing now' }));
  });

  it('retries a "Not saved" draft when leaving it with no new keystrokes', async () => {
    const save = vi.fn<Save>().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined);
    render(<Harness save={save} api={api} />);
    type('Failed once');
    await act(async () => { vi.advanceTimersByTime(800); });
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent('Not saved');

    api.current!.open('note-b');
    await flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'note-a', title: 'Failed once' }));
  });

  it('shows the newest text on A to B to A while the save is still pending', async () => {
    const save = vi.fn<Save>().mockImplementation(() => new Promise(() => {}));
    render(<Harness save={save} api={api} />);
    type('Newest A');
    api.current!.open('note-b');
    await flush();
    api.current!.open('note-a');
    await flush();
    expect(titleInput().value).toBe('Newest A');
  });

  it('does not revert typing while a switch is suspended', async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} api={api} suspendOn="note-b" />);
    await act(async () => { api.current!.open('note-b', { transition: true }); });
    // The switch is pending: A is still on screen and the writer keeps typing.
    expect(titleInput().value).toBe('Note A');
    type('Still typing on A');
    await flush();
    expect(titleInput().value).toBe('Still typing on A');
    type('Still typing on A, more');
    await flush();
    expect(titleInput().value).toBe('Still typing on A, more');
  });

  it('saves exactly once on leave under StrictMode', async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<StrictMode><Harness save={save} api={api} /></StrictMode>);
    type('Strict words');
    api.current!.open('note-b');
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-a', title: 'Strict words' }));
  });

  it('saves nothing on a clean switch, under StrictMode too', async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<StrictMode><Harness save={save} api={api} /></StrictMode>);
    api.current!.open('note-b');
    await flush();
    api.current!.open(null);
    await flush();
    expect(save).not.toHaveBeenCalled();
  });

  it('saves nothing for a note released elsewhere', async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} api={api} />);
    type('Released words');
    act(() => api.current!.release(true));
    api.current!.open(null);
    await flush();
    expect(save).not.toHaveBeenCalled();
  });

  it('saves nothing for a note the writer deleted', async () => {
    const save = vi.fn<Save>().mockRejectedValue(new Error('offline'));
    render(<Harness save={save} api={api} />);
    type('Delete these');
    fireEvent.click(screen.getByLabelText('Delete note'));
    fireEvent.click(screen.getByRole('button', { name: 'Let it fade' }));
    await flush();
    const callsBeforeLeave = save.mock.calls.length;
    api.current!.open(null);
    await flush();
    expect(save.mock.calls.length).toBe(callsBeforeLeave);
  });

  it('does not save an empty draft over a note that had words', async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} api={api} />);
    type('');
    fireEvent.change(screen.getByTestId('editor-content'), { target: { value: '<p></p>' } });
    api.current!.open(null);
    await flush();
    expect(save).not.toHaveBeenCalled();
  });

  it('applies a real remote edit after a remount instead of taking it for an echo', async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} api={api} />);
    type('Mine');
    api.current!.open('note-b');
    await flush();
    api.current!.open('note-a');
    await flush();
    expect(titleInput().value).toBe('Mine');
    // Another device writes A while it is open and clean.
    act(() => api.current!.setNotes((prev) => prev.map((n) => (n.id === 'note-a' ? { ...n, title: 'From the laptop' } : n))));
    expect(titleInput().value).toBe('From the laptop');
  });

  it('keeps the 800ms debounce and the 10s checkpoint for a note that stays', async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} api={api} />);
    type('Debounced');
    await act(async () => { vi.advanceTimersByTime(700); });
    expect(save).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(100); });
    expect(save).toHaveBeenCalledTimes(1);

    save.mockClear();
    for (let i = 0; i < 20; i++) {
      type('Draft ' + i);
      await act(async () => { vi.advanceTimersByTime(500); });
    }
    // Continuous typing never lets the debounce fire; only the 10s checkpoint saves.
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/^Draft 1\d$/) }));
  });

  it('reopens with words still queued behind a slow save, and never types over them', async () => {
    let finishFirst!: () => void;
    const save = vi.fn<Save>()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }))
      .mockResolvedValue(undefined);
    render(<Harness save={save} api={api} />);
    type('first');
    await act(async () => { vi.advanceTimersByTime(800); });
    type('first second');
    api.current!.open('note-b');
    await flush();
    api.current!.open('note-a');
    await flush();
    // "second" is waiting behind the first save, but it is on screen.
    expect(titleInput().value).toBe('first second');
    type('first second third');
    await act(async () => { finishFirst(); });
    await flush();
    await act(async () => { vi.advanceTimersByTime(800); });
    await flush();
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'note-a', title: 'first second third' }));
    expect(screen.queryByText(/another device/i)).not.toBeInTheDocument();
  });

  it('holds the words of a released note left by a route change', async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} api={api} />);
    type('Words on a released note');
    act(() => api.current!.release(true));
    api.current!.open(null);
    await flush();
    expect(save).not.toHaveBeenCalled();
    expect(heldSaves.getSnapshot()).toEqual([
      expect.objectContaining({ noteId: 'note-a', title: 'Words on a released note' }),
    ]);
  });

  it('keeps the newest held words of a released note when an older save fails late', async () => {
    let failFirst!: () => void;
    const save = vi.fn<Save>().mockImplementationOnce(
      () => new Promise<void>((_, reject) => { failFirst = () => reject(new Error('gone')); }),
    );
    render(<Harness save={save} api={api} />);
    type('first');
    await act(async () => { vi.advanceTimersByTime(800); });
    type('first second');
    act(() => api.current!.release(true));
    api.current!.open(null);
    await flush();
    await act(async () => { failFirst(); });
    await flush();
    expect(heldSaves.getSnapshot()).toEqual([expect.objectContaining({ title: 'first second' })]);
  });

  it('keeps a released note\'s newer held words when an older save succeeds late', async () => {
    let finishFirst!: () => void;
    const save = vi.fn<Save>().mockImplementationOnce(
      () => new Promise<void>((resolve) => { finishFirst = resolve; }),
    );
    render(<Harness save={save} api={api} />);
    type('first');
    await act(async () => { vi.advanceTimersByTime(800); });
    type('first second');
    act(() => api.current!.release(true));
    api.current!.open(null);
    await flush();
    await act(async () => { finishFirst(); });
    await flush();
    expect(heldSaves.getSnapshot()).toEqual([expect.objectContaining({ title: 'first second' })]);
  });

  it('holds nothing for a released note the writer let go', async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} api={api} />);
    type('Let these go');
    act(() => api.current!.release(true));
    fireEvent.click(screen.getByRole('button', { name: 'Let go' }));
    await flush();
    expect(save).not.toHaveBeenCalled();
    expect(heldSaves.getSnapshot()).toEqual([]);
  });

  it('saves an image-only draft on leave: it is not blank', async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} api={api} />);
    type('');
    fireEvent.change(screen.getByTestId('editor-content'), { target: { value: '<p><img src="x.png"></p>' } });
    api.current!.open(null);
    await flush();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-a', content: '<p><img src="x.png"></p>' }));
  });

  it('does not write or hold a save that waited past a vault lock', async () => {
    let finishFirst!: () => void;
    const save = vi.fn<Save>()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }))
      .mockRejectedValue(new Error('offline'));
    render(<Harness save={save} api={api} />);
    type('first');
    await act(async () => { vi.advanceTimersByTime(800); });
    type('first second');
    api.current!.open(null);
    // The vault locks and opens again while "second" waits.
    heldSaves.close();
    heldSaves.open();
    await act(async () => { finishFirst(); });
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(heldSaves.getSnapshot()).toEqual([]);
  });

  it('never shows Synced for the reopened note before the server confirms it', async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} api={api} />);
    type('Pending words');
    api.current!.open('note-b');
    await flush();
    api.current!.open('note-a');
    await flush();
    expect(screen.queryByText('Synced')).not.toBeInTheDocument();
  });
});
