/**
 * Undo after a remote update (issue #284). These run the real Tiptap editor, because
 * the bug lives in its undo history: a remote update applied with `setContent` used
 * to record an undo step, so undo brought back the text another device had replaced
 * and autosave wrote it over that device's edit.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { Editor } from './Editor';
import { resetNoteSaveQueue } from '../stores/noteSaveQueue';
import { resetHeldSaves } from '../stores/heldSaves';
import { createMockNote } from '../test/factories';
import { useAuth } from '../contexts/AuthContext';
import type { Note } from '../types';

const tiptap = vi.hoisted(() => ({ current: null as TiptapEditor | null }));

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
vi.mock('../utils/keepReleasedDraft', () => ({ keepReleasedDraft: vi.fn() }));
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
function Harness({ save, api, released }: { save: Save; api: { current: HarnessApi | null }; released: boolean }) {
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

function savedContents(save: ReturnType<typeof vi.fn>) {
  return save.mock.calls.map(([n]) => (n as Note).content);
}

describe('undo after a remote update (issue #284)', () => {
  let api: { current: HarnessApi | null };
  let save: ReturnType<typeof vi.fn<Save>>;

  async function mount(released = false) {
    render(<Harness save={save} api={api} released={released} />);
    await waitFor(() => expect(tiptap.current).not.toBeNull());
  }

  beforeEach(() => {
    tiptap.current = null;
    api = { current: null };
    save = vi.fn<Save>().mockResolvedValue(undefined);
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
    expect(savedContents(save)).not.toContain('<p>Alpha</p>');
  });

  it('keeps the writer\'s undo history when their own save echoes back', async () => {
    await mount();

    typeText(' mine');
    await autosave();
    expect(savedContents(save)).toEqual(['<p>Alpha mine</p>']);

    undo();
    expect(editor().getText()).toBe('Alpha');
  });

  it('"Load changes" applies the remote text outside undo history', async () => {
    await mount();

    // Unsaved typing when the remote copy arrives shows the banner.
    typeText(' unsaved');
    api.current!.remote('<p>Remote words</p>');
    expect(screen.getByText('Updated on another device')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Load changes'));
    expect(editor().getText()).toBe('Remote words');

    undo();
    undo();
    await autosave();

    expect(editor().getText()).toBe('Remote words');
    expect(savedContents(save)).not.toContain('<p>Alpha unsaved</p>');
    expect(savedContents(save)).not.toContain('<p>Alpha</p>');
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
