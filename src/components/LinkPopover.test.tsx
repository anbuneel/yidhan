import { act, fireEvent, render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LinkPopover } from './LinkPopover';

let editor: Editor;
afterEach(() => editor?.destroy());
function mount(content = '<p>Selected words</p>') {
  editor = new Editor({ extensions: [StarterKit.configure({ link: { openOnClick: false } })], content });
  editor.commands.setTextSelection({ from: 1, to: 15 });
  const close = vi.fn();
  const view = render(<LinkPopover editor={editor} onClose={close} />);
  return { view, close };
}

describe('LinkPopover', () => {
  it('adds a link to the captured selection, then edits and removes it without losing text', () => {
    const { view, close } = mount();
    fireEvent.change(screen.getByLabelText('Link address'), { target: { value: 'https://example.com/one' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save link' }));
    expect(editor.getHTML()).toContain('href="https://example.com/one"');
    expect(editor.getText()).toBe('Selected words');
    expect(close).toHaveBeenCalled();
    view.unmount();
    act(() => editor.commands.setTextSelection({ from: 1, to: 15 }));
    const edit = render(<LinkPopover editor={editor} onClose={close} />);
    fireEvent.change(screen.getByLabelText('Link address'), { target: { value: 'https://example.com/two' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save link' }));
    expect(editor.getHTML()).toContain('href="https://example.com/two"');
    edit.unmount();
    render(<LinkPopover editor={editor} onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove link' }));
    expect(editor.getHTML()).not.toContain('<a');
    expect(editor.getText()).toBe('Selected words');
  });

  it('rejects unsafe addresses without modifying the note', () => {
    mount();
    fireEvent.change(screen.getByLabelText('Link address'), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save link' }));
    expect(screen.getByRole('alert')).toBeVisible();
    expect(editor.getHTML()).not.toContain('<a');
  });

  it('consumes Escape and returns focus without changing the note', () => {
    const { close } = mount();
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true });
    fireEvent(screen.getByLabelText('Link address'), event);
    expect(event.defaultPrevented).toBe(true);
    expect(close).toHaveBeenCalled();
    expect(editor.getText()).toBe('Selected words');
  });
});
