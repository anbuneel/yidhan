import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { RichTextEditor } from './RichTextEditor';

function typeThroughEditor(editor: Editor, text: string): void {
  for (const character of text) {
    const { from, to } = editor.state.selection;
    let handled = false;
    editor.view.someProp('handleTextInput', (handler) => {
      if (handler(editor.view, from, to, character)) {
        handled = true;
        return true;
      }
      return false;
    });
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(character, from, to));
  }
}

describe('RichTextEditor extensions', () => {
  beforeEach(() => localStorage.clear());

  it('registers Underline once without a duplicate-name console warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ready = vi.fn<(editor: Editor) => void>();
    try {
      const view = render(<RichTextEditor content="<p><u>Underlined</u></p>" onChange={vi.fn()} onEditorReady={ready} />);
      await waitFor(() => expect(ready).toHaveBeenCalled());
      const editor = ready.mock.calls[0][0];
      expect(editor.extensionManager.extensions.filter(extension => extension.name === 'underline')).toHaveLength(1);
      expect(editor.extensionManager.extensions.find(extension => extension.name === 'link')?.options.openOnClick).toBe(false);
      expect(editor.getHTML()).toContain('<u>Underlined</u>');
      expect(warn.mock.calls.flat().join(' ')).not.toMatch(/duplicate extension names/i);
      view.unmount();
    } finally {
      warn.mockRestore();
    }
  });

  it('converts plain-text Markdown paste while leaving HTML clipboard content to the browser', async () => {
    const ready = vi.fn<(editor: Editor) => void>();
    render(<RichTextEditor content="<p></p>" onChange={vi.fn()} onEditorReady={ready} />);
    await waitFor(() => expect(ready).toHaveBeenCalled());
    const editor = ready.mock.calls[0][0];

    fireEvent.paste(editor.view.dom, {
      clipboardData: {
        getData: (type: string) => type === 'text/plain' ? '## Heading' : '',
      },
    });
    expect(editor.getHTML()).toContain('<h2>Heading</h2>');

    const preventDefault = vi.fn();
    const handled = editor.options.editorProps.handlePaste?.(
      editor.view,
      { clipboardData: { getData: (type: string) => type === 'text/html' ? '<strong>Heading</strong>' : '## Heading' }, preventDefault } as unknown as ClipboardEvent,
      editor.state.selection.content(),
    );
    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('shapes quotes, dashes, and ellipses when enabled and keeps code blocks literal', async () => {
    const ready = vi.fn<(editor: Editor) => void>();
    render(<RichTextEditor content="<p></p>" onChange={vi.fn()} onEditorReady={ready} />);
    await waitFor(() => expect(ready).toHaveBeenCalled());
    const editor = ready.mock.calls[0][0];
    editor.commands.focus('end', { scrollIntoView: false });
    typeThroughEditor(editor, '"Hello"--...');
    expect(editor.getText()).toBe('“Hello”—…');

    editor.commands.setContent('<pre><code>seed</code></pre>');
    editor.commands.setTextSelection(5);
    typeThroughEditor(editor, '--...');
    expect(editor.getText().trim()).toBe('seed--...');

    editor.commands.setContent('<p><code>seed</code></p>');
    editor.commands.setTextSelection(5);
    typeThroughEditor(editor, '--...');
    expect(editor.getText().trim()).toBe('seed--...');
  });

  it('keeps smart punctuation literal after the setting is disabled', async () => {
    const ready = vi.fn<(editor: Editor) => void>();
    render(<RichTextEditor content="<p></p>" onChange={vi.fn()} onEditorReady={ready} />);
    await waitFor(() => expect(ready).toHaveBeenCalled());
    const editor = ready.mock.calls[0][0];
    editor.commands.setSmartTypography(false);
    editor.commands.focus('end', { scrollIntoView: false });
    typeThroughEditor(editor, '"Hello"--...');
    expect(editor.getText()).toBe('"Hello"--...');
    expect(localStorage.getItem('yidhan:editor:smart-typography')).toBe('false');
  });

  it('clears undo history when switching notes without emitting an update', async () => {
    const onChange = vi.fn();
    const ready = vi.fn<(editor: Editor) => void>();
    const view = render(
      <RichTextEditor noteId="note-a" content="<p>Alpha</p>" onChange={onChange} onEditorReady={ready} />,
    );
    await waitFor(() => expect(ready).toHaveBeenCalled());
    const editor = ready.mock.calls[0][0];

    editor.commands.focus('end', { scrollIntoView: false });
    typeThroughEditor(editor, ' edited');
    expect(editor.getText()).toBe('Alpha edited');
    expect(editor.can().undo()).toBe(true);

    onChange.mockClear();
    const onTransaction = vi.fn();
    editor.on('transaction', onTransaction);

    view.rerender(
      <RichTextEditor noteId="note-b" content="<p>Beta</p>" onChange={onChange} onEditorReady={ready} />,
    );

    expect(editor.getText()).toBe('Beta');
    expect(onChange).not.toHaveBeenCalled();
    expect(editor.can().undo()).toBe(false);
    expect(onTransaction).toHaveBeenCalled();

    editor.commands.undo();
    expect(editor.getText()).toBe('Beta');
    expect(onChange).not.toHaveBeenCalled();

    // Editing note B and undoing twice must stop at Beta and never leak Alpha.
    editor.commands.focus('end', { scrollIntoView: false });
    typeThroughEditor(editor, ' two');
    expect(editor.getText()).toBe('Beta two');
    editor.commands.undo();
    expect(editor.getText()).toBe('Beta');
    editor.commands.undo();
    expect(editor.getText()).toBe('Beta');
  });

  it('keeps undo working inside one note after an autosave updates props', async () => {
    const onChange = vi.fn();
    const ready = vi.fn<(editor: Editor) => void>();
    const view = render(
      <RichTextEditor noteId="note-a" content="<p>Alpha</p>" onChange={onChange} onEditorReady={ready} />,
    );
    await waitFor(() => expect(ready).toHaveBeenCalled());
    const editor = ready.mock.calls[0][0];

    editor.commands.focus('end', { scrollIntoView: false });
    typeThroughEditor(editor, ' edited');
    expect(editor.getText()).toBe('Alpha edited');

    // Simulate autosave echoing the saved HTML back on the same noteId.
    view.rerender(
      <RichTextEditor noteId="note-a" content="<p>Alpha edited</p>" onChange={onChange} onEditorReady={ready} />,
    );

    expect(editor.can().undo()).toBe(true);
    editor.commands.undo();
    expect(editor.getText()).toBe('Alpha');
  });

  it('updates the animated placeholder when switching between empty and populated notes', async () => {
    const ready = vi.fn<(editor: Editor) => void>();
    const view = render(
      <RichTextEditor noteId="note-empty" content="<p></p>" onChange={vi.fn()} onEditorReady={ready} />,
    );
    await waitFor(() => expect(ready).toHaveBeenCalled());

    expect(view.container.querySelector('.animated-placeholder')).toBeInTheDocument();

    view.rerender(
      <RichTextEditor noteId="note-full" content="<p>Populated note</p>" onChange={vi.fn()} onEditorReady={ready} />,
    );
    await waitFor(() => {
      expect(view.container.querySelector('.animated-placeholder')).not.toBeInTheDocument();
    });

    view.rerender(
      <RichTextEditor noteId="note-empty-2" content="<p></p>" onChange={vi.fn()} onEditorReady={ready} />,
    );
    await waitFor(() => {
      expect(view.container.querySelector('.animated-placeholder')).toBeInTheDocument();
    });
  });
});
