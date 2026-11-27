/**
 * Undo after a remote update (issue #284). These run the real Tiptap editor, because
 * the bug lives in its undo history: a remote update applied with `setContent` used
 * to record an undo step, so undo brought back the text another device had replaced
 * and autosave wrote it over that device's edit.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { Editor } from './Editor';
import { resetNoteSaveQueue } from '../stores/noteSaveQueue';
import { resetHeldSaves } from '../stores/heldSaves';
import { createMockNote } from '../test/factories';
import { useAuth } from '../contexts/AuthContext';
import type { Note } from '../types';

const tiptap = vi.hoisted(() => ({ current: null as TiptapEditor | null }));
const keep = vi.hoisted(() => ({ keepReleasedDraft: vi.fn() }));

vi.mock('./RichTextEditor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./RichTextEditor')>();
  type Props = Parameters<typeof actual.RichTextEditor>[0];
  return {
    RichTextEditor: (props: Props) => (
      <actual.RichTextEditor
        {...props}
        onEditorReady={(editor: TiptapEditor) => {
          tiptap.current = editor;
          props.onEditorReady?.(editor);
        }}
      />
    ),
  };
});
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../utils/keepReleasedDraft', () => keep);
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
  copyNoteToClipboard: vi.fn().mockResolvedValue(undefined),
  copyNoteWithFormatting: vi.fn().mockResolvedValue(undefined),
}));

// jsdom has no layout. ProseMirror measures ranges when it scrolls the selection
// into view after the editor's autofocus.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}

const AUTOSAVE_MS = 800;

const base = createMockNote({ id: 'note-1', title: 'Shared', content: '<p>Alpha</p>', syncStatus: 'synced' });

type Save = (note: Note) => Promise<void>;

interface HarnessApi {
  /** Another device's copy of the open note arriving through sync. */
  remote: (content: string) => void;
}

/** As the app: a save updates the list's copy at once, so its echo is the prop. */
function Harness({ save, api, released, onKeptReplacedDraft }: {
  save: Save;
  api: { current: HarnessApi | null };
  released: boolean;
  onKeptReplacedDraft: (note: Note) => void;
}) {
  const [note, setNote] = useState(base);
  const onUpdate = useCallback(async (updated: Note) => {
    setNote(updated);
    await save(updated);
  }, [save]);
  api.current = { remote: (content) => act(() => setNote((prev) => ({ ...prev, content }))) };
  return (
    <Editor
      note={note}
      tags={[]}
      userId="user-1"
      onBack={vi.fn()}
      onRequestSearch={vi.fn()}
      onUpdate={onUpdate}
      onDelete={vi.fn().mockResolvedValue(true)}
      onToggleTag={vi.fn()}
      onCreateTag={vi.fn()}
      theme="dark"
      onThemeToggle={vi.fn()}
      onSettingsClick={vi.fn()}
      releasedElsewhere={released}
      onKeptReplacedDraft={onKeptReplacedDraft}
    />
  );
}

function editor(): TiptapEditor {
  if (!tiptap.current) throw new Error('editor not ready');
  return tiptap.current;
}

/** Types into the editor one character at a time, as a keyboard would. */
function typeText(text: string) {
  act(() => {
    const ed = editor();
    ed.commands.focus('end', { scrollIntoView: false });
    for (const character of text) {
      const { from, to } = ed.state.selection;
      ed.view.dispatch(ed.state.tr.insertText(character, from, to));
    }
  });
}

/** Selects the whole note and types over it, so the undo step starts at position 0. */
function replaceAll(text: string) {
  act(() => {
    const ed = editor();
    ed.commands.selectAll();
    ed.view.dispatch(ed.state.tr.insertText(text));
  });
}

function undo() {
  act(() => {
    editor().commands.undo();
  });
}

