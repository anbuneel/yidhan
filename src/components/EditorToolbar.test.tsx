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

  it.each(['inline', 'bottom', 'sidebar'] as const)('shows the five-button row, then focus mode and ⋯, on the %s toolbar', (variant) => {
    editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p>Words</p>' });
    const { container } = render(<EditorToolbar editor={editor as unknown as ReactEditor} variant={variant} />);
    const ids = [...container.querySelectorAll('[role="toolbar"] > [data-command-id]')].map((el) => el.getAttribute('data-command-id'));
    const row = ['bold', 'italic', 'heading1', 'bulletList', 'link'];
    expect(ids).toEqual(variant === 'bottom' ? [...row, 'undo', 'redo', 'focusMode'] : [...row, 'focusMode']);
    expect(screen.getByRole('toolbar').lastElementChild?.querySelector('[aria-label="More editor commands"]')).not.toBeNull();
    // Inline code, code block and the old wide-screen commands are not on any row.
    for (const gone of ['inlineCode', 'codeBlock', 'underline', 'blockquote', 'heading2']) {
      expect(container.querySelector(`[role="toolbar"] [data-command-id="${gone}"]`)).toBeNull();
    }
  });

  it('gives Link an icon, not a word', () => {
    editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p>Words</p>' });
    render(<EditorToolbar editor={editor as unknown as ReactEditor} />);
    const link = screen.getByRole('button', { name: /^link/i });
    expect(link.querySelector('svg')).not.toBeNull();
    expect(link.textContent).toBe('');
  });

  it('groups ⋯ under Text, Blocks, Insert, Edit and View, listing only commands not in the row', () => {
    editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p>Words</p>' });
    render(<EditorToolbar editor={editor as unknown as ReactEditor} />);
    fireEvent.click(screen.getByRole('button', { name: 'More editor commands' }));
    const menu = screen.getByRole('menu', { name: 'Editor commands' });
    const groups = within(menu).getAllByRole('group');
    expect(groups.map((group) => group.getAttribute('aria-labelledby') && document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent))
      .toEqual(['Text', 'Blocks', 'Insert', 'Edit', 'View']);
    const ids = within(menu).getAllByRole('menuitem').map((item) => item.getAttribute('data-command-id'));
    expect(ids).toEqual([
      'underline', 'strike', 'inlineCode', 'highlight',
      'paragraph', 'heading2', 'heading3', 'orderedList', 'taskList', 'blockquote', 'codeBlock', 'alignCenter',
      'horizontalRule',
      'undo', 'redo',
      'findReplace',
    ]);
    // Not in ⋯: the row, focus mode (own button), smart typography (Settings), the
    // slash-only date inserts, and the dropped alignments and time.
    for (const gone of ['bold', 'italic', 'heading1', 'bulletList', 'link', 'focusMode', 'smartTypography', 'date', 'now', 'time', 'alignLeft', 'alignRight', 'alignJustify']) {
      expect(menu.querySelector(`[data-command-id="${gone}"]`)).toBeNull();
    }
  });

  it('keeps Undo and Redo in the phone bar ⋯ only as a narrow-screen fallback', () => {
    editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p>Words</p>' });
    render(<EditorToolbar editor={editor as unknown as ReactEditor} variant="bottom" />);
    fireEvent.click(screen.getByRole('button', { name: 'More editor commands' }));
    const menu = screen.getByRole('menu', { name: 'Editor commands' });
    const undo = menu.querySelector('[data-command-id="undo"]');
    expect(undo).toHaveAttribute('data-narrow-only');
    expect(undo?.closest('[role="group"]')).toHaveAttribute('data-narrow-only');
    expect(menu.querySelector('[data-command-id="findReplace"]')).not.toHaveAttribute('data-narrow-only');
  });

  it('portals the overflow menu to document.body and runs commands on pointerdown + click without closing prematurely', () => {
    editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p>Words</p>' });
    const onFindReplace = vi.fn();
    render(
      <div className="editor-toolbar-bottom">
        <EditorToolbar
          editor={editor as unknown as ReactEditor}
          variant="bottom"
          onFindReplace={onFindReplace}
        />
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'More editor commands' });
    fireEvent.click(trigger);

    const menu = screen.getByRole('menu', { name: 'Editor commands' });
    // Portaled outside the toolbar container so backdrop-filter does not trap fixed positioning.
    expect(menu.parentElement).toBe(document.body);
    expect(trigger.closest('.editor-toolbar-bottom')?.contains(menu)).toBe(false);

    const findItem = within(menu).getByRole('menuitem', { name: /find and replace/i });
    fireEvent.pointerDown(findItem);
    expect(screen.getByRole('menu', { name: 'Editor commands' })).toBeInTheDocument();
    fireEvent.click(findItem);
    expect(onFindReplace).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu', { name: 'Editor commands' })).not.toBeInTheDocument();
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
    expect(screen.getByRole('menu', { name: 'Editor commands' })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('menu', { name: 'Editor commands' })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'Editor commands' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Editor commands' })).not.toBeInTheDocument();
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

      expect(screen.queryByRole('menu', { name: 'Editor commands' })).not.toBeInTheDocument();
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

  it('closes the portaled overflow menu when focus mode activates', () => {
    editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p>Words</p>' });
    const { rerender } = render(
      <EditorToolbar editor={editor as unknown as ReactEditor} variant="bottom" isFocusMode={false} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'More editor commands' }));
    expect(screen.getByRole('menu', { name: 'Editor commands' })).toBeInTheDocument();

    rerender(
      <EditorToolbar editor={editor as unknown as ReactEditor} variant="bottom" isFocusMode={true} />,
    );
    expect(screen.queryByRole('menu', { name: 'Editor commands' })).not.toBeInTheDocument();

    // Leaving focus mode does not re-open the menu.
    rerender(
      <EditorToolbar editor={editor as unknown as ReactEditor} variant="bottom" isFocusMode={false} />,
    );
    expect(screen.queryByRole('menu', { name: 'Editor commands' })).not.toBeInTheDocument();
  });

  it('closes the portaled overflow menu when a resize hides the owning toolbar', () => {
    editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p>Words</p>' });
    const { container } = render(
      <div data-testid="toolbar-host">
        <EditorToolbar editor={editor as unknown as ReactEditor} variant="bottom" />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'More editor commands' }));
    expect(screen.getByRole('menu', { name: 'Editor commands' })).toBeInTheDocument();

    const host = container.querySelector('[data-testid="toolbar-host"]') as HTMLElement;
    host.style.display = 'none';
    fireEvent(window, new Event('resize'));
    expect(screen.queryByRole('menu', { name: 'Editor commands' })).not.toBeInTheDocument();
  });

  it('closes the portaled overflow menu on Tab and when focus moves outside', () => {
    editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p>Words</p>' });
    render(
      <div>
        <button type="button">Outside target</button>
        <EditorToolbar editor={editor as unknown as ReactEditor} variant="bottom" />
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'More editor commands' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'Editor commands' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.queryByRole('menu', { name: 'Editor commands' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'Editor commands' })).toBeInTheDocument();

    const outside = screen.getByRole('button', { name: 'Outside target' });
    fireEvent.focusIn(outside);
    expect(screen.queryByRole('menu', { name: 'Editor commands' })).not.toBeInTheDocument();
  });

  it('resets a prior short-viewport maxHeight before re-measuring when the viewport grows', () => {
    editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p>Words</p>' });
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    let triggerTop = 342;
    const triggerRectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('aria-label') === 'More editor commands') {
        return {
          top: triggerTop,
          bottom: triggerTop + 36,
          left: 340,
          right: 376,
          width: 36,
          height: 36,
          x: 340,
          y: triggerTop,
          toJSON: () => ({}),
        };
      }
      if (this.getAttribute('role') === 'menu') {
        // Simulate browser layout respecting any active inline maxHeight cap.
        const match = this.style.maxHeight.match(/(\d+(?:\.\d+)?)px/);
        const height = match ? Math.min(544, Number(match[1])) : 544;
        return {
          top: 0,
          bottom: height,
          left: 0,
          right: 336,
          width: 336,
          height,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      }
      return {
        top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}),
      };
    });

    try {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 390 });
      render(<EditorToolbar editor={editor as unknown as ReactEditor} variant="bottom" />);

      fireEvent.click(screen.getByRole('button', { name: 'More editor commands' }));
      const menu = screen.getByRole('menu', { name: 'Editor commands' });
      expect(menu.style.maxHeight).toBe('326px');
      expect(menu.style.top).toBe('8px');

      // Viewport grows (e.g., virtual keyboard closes) and bottom toolbar moves down.
      triggerTop = 796;
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
      fireEvent(window, new Event('resize'));

      // Natural 544px height was measured after resetting maxHeight, placing the menu at 796 - 8 - 544 = 244.
      expect(menu.style.maxHeight).toBe('544px');
      expect(Number.parseFloat(menu.style.top)).toBe(244);
      expect(Number.parseFloat(menu.style.top) + 544).toBeLessThanOrEqual(triggerTop);
      expect(Number.parseFloat(menu.style.top) + 544).toBeLessThanOrEqual(844);
    } finally {
      triggerRectSpy.mockRestore();
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
    }
  });

  it('ignores scroll events inside the menu panel and preserves scrollTop on external resize', () => {
    editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p>Words</p>' });
    render(<EditorToolbar editor={editor as unknown as ReactEditor} variant="inline" />);

    fireEvent.click(screen.getByRole('button', { name: 'More editor commands' }));
    const menu = screen.getByRole('menu', { name: 'Editor commands' });

    const rectSpy = vi.spyOn(menu, 'getBoundingClientRect');
    menu.scrollTop = 320;
    fireEvent.scroll(menu);

    expect(rectSpy).not.toHaveBeenCalled();
    expect(menu.scrollTop).toBe(320);

    // An external window resize re-measures without wiping menu scrollTop.
    fireEvent(window, new Event('resize'));
    expect(rectSpy).toHaveBeenCalled();
    expect(menu.scrollTop).toBe(320);
    rectSpy.mockRestore();
  });

  it('moves focus into the editor when entering focus mode from a toolbar button or when focus mode closes an open menu', async () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    try {
      editor = new Editor({
        element: mount,
        extensions: [StarterKit, SmartTypography],
        content: '<p>Words</p>',
      });
      const onToggleFocusMode = vi.fn();
      const { rerender } = render(
        <EditorToolbar
          editor={editor as unknown as ReactEditor}
          variant="inline"
          isFocusMode={false}
          onToggleFocusMode={onToggleFocusMode}
        />,
      );

      // Entering focus mode from the toolbar toggle moves focus into the editor.
      const toggle = screen.getByRole('button', { name: /focus mode/i });
      toggle.focus();
      expect(toggle).toHaveFocus();
      fireEvent.click(toggle);
      expect(onToggleFocusMode).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(editor!.view.dom).toHaveFocus());

      // Opening the command menu and activating focus mode via shortcut (prop flip)
      // closes the menu and moves focus into the editor instead of document.body.
      const trigger = screen.getByRole('button', { name: 'More editor commands' });
      fireEvent.click(trigger);
      const firstItem = within(screen.getByRole('menu', { name: 'Editor commands' })).getAllByRole('menuitem')[0];
      firstItem.focus();
      expect(firstItem).toHaveFocus();

      rerender(
        <EditorToolbar
          editor={editor as unknown as ReactEditor}
          variant="inline"
          isFocusMode={true}
          onToggleFocusMode={onToggleFocusMode}
        />,
      );
      expect(screen.queryByRole('menu', { name: 'Editor commands' })).not.toBeInTheDocument();
      await waitFor(() => expect(editor!.view.dom).toHaveFocus());
    } finally {
      mount.remove();
    }
  });
});
