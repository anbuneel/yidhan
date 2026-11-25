import { Editor } from '@tiptap/core';
import type { Editor as ReactEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextSelection } from '@tiptap/pm/state';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('portals the overflow menu to document.body and runs commands on pointerdown + click without closing prematurely', () => {
    editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p>Words</p>' });
    const onToggleFocusMode = vi.fn();
    render(
      <div className="editor-toolbar-bottom">
        <EditorToolbar
          editor={editor as unknown as ReactEditor}
          variant="bottom"
          onToggleFocusMode={onToggleFocusMode}
        />
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'More editor commands' });
    fireEvent.click(trigger);

    const menu = screen.getByRole('menu', { name: 'All editor commands' });
    // Portaled outside the toolbar container so backdrop-filter does not trap fixed positioning.
    expect(menu.parentElement).toBe(document.body);
    expect(trigger.closest('.editor-toolbar-bottom')?.contains(menu)).toBe(false);

    const focusItem = within(menu).getByRole('menuitem', { name: /focus mode/i });
    fireEvent.pointerDown(focusItem);
    expect(screen.getByRole('menu', { name: 'All editor commands' })).toBeInTheDocument();
    fireEvent.click(focusItem);
    expect(onToggleFocusMode).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu', { name: 'All editor commands' })).not.toBeInTheDocument();
  });

  it('closes the portaled overflow menu on outside pointerdown and on Escape', () => {
    editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p>Words</p>' });
    render(
      <div>
        <button type="button">Outside</button>
        <EditorToolbar editor={editor as unknown as ReactEditor} variant="bottom" />
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'More editor commands' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'All editor commands' })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('menu', { name: 'All editor commands' })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'All editor commands' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'All editor commands' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it.each(['sidebar', 'inline', 'bottom'] as const)(
    'shows a visible Focus mode toggle directly on the %s toolbar without opening the menu',
    (variant) => {
      editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p>Words</p>' });
      const onToggleFocusMode = vi.fn();
      const { rerender } = render(
        <EditorToolbar
          editor={editor as unknown as ReactEditor}
          variant={variant}
          isFocusMode={false}
          onToggleFocusMode={onToggleFocusMode}
        />,
      );

      expect(screen.queryByRole('menu', { name: 'All editor commands' })).not.toBeInTheDocument();
      const toggle = screen.getByRole('button', { name: /focus mode/i });
      expect(toggle).toHaveAttribute('data-command-id', 'focusMode');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(toggle).not.toHaveAttribute('data-active');

      fireEvent.click(toggle);
      expect(onToggleFocusMode).toHaveBeenCalledTimes(1);

      rerender(
        <EditorToolbar
          editor={editor as unknown as ReactEditor}
          variant={variant}
          isFocusMode={true}
          onToggleFocusMode={onToggleFocusMode}
        />,
      );
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(toggle).toHaveAttribute('data-active', 'true');

      fireEvent.click(toggle);
      expect(onToggleFocusMode).toHaveBeenCalledTimes(2);
    },
  );
});
