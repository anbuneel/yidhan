import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '@tiptap/core';
import type { Editor as ReactEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { FindReplace, getFindReplaceState } from '../editor/FindReplace';
import { FindReplacePanel } from './FindReplacePanel';

function editorWith(content: string) {
  return new Editor({ extensions: [StarterKit, FindReplace], content });
}

describe('FindReplacePanel', () => {
  /**
   * The panel is modeless: the reader clicks back into the note between searches, and
   * that is the normal way to use it. While it is open the editor's own Escape handler
   * stands down — it checks `showFindReplace`, and independently sees this element's
   * `data-editor-popover` — so an Escape handler scoped to the panel's own subtree left
   * Escape doing nothing at all once focus moved into the note. Neither the panel nor
   * save-and-return responded; the editor's primary exit was dead until the ✕ was found
   * with a mouse.
   */
  it('closes on Escape pressed outside the panel', () => {
    const editor = editorWith('<p>alpha</p>');
    const onClose = vi.fn();
    render(<FindReplacePanel editor={editor as unknown as ReactEditor} onClose={onClose} />);

    // Focus deliberately elsewhere: this is the case the old handler missed.
    document.body.focus();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    editor.destroy();
  });

  it('still closes on Escape pressed inside the panel', async () => {
    const editor = editorWith('<p>alpha</p>');
    const onClose = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<FindReplacePanel editor={editor as unknown as ReactEditor} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText('Find'), 'alph');
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    editor.destroy();
  });

  it('clears the highlights it put in the document when it closes', () => {
    const editor = editorWith('<p>alpha beta alpha</p>');
    render(<FindReplacePanel editor={editor as unknown as ReactEditor} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Find'), { target: { value: 'alpha' } });
    expect(getFindReplaceState(editor).matches).toHaveLength(2);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(getFindReplaceState(editor).matches).toHaveLength(0);
    editor.destroy();
  });

  /** Escape is the only key that closes it; a stray keystroke must not dismiss a search. */
  it('ignores other keys', () => {
    const editor = editorWith('<p>alpha</p>');
    const onClose = vi.fn();
    render(<FindReplacePanel editor={editor as unknown as ReactEditor} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'a' });

    expect(onClose).not.toHaveBeenCalled();
    editor.destroy();
  });

  /**
   * Something nearer the keystroke has already dealt with it — a nested popover, say.
   * Closing anyway would dismiss two things on one press.
   */
  it('leaves an Escape that was already handled alone', () => {
    const editor = editorWith('<p>alpha</p>');
    const onClose = vi.fn();
    render(<FindReplacePanel editor={editor as unknown as ReactEditor} onClose={onClose} />);

    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true });
    event.preventDefault();
    document.dispatchEvent(event);

    expect(onClose).not.toHaveBeenCalled();
    editor.destroy();
  });

  it('stops listening once it is gone', () => {
    const editor = editorWith('<p>alpha</p>');
    const onClose = vi.fn();
    const { unmount } = render(
      <FindReplacePanel editor={editor as unknown as ReactEditor} onClose={onClose} />
    );

    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    editor.destroy();
  });
});
