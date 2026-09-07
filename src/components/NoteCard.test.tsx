import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMockNote } from '../test/factories';
import { NoteCard } from './NoteCard';

function renderCard(onDelete: (id: string) => boolean | void | Promise<boolean | void>) {
  const note = createMockNote({ id: 'note-to-fade', title: 'A passing thought' });
  const rendered = render(
    <NoteCard
      note={note}
      onClick={vi.fn()}
      onDelete={onDelete}
      onTogglePin={vi.fn()}
    />
  );
  const card = screen.getByRole('button', { name: /Open note/ }).closest('.note-card');
  if (!card) throw new Error('Note card was not rendered');
  return { ...rendered, card, note };
}

describe('NoteCard deletion', () => {
  it('still deletes exactly once when search unmounts the card mid-animation', async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    const { unmount } = renderCard(onDelete);

    await user.click(screen.getByRole('button', { name: 'Delete note' }));
    unmount();

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(onDelete).toHaveBeenCalledWith('note-to-fade');
  });

  it('does not repeat deletion when animation completion is followed by unmount', async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    const { card, unmount } = renderCard(onDelete);

    await user.click(screen.getByRole('button', { name: 'Delete note' }));
    fireEvent.animationEnd(card);
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    unmount();

    await Promise.resolve();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('restores the card and explains a rejected delete', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('IndexedDB write failed'));
    const user = userEvent.setup();
    const { card } = renderCard(onDelete);

    await user.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(card).toHaveClass('deleting');
    fireEvent.animationEnd(card);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This note could not be faded. Try again.'
    );
    expect(card).not.toHaveClass('deleting');
    expect(screen.getByRole('button', { name: 'Delete note' })).toBeEnabled();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
