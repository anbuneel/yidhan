import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LockedNoteCard } from './LockedNoteCard';
import type { Note } from '../types';

const lockedNote: Note = {
  id: 'locked-1',
  title: '',
  content: '',
  createdAt: new Date('2026-09-01T10:00:00Z'),
  updatedAt: new Date('2026-09-01T10:00:00Z'),
  tags: [],
  pinned: false,
  decryptionFailed: true,
};

describe('LockedNoteCard', () => {
  it('says the note could not be opened, not that it is gone', () => {
    render(<LockedNoteCard note={lockedNote} onRetry={() => undefined} />);

    expect(screen.getByText(/could not be opened/i)).toBeInTheDocument();
    expect(screen.getByText(/still here and it is still encrypted/i)).toBeInTheDocument();
  });

  it('reassures the reader that the rest of the library is fine', () => {
    render(<LockedNoteCard note={lockedNote} onRetry={() => undefined} />);
    expect(screen.getByText(/other notes are unaffected/i)).toBeInTheDocument();
  });

  it('offers a retry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<LockedNoteCard note={lockedNote} onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('still shows when the note was last saved, so it reads as a real note', () => {
    render(<LockedNoteCard note={lockedNote} onRetry={() => undefined} />);
    expect(screen.getByText(/last saved/i)).toBeInTheDocument();
  });

  it('shows nothing that could have come from the ciphertext', () => {
    // The locked note carries empty title and content by construction. If a future
    // change ever put real content on one, this would catch it.
    const { container } = render(
      <LockedNoteCard
        note={{ ...lockedNote, title: 'Leaked title', content: '<p>Leaked body</p>' }}
        onRetry={() => undefined}
      />
    );

    expect(container.textContent).not.toContain('Leaked title');
    expect(container.textContent).not.toContain('Leaked body');
  });
});
