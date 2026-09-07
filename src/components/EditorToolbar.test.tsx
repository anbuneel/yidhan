import { Editor } from '@tiptap/core';
import type { Editor as ReactEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextSelection } from '@tiptap/pm/state';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EDITOR_COMMANDS } from '../editor/editorCommands';
import { SmartTypography } from '../editor/SmartTypography';
import { EditorToolbar } from './EditorToolbar';

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('EditorToolbar', () => {
  it('subscribes to transactions so moving into bold text refreshes the active button', async () => {
    editor = new Editor({
      extensions: [StarterKit, SmartTypography],
      content: '<p>plain <strong>bold</strong></p>',
    });
    render(<EditorToolbar editor={editor as unknown as ReactEditor} />);
    const bold = screen.getByRole('button', { name: /bold/i });
    expect(bold).toHaveAttribute('aria-pressed', 'false');

    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 8)));
    await waitFor(() => expect(bold).toHaveAttribute('aria-pressed', 'true'));
  });

  it('makes the complete command model mouse-reachable from overflow', async () => {
    editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p>Words</p>' });
    render(<EditorToolbar editor={editor as unknown as ReactEditor} />);
    fireEvent.click(screen.getByRole('button', { name: 'More editor commands' }));
    const menu = screen.getByRole('menu', { name: 'All editor commands' });
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(EDITOR_COMMANDS.length);
    expect(within(menu).getByRole('menuitem', { name: /inline code/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /align center/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /smart typography/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
