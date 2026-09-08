import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Note } from '../types';
import { useAppShortcuts } from '../hooks/useAppShortcuts';
import { useLibraryCardNavigation } from '../hooks/useLibraryCardNavigation';
import { ChapteredLibrary } from './ChapteredLibrary';

function createNote(id: string, title: string, pinned = false): Note {
  return {
    id,
    title,
    content: '<p>Thought</p>',
    createdAt: new Date('2026-09-08T12:00:00Z'),
    updatedAt: new Date('2026-09-08T12:00:00Z'),
    tags: [],
    pinned,
    deletedAt: null,
  };
}

function KeyboardLibrary({
  notes,
  onOpen = vi.fn(),
  onTogglePin = vi.fn(),
  onDelete = vi.fn(),
}: {
  notes: Note[];
  onOpen?: (id: string) => void;
  onTogglePin?: (id: string, pinned: boolean) => void;
  onDelete?: (id: string) => void;
}) {
  const { focusedNoteId, handleLibraryCardKeyDown } = useLibraryCardNavigation({
    notes,
    onOpen,
    onTogglePin,
    onDelete,
  });

  useAppShortcuts({
    enabled: true,
    view: 'library',
    onNewNote: vi.fn(),
    onFocusSearch: vi.fn(),
    onRequestLibrarySearch: vi.fn(),
    onShowShortcuts: vi.fn(),
    onLibraryCardKeyDown: handleLibraryCardKeyDown,
  });

  return (
    <>
      <input aria-label="Search notes" />
      <button type="button">Outside control</button>
      <dialog open><button type="button">Close modal</button></dialog>
      <ChapteredLibrary
        notes={notes}
        onNoteClick={onOpen}
        onNoteDelete={onDelete}
        onTogglePin={onTogglePin}
        focusedNoteId={focusedNoteId}
      />
    </>
  );
}

function card(title: string): HTMLElement {
  const openControl = screen.getByRole('button', { name: `Open note: ${title}` });
  const noteCard = openControl.closest('.note-card');
  if (!noteCard) throw new Error(`Could not find card for ${title}`);
  return noteCard;
}

describe('library keyboard navigation', () => {
  const notes = [
    createNote('pinned', 'Pinned thought', true),
    createNote('recent', 'Recent thought'),
  ];

  it('clamps at the ends, crosses chapters, and keeps the selected card visibly focused', async () => {
    const user = userEvent.setup();
    render(<KeyboardLibrary notes={notes} />);

    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(card('Pinned thought')).toHaveAttribute('tabindex', '0'));
    expect(card('Pinned thought')).toHaveFocus();
    expect(card('Pinned thought')).toHaveClass('focus:ring-2');

    await user.keyboard('j');
    await waitFor(() => expect(card('Recent thought')).toHaveAttribute('tabindex', '0'));
    expect(card('Pinned thought')).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{ArrowDown}');
    expect(card('Recent thought')).toHaveAttribute('tabindex', '0');

    await user.keyboard('k');
    await waitFor(() => expect(card('Pinned thought')).toHaveAttribute('tabindex', '0'));

    await user.keyboard('{ArrowUp}');
    expect(card('Pinned thought')).toHaveAttribute('tabindex', '0');
  });

  it('does not navigate while the search input is receiving text', async () => {
    const user = userEvent.setup();
    render(<KeyboardLibrary notes={notes} />);

    await user.click(screen.getByRole('textbox', { name: 'Search notes' }));
    await user.keyboard('junk');

    expect(card('Pinned thought')).toHaveAttribute('tabindex', '-1');
    expect(card('Recent thought')).toHaveAttribute('tabindex', '-1');
  });

  it('opens, pins, and fades the selected card through the global shortcut layer', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onTogglePin = vi.fn();
    const onDelete = vi.fn();
    render(
      <KeyboardLibrary
        notes={notes}
        onOpen={onOpen}
        onTogglePin={onTogglePin}
        onDelete={onDelete}
      />
    );

    await user.keyboard('{ArrowDown}{Enter}p{Delete}');

    expect(onOpen).toHaveBeenCalledWith('pinned');
    expect(onTogglePin).toHaveBeenCalledWith('pinned', false);
    expect(onDelete).toHaveBeenCalledWith('pinned');
  });

  it('leaves a tabbed control and modal action to its native keyboard behavior', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onTogglePin = vi.fn();
    const onDelete = vi.fn();
    render(
      <KeyboardLibrary
        notes={notes}
        onOpen={onOpen}
        onTogglePin={onTogglePin}
        onDelete={onDelete}
      />
    );

    await user.keyboard('{ArrowDown}');
    const outsideControl = screen.getByRole('button', { name: 'Outside control' });
    outsideControl.focus();
    await user.keyboard('j');

    const modalClose = screen.getByRole('button', { name: 'Close modal' });
    modalClose.focus();
    await user.keyboard('{Enter}p{Delete}');

    expect(onOpen).not.toHaveBeenCalled();
    expect(onTogglePin).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(card('Pinned thought')).toHaveAttribute('tabindex', '0');
  });
});
