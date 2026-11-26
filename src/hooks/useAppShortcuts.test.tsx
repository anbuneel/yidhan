import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppShortcuts } from './useAppShortcuts';

type View = Parameters<typeof useAppShortcuts>[0]['view'];

function setup(view: View = 'library', enabled = true) {
  const onNewNote = vi.fn();
  renderHook(() =>
    useAppShortcuts({
      enabled,
      view,
      onNewNote,
      onFocusSearch: vi.fn(),
      onRequestLibrarySearch: vi.fn(),
      onShowShortcuts: vi.fn(),
    })
  );
  return onNewNote;
}

function press(target: EventTarget, init: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('N creates a note (design critique K2)', () => {
  it('creates a note on plain N in the library', () => {
    const onNewNote = setup();
    const event = press(document.body, { key: 'n' });
    expect(onNewNote).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('still creates a note on Ctrl+N and Cmd+N', () => {
    const onNewNote = setup();
    press(document.body, { key: 'n', ctrlKey: true });
    press(document.body, { key: 'n', metaKey: true });
    expect(onNewNote).toHaveBeenCalledTimes(2);
  });

  it('does nothing while typing in a field', () => {
    const onNewNote = setup();
    for (const tag of ['input', 'textarea', 'select']) {
      const field = document.createElement(tag);
      document.body.appendChild(field);
      const event = press(field, { key: 'n' });
      expect(event.defaultPrevented).toBe(false);
    }
    expect(onNewNote).not.toHaveBeenCalled();
  });

  it('does nothing inside a contenteditable', () => {
    const onNewNote = setup();
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    // jsdom does not compute isContentEditable; a browser does.
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    document.body.appendChild(editable);
    press(editable, { key: 'n' });
    expect(onNewNote).not.toHaveBeenCalled();
  });

  it('does nothing in the editor view', () => {
    const onNewNote = setup('editor');
    press(document.body, { key: 'n' });
    expect(onNewNote).not.toHaveBeenCalled();
  });

  it('does nothing while a dialog has turned shortcuts off', () => {
    const onNewNote = setup('library', false);
    press(document.body, { key: 'n' });
    expect(onNewNote).not.toHaveBeenCalled();
  });

  it('does nothing behind an open modal that did not turn shortcuts off', () => {
    const onNewNote = setup();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const button = document.createElement('button');
    dialog.appendChild(button);
    document.body.appendChild(dialog);
    press(button, { key: 'n' });
    expect(onNewNote).not.toHaveBeenCalled();
  });

  it('ignores Shift+N, Alt+N, key repeat and composition', () => {
    const onNewNote = setup();
    press(document.body, { key: 'N', shiftKey: true });
    press(document.body, { key: 'n', altKey: true });
    press(document.body, { key: 'n', repeat: true });
    press(document.body, { key: 'n', isComposing: true });
    expect(onNewNote).not.toHaveBeenCalled();
  });
});
