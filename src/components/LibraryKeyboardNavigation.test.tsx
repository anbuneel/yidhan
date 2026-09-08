import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Note } from '../types';
import { useAppShortcuts } from '../hooks/useAppShortcuts';
import { useLibraryCardNavigation } from '../hooks/useLibraryCardNavigation';
import { ChapteredLibrary } from './ChapteredLibrary';
import type { ChapterArrangement } from '../utils/temporalGrouping';

function createNote(id: string, title: string, pinned = false, dates?: { createdAt: Date; updatedAt: Date }): Note {
  return {
    id,
    title,
    content: '<p>Thought</p>',
    createdAt: dates?.createdAt ?? new Date('2026-09-08T12:00:00Z'),
    updatedAt: dates?.updatedAt ?? new Date('2026-09-08T12:00:00Z'),
    tags: [],
    pinned,
    deletedAt: null,
  };
}

function KeyboardLibrary({
  notes,
  arrangement,
  onBasisChange,
  onSortChange,
  onOpen = vi.fn(),
  onTogglePin = vi.fn(),
  onDelete = vi.fn(),
}: {
  notes: Note[];
  arrangement?: ChapterArrangement;
  onBasisChange?: (basis: 'updated' | 'created') => void;
  onSortChange?: (sort: 'updated' | 'created' | 'title') => void;
  onOpen?: (id: string) => void;
  onTogglePin?: (id: string, pinned: boolean) => void;
  onDelete?: (id: string) => void;
}) {
  const { focusedNoteId, handleLibraryCardKeyDown } = useLibraryCardNavigation({
    notes,
    arrangement,
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
        arrangement={arrangement}
        onBasisChange={onBasisChange}
        onSortChange={onSortChange}
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

  it('walks the cards in the order the arrangement put them in', async () => {
    // The hook groups the notes a second time. Handed a different arrangement from the
    // one on screen, it would move focus to a card the reader is not looking at.
    const user = userEvent.setup();
    const byTitle = [
      createNote('zebra', 'Zebra thought', false, {
        createdAt: new Date('2026-09-08T09:00:00Z'),
        updatedAt: new Date('2026-09-08T12:00:00Z'),
      }),
      createNote('apple', 'Apple thought', false, {
        createdAt: new Date('2026-09-08T08:00:00Z'),
        updatedAt: new Date('2026-09-08T10:00:00Z'),
      }),
    ];

    render(<KeyboardLibrary notes={byTitle} arrangement={{ basis: 'updated', sort: 'title' }} />);

    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(card('Apple thought')).toHaveAttribute('tabindex', '0'));

    await user.keyboard('j');
    await waitFor(() => expect(card('Zebra thought')).toHaveAttribute('tabindex', '0'));
  });

  it('leaves the arrange controls to their own keyboard behavior', async () => {
    // The arrange row sits inside the library, so J/K and the arrows must not steal
    // keystrokes aimed at it — before a card is selected or after one is.
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onTogglePin = vi.fn();
    const onDelete = vi.fn();
    render(
      <KeyboardLibrary
        notes={notes}
        onBasisChange={vi.fn()}
        onSortChange={vi.fn()}
        onOpen={onOpen}
        onTogglePin={onTogglePin}
        onDelete={onDelete}
      />
    );

    const writtenButton = screen.getByRole('button', { name: 'Group chapters by written' });

    writtenButton.focus();
    await user.keyboard('{ArrowDown}j');
    expect(card('Pinned thought')).toHaveAttribute('tabindex', '-1');
    expect(card('Recent thought')).toHaveAttribute('tabindex', '-1');

    writtenButton.blur();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(card('Pinned thought')).toHaveAttribute('tabindex', '0'));

    writtenButton.focus();
    await user.keyboard('j{Enter}p{Delete}');
    expect(card('Pinned thought')).toHaveAttribute('tabindex', '0');
    expect(card('Recent thought')).toHaveAttribute('tabindex', '-1');
    expect(onOpen).not.toHaveBeenCalled();
    expect(onTogglePin).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
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
