import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

describe('KeyboardShortcutsModal', () => {
  it('shows Cmd/Ctrl+K for search', () => {
    render(<KeyboardShortcutsModal isOpen onClose={vi.fn()} />);

    const searchRow = screen.getByText('Focus search').closest('div');
    expect(searchRow).not.toBeNull();

    const expectedModifier = navigator.platform.toUpperCase().includes('MAC') ? '\u2318' : 'Ctrl';
    const row = within(searchRow as HTMLElement);
    expect(row.getByText(expectedModifier)).toBeInTheDocument();
    expect(row.getByText('K')).toBeInTheDocument();
    expect(row.queryByText('Shift')).not.toBeInTheDocument();
  });

  /**
   * This page is a promise, and it can drift from the code without anything failing.
   * It did: the editor rebound Cmd/Ctrl+K to Link and moved search to Cmd/Ctrl+Shift+K,
   * while this modal went on saying Cmd/Ctrl+K focused search and named neither the
   * find panel nor the new search binding. Two surfaces, two different answers about
   * one key, and no test between them.
   */
  it.each([
    ['Insert or edit a link', ['K']],
    ['Find in this note', ['F']],
    ['Search all notes', ['Shift', 'K']],
    // "Toggle focus mode" also appears under Mobile Gestures as a triple-tap, so this
    // reads the Editor section rather than the whole document.
    ['Toggle focus mode', ['Shift', 'F']],
  ])('names the editor binding for %s', (description, keys) => {
    render(<KeyboardShortcutsModal isOpen onClose={vi.fn()} />);

    const editorSection = screen.getByText('Editor').closest('div');
    expect(editorSection).not.toBeNull();
    const shortcutRow = within(editorSection as HTMLElement)
      .getByText(description)
      .closest('div');
    expect(shortcutRow).not.toBeNull();

    const expectedModifier = navigator.platform.toUpperCase().includes('MAC') ? '\u2318' : 'Ctrl';
    const row = within(shortcutRow as HTMLElement);
    expect(row.getByText(expectedModifier)).toBeInTheDocument();
    for (const key of keys) expect(row.getByText(key)).toBeInTheDocument();
  });

  it('tells the reader Escape closes find before it does anything else', () => {
    render(<KeyboardShortcutsModal isOpen onClose={vi.fn()} />);
    expect(screen.getByText(/close find/i)).toBeInTheDocument();
  });

  it('lists every library search operator and phrase syntax', () => {
    render(<KeyboardShortcutsModal isOpen onClose={vi.fn()} />);

    const librarySection = screen.getByText('Library').closest('div');
    expect(librarySection).not.toBeNull();
    const library = within(librarySection as HTMLElement);
    for (const syntax of [
      'word word',
      '"exact phrase"',
      'tag:name',
      'is:pinned',
      'before:YYYY-MM[-DD]',
      'after:YYYY-MM[-DD]',
    ]) {
      expect(library.getByText(syntax)).toBeInTheDocument();
    }
  });
});