async function autosave() {
  await act(async () => { vi.advanceTimersByTime(AUTOSAVE_MS + 50); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

/** Moves past ProseMirror's undo grouping window, so the next typing is its own step. */
async function pause() {
  await act(async () => { vi.advanceTimersByTime(1000); });
}

function savedContents(save: Mock<Save>) {
  return save.mock.calls.map(([n]) => n.content);
}

describe('undo after a remote update (issue #284)', () => {
  let api: { current: HarnessApi | null };
  let save: Mock<Save>;
  let onKeptReplacedDraft: Mock<(note: Note) => void>;
  const keptCopy = createMockNote({ id: 'note-copy', title: 'Shared (my version)', content: '<p>Alpha unsaved</p>' });

  async function mount(released = false) {
    render(<Harness save={save} api={api} released={released} onKeptReplacedDraft={onKeptReplacedDraft} />);
    await waitFor(() => expect(tiptap.current).not.toBeNull());
  }

  beforeEach(() => {
    tiptap.current = null;
    api = { current: null };
    save = vi.fn<Save>().mockResolvedValue(undefined);
    onKeptReplacedDraft = vi.fn();
    keep.keepReleasedDraft.mockReset().mockResolvedValue(keptCopy);
    resetNoteSaveQueue();
    resetHeldSaves();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the remote text when undo is pressed after a remote update to a clean editor', async () => {
    await mount();

    api.current!.remote('<p>Remote words</p>');
    expect(editor().getText()).toBe('Remote words');

    undo();
    await autosave();

    expect(editor().getText()).toBe('Remote words');
    expect(save).not.toHaveBeenCalled();
  });

  it('does not bring back the writer\'s saved text that a remote update replaced', async () => {
    await mount();

    typeText(' mine');
    await autosave();
    expect(savedContents(save)).toEqual(['<p>Alpha mine</p>']);
    api.current!.remote('<p>Remote words</p>');
    expect(editor().getText()).toBe('Remote words');

    undo();
    undo();
    await autosave();

    expect(editor().getText()).toBe('Remote words');
    expect(savedContents(save)).toEqual(['<p>Alpha mine</p>']);
  });

  it('does not bring back replaced text from an undo step at the start of the note', async () => {
    await mount();

    // Select-all and type: the undo step starts at document position 0, where a
    // whole-document replacement does not map it away.
    replaceAll('Rewritten');
    await autosave();
    expect(savedContents(save)).toEqual(['<p>Rewritten</p>']);
    api.current!.remote('<p>Remote words</p>');
    save.mockClear();

    undo();
    expect(editor().getText()).toBe('Remote words');
    act(() => { editor().commands.redo(); });
    expect(editor().getText()).toBe('Remote words');
    await autosave();

    expect(save).not.toHaveBeenCalled();
  });

  it('a remote update does not trigger an autosave of its own', async () => {
    await mount();

    api.current!.remote('<p>Remote words</p>');
    await autosave();
    await act(async () => { vi.advanceTimersByTime(11_000); });

    expect(save).not.toHaveBeenCalled();
  });

  it('still undoes the writer\'s typing after a remote update, and stops at the remote text', async () => {
    await mount();

    api.current!.remote('<p>Remote words</p>');
    await pause();
    typeText(' and mine');
    expect(editor().getText()).toBe('Remote words and mine');

    undo();
    expect(editor().getText()).toBe('Remote words');
    undo();
    expect(editor().getText()).toBe('Remote words');

    await autosave();
    // Back at the remote text, nothing differs from the stored note.
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps the writer\'s undo history when their own save echoes back', async () => {
    await mount();

    typeText(' mine');
    await autosave();
    expect(savedContents(save)).toEqual(['<p>Alpha mine</p>']);

    undo();
    expect(editor().getText()).toBe('Alpha');
  });

  it('"Load changes" keeps the writer\'s words as a new note, then applies the remote text outside undo history', async () => {
    await mount();

    // Unsaved typing when the remote copy arrives shows the banner.
    typeText(' unsaved');
    api.current!.remote('<p>Remote words</p>');
    expect(screen.getByText('Updated on another device')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Load changes'));
    await waitFor(() => expect(editor().getText()).toBe('Remote words'));

    // The words undo can no longer reach are in a new note the writer can open.
    expect(keep.keepReleasedDraft).toHaveBeenCalledTimes(1);
    expect(keep.keepReleasedDraft).toHaveBeenCalledWith(
      'user-1', null, 'Shared (my version)', '<p>Alpha unsaved</p>',
      expect.objectContaining({ id: 'note-1', pinned: false }), [], 'Your version was kept as a new note.',
    );
    expect(onKeptReplacedDraft).toHaveBeenCalledWith(keptCopy);
    expect(screen.queryByText('Updated on another device')).not.toBeInTheDocument();

    undo();
    undo();
    await autosave();

    expect(editor().getText()).toBe('Remote words');
    expect(save).not.toHaveBeenCalled();
  });

  it('"Load changes" replaces nothing when the writer\'s words cannot be kept', async () => {
    keep.keepReleasedDraft.mockRejectedValue(new Error('vault locked'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await mount();

    typeText(' unsaved');
    api.current!.remote('<p>Remote words</p>');
    fireEvent.click(screen.getByText('Load changes'));
    await waitFor(() => expect(keep.keepReleasedDraft).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });

    expect(editor().getText()).toBe('Alpha unsaved');
    expect(screen.getByText('Updated on another device')).toBeInTheDocument();
    expect(onKeptReplacedDraft).not.toHaveBeenCalled();
    // Their own typing still undoes.
    undo();
    expect(editor().getText()).toBe('Alpha');
  });

  it('"Load changes" leaves words typed while the copy was written on screen', async () => {
    let finishKeep!: (note: Note) => void;
    keep.keepReleasedDraft.mockReturnValue(new Promise<Note>((resolve) => { finishKeep = resolve; }));
    await mount();

    typeText(' unsaved');
    api.current!.remote('<p>Remote words</p>');
    fireEvent.click(screen.getByText('Load changes'));
    await waitFor(() => expect(keep.keepReleasedDraft).toHaveBeenCalled());
    typeText(' more');
    await act(async () => { finishKeep(keptCopy); await Promise.resolve(); });

    expect(editor().getText()).toBe('Alpha unsaved more');
    expect(screen.getByText('Updated on another device')).toBeInTheDocument();
  });

  it('"Load changes" lets no save of the replaced words reach the open note', async () => {
    let finishKeep!: (note: Note) => void;
    keep.keepReleasedDraft.mockReturnValue(new Promise<Note>((resolve) => { finishKeep = resolve; }));
    await mount();

    typeText(' unsaved');
    api.current!.remote('<p>Remote words</p>');
    // An autosave of the typing is pending when the writer chooses.
    await act(async () => { vi.advanceTimersByTime(500); });
    const loadButton = screen.getByText('Load changes');
    // Pressing the button does not blur the editor, which would start a save.
    expect(fireEvent.mouseDown(loadButton)).toBe(false);
    expect(fireEvent.mouseDown(screen.getByText('Keep mine'))).toBe(false);
    fireEvent.click(loadButton);
    await waitFor(() => expect(keep.keepReleasedDraft).toHaveBeenCalled());
    // Keep mine cannot undo the choice halfway.
    expect(screen.getByText('Keep mine')).toBeDisabled();

    // The copy takes a while; no save of the old words lands meanwhile.
    await act(async () => { vi.advanceTimersByTime(5_000); });
    expect(savedContents(save)).not.toContain('<p>Alpha unsaved</p>');

    await act(async () => { finishKeep(keptCopy); await Promise.resolve(); });
    await waitFor(() => expect(editor().getText()).toBe('Remote words'));
    await autosave();
    expect(save).not.toHaveBeenCalled();
  });

  it('"Keep mine" leaves the writer\'s text and its undo history alone', async () => {
    await mount();

    typeText(' unsaved');
    api.current!.remote('<p>Remote words</p>');
    fireEvent.click(screen.getByText('Keep mine'));

    expect(editor().getText()).toBe('Alpha unsaved');
    undo();
    expect(editor().getText()).toBe('Alpha');
  });

  it('a note released elsewhere keeps undo for the writer\'s typing and saves nothing', async () => {
    await mount(true);

    typeText(' kept');
    expect(editor().getText()).toBe('Alpha kept');
    undo();
    expect(editor().getText()).toBe('Alpha');
    await autosave();

    expect(save).not.toHaveBeenCalled();
  });
});
