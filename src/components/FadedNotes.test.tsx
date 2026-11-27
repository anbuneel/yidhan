import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMockNote } from '../test/factories';
import { FadedNoteCard } from './FadedNoteCard';
import { getDeletionCountdown } from '../utils/deletionCopy';
import { FadedNotesView } from './FadedNotesView';

const DAY = 24 * 60 * 60 * 1000;

describe('Faded notes wording (design critique G1, G2, G4)', () => {
  it('counts down in days', () => {
    expect(getDeletionCountdown(30)).toBe('Deleted in 30 days');
    expect(getDeletionCountdown(2)).toBe('Deleted in 2 days');
    expect(getDeletionCountdown(1)).toBe('Deleted tomorrow');
    expect(getDeletionCountdown(0)).toBe('Deleted today');
  });

  it('shows the day count on the card', () => {
    const note = createMockNote({ deletedAt: new Date(Date.now() - 10 * DAY) });
    render(<FadedNoteCard note={note} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />);
    expect(screen.getByText('Deleted in 20 days')).toBeInTheDocument();
    expect(screen.queryByText(/remaining|Resting|Fading|Nearly gone|Just arrived/)).toBeNull();
  });

  it('says "today" and "tomorrow" by calendar day', () => {
    vi.useFakeTimers();
    try {
      // 23:00 local; the note's 30 days end at 03:00 tomorrow.
      vi.setSystemTime(new Date(2026, 10, 26, 23, 0));
      const deletedAt = new Date(new Date(2026, 10, 27, 3, 0).getTime() - 30 * DAY);
      const { unmount } = render(
        <FadedNoteCard note={createMockNote({ deletedAt })} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />
      );
      expect(screen.getByText('Deleted tomorrow')).toBeInTheDocument();
      unmount();

      // 01:00; the 30 days end at 22:00 today.
      vi.setSystemTime(new Date(2026, 10, 26, 1, 0));
      const today = new Date(new Date(2026, 10, 26, 22, 0).getTime() - 30 * DAY);
      render(<FadedNoteCard note={createMockNote({ deletedAt: today })} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />);
      expect(screen.getByText('Deleted today')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('asks plainly before deleting one note permanently', () => {
    const onPermanentDelete = vi.fn();
    const note = createMockNote({ id: 'n1', deletedAt: new Date() });
    render(<FadedNoteCard note={note} onRestore={vi.fn()} onPermanentDelete={onPermanentDelete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(screen.getByText('Delete permanently?')).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
    // The overlay still says which note.
    expect(screen.getAllByText(note.title).length).toBeGreaterThan(1);
    expect(screen.queryByText(/release|goodbye/i)).toBeNull();

    // The icon and the confirm button share the label; the confirm is the last.
    const buttons = screen.getAllByRole('button', { name: 'Delete permanently' });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onPermanentDelete).toHaveBeenCalledWith('n1');
  });

  it('cancels without deleting', () => {
    const onPermanentDelete = vi.fn();
    render(
      <FadedNoteCard
        note={createMockNote({ deletedAt: new Date() })}
        onRestore={vi.fn()}
        onPermanentDelete={onPermanentDelete}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onPermanentDelete).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete permanently?')).toBeNull();
  });

  it('still restores, under the same name', () => {
    const onRestore = vi.fn();
    render(
      <FadedNoteCard note={createMockNote({ id: 'n2', deletedAt: new Date() })} onRestore={onRestore} onPermanentDelete={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restore note' }));
    expect(onRestore).toHaveBeenCalledWith('n2');
  });

  it('shows the delete icon on touch screens, where there is no hover', () => {
    render(
      <FadedNoteCard note={createMockNote({ deletedAt: new Date() })} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />
    );
    const icon = screen.getByRole('button', { name: 'Delete permanently' });
    expect(icon.className).toMatch(/\[@media\(hover:none\)\]:opacity-100/);
    // Still hidden until hover on a mouse.
    expect(icon.className).toMatch(/(^|\s)opacity-0(\s|$)/);
  });

  it('shows Restore on touch screens too, and keeps it hover-only on a mouse', () => {
    render(
      <FadedNoteCard note={createMockNote({ deletedAt: new Date() })} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />
    );
    const restore = screen.getByRole('button', { name: 'Restore note' });
    expect(restore.className).toMatch(/\[@media\(hover:none\)\]:opacity-100/);
    expect(restore.className).toMatch(/\[@media\(any-pointer:coarse\)\]:opacity-100/);
    // A mouse still sees it only on hover.
    expect(restore.className).toMatch(/(^|\s)opacity-0(\s|$)/);
  });

  it('asks plainly before deleting every faded note', () => {
    const onEmptyAll = vi.fn();
    render(
      <FadedNotesView
        notes={[createMockNote({ id: 'a', deletedAt: new Date() }), createMockNote({ id: 'b', deletedAt: new Date() })]}
        onBack={vi.fn()}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
        onEmptyAll={onEmptyAll}
        theme="light"
        onThemeToggle={vi.fn()}
        onSettingsClick={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete all faded notes?')).toBeInTheDocument();
    expect(within(dialog).getByText("2 notes will be deleted. This can't be undone.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete all' }));
    expect(onEmptyAll).toHaveBeenCalledOnce();
  });
});
