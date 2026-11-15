import { fireEvent, render, screen } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { describe, expect, it, vi } from 'vitest';
import { EditorSidebar } from './EditorSidebar';

vi.mock('./EditorToolbar', () => ({ EditorToolbar: () => <div data-testid="toolbar" /> }));

const editor = {} as Editor;

function setup() {
  render(
    <>
      <EditorSidebar editor={editor} />
      <textarea aria-label="Note title" />
      <div className="ProseMirror" contentEditable suppressContentEditableWarning data-testid="body" />
      <input aria-label="Search" />
      <div role="dialog">
        <input aria-label="Tag name" />
      </div>
    </>,
  );
  return screen.getByLabelText('Editor command sidebar');
}

const isQuiet = (rail: HTMLElement) => rail.hasAttribute('data-quiet');

describe('EditorSidebar typing fade', () => {
  it('renders nothing without an editor', () => {
    render(<EditorSidebar editor={null} />);
    expect(screen.queryByLabelText('Editor command sidebar')).toBeNull();
  });

  // Where it must not fire.
  it('is not quiet at rest', () => {
    expect(isQuiet(setup())).toBe(false);
  });

  it.each(['Search', 'Tag name'])('stays put when the writer types in the %s field', (label) => {
    const rail = setup();
    fireEvent.keyDown(screen.getByLabelText(label), { key: 'a' });
    expect(isQuiet(rail)).toBe(false);
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])(
    'stays put for a shortcut in the note body (%o)',
    (modifier) => {
      const rail = setup();
      fireEvent.keyDown(screen.getByTestId('body'), { key: 'b', ...modifier });
      expect(isQuiet(rail)).toBe(false);
    },
  );

  // Where it should.
  it.each(['body', 'title'])('goes quiet when the writer types in the note %s', (where) => {
    const rail = setup();
    const target = where === 'body' ? screen.getByTestId('body') : screen.getByLabelText('Note title');
    fireEvent.keyDown(target, { key: 'a' });
    expect(isQuiet(rail)).toBe(true);
  });

  it('comes back when the pointer moves', () => {
    const rail = setup();
    fireEvent.keyDown(screen.getByTestId('body'), { key: 'a' });
    fireEvent.pointerMove(document);
    expect(isQuiet(rail)).toBe(false);
  });

  it('comes back for a shortcut after typing', () => {
    const rail = setup();
    fireEvent.keyDown(screen.getByTestId('body'), { key: 'a' });
    fireEvent.keyDown(screen.getByTestId('body'), { key: 'b', ctrlKey: true });
    expect(isQuiet(rail)).toBe(false);
  });

  it('comes back when text is selected, and not for a bare caret move', () => {
    const rail = setup();
    fireEvent.keyDown(screen.getByTestId('body'), { key: 'a' });
    const spy = vi.spyOn(document, 'getSelection');
    spy.mockReturnValue({ isCollapsed: true } as Selection);
    fireEvent(document, new Event('selectionchange'));
    expect(isQuiet(rail)).toBe(true);
    spy.mockReturnValue({ isCollapsed: false } as Selection);
    fireEvent(document, new Event('selectionchange'));
    expect(isQuiet(rail)).toBe(false);
    spy.mockRestore();
  });

  it('stops listening after unmount', () => {
    const { unmount } = render(<EditorSidebar editor={editor} />);
    const remove = vi.spyOn(document, 'removeEventListener');
    unmount();
    expect(remove.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(['keydown', 'pointermove', 'selectionchange']),
    );
    remove.mockRestore();
  });
});
