import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Note } from '../types';
import { createMockNote } from '../test/factories';
import type { ChapterKey } from '../utils/temporalGrouping';
import { ChapterSection } from './ChapterSection';

function chapterProps(chapterKey: ChapterKey, notes: Note[]) {
  return {
    chapterKey,
    label: chapterKey,
    notes,
    defaultExpanded: true,
    isPinned: chapterKey === 'pinned',
    onNoteClick: vi.fn(),
    onRetryLockedNote: vi.fn(),
    onNoteDelete: vi.fn(),
    onTogglePin: vi.fn(),
  };
}

function renderChapter(chapterKey: ChapterKey) {
  render(<ChapterSection {...chapterProps(chapterKey, [createMockNote()])} />);

  const content = document.getElementById(`chapter-content-${chapterKey}`);
  if (!content) throw new Error(`${chapterKey} chapter content was not rendered`);
  return content;
}

function pinnedNotes(count: number): Note[] {
  return Array.from({ length: count }, (_, i) =>
    createMockNote({ id: `pin-${i}`, title: `Pinned ${i}`, pinned: true })
  );
}

const grid = () => document.querySelector('.masonry-grid');
const cards = () => Array.from(document.querySelectorAll('.note-card'));

describe('ChapterSection age fade', () => {
  it.each([
    ['earlier', '0.9'],
    ['archive', '0.9'],
    ['pinned', '1'],
  ] satisfies [ChapterKey, string][])('sets %s chapter opacity to %s', (chapterKey, opacity) => {
    expect(renderChapter(chapterKey).style.opacity).toBe(opacity);
  });
});

describe('ChapterSection pinned row (item 111)', () => {
  // Where the row must not fire.
  it('keeps masonry and full cards for search results, even with one pinned note', () => {
    render(<ChapterSection {...chapterProps('pinned', pinnedNotes(1))} isSearching searchQuery="is:pinned" />);

    expect(grid()).not.toHaveClass('pinned-row');
    expect(cards()[0]).not.toHaveClass('note-card-compact');
  });

  it('keeps masonry and full cards for three pinned notes', () => {
    render(<ChapterSection {...chapterProps('pinned', pinnedNotes(3))} />);

    expect(grid()).not.toHaveClass('pinned-row');
    expect(cards()).toHaveLength(3);
    cards().forEach((card) => expect(card).not.toHaveClass('note-card-compact'));
  });

  it.each(['thisWeek', 'lastWeek', 'thisMonth', 'earlier', 'archive'] satisfies ChapterKey[])(
    'never uses the row for the %s chapter',
    (chapterKey) => {
      render(<ChapterSection {...chapterProps(chapterKey, [createMockNote()])} />);

      expect(grid()).not.toHaveClass('pinned-row');
      expect(cards()[0]).not.toHaveClass('note-card-compact');
    }
  );

  it('keeps keyboard selection on a compact pinned card', () => {
    render(<ChapterSection {...chapterProps('pinned', pinnedNotes(1))} focusedNoteId="pin-0" />);

    const card = cards()[0];
    expect(card).toHaveClass('note-card-compact');
    expect(card).toHaveAttribute('tabindex', '0');
    expect(card).toHaveAttribute('data-library-card-id', 'pin-0');
  });

  // Where it should.
  it.each([1, 2])('renders %i pinned notes as a compact, left-aligned row', (count) => {
    render(<ChapterSection {...chapterProps('pinned', pinnedNotes(count))} />);

    expect(grid()).toHaveClass('pinned-row');
    // Not centred in a capped band, the old low-count treatment.
    expect((grid()?.parentElement as HTMLElement).style.marginInline).toBe('');
    expect(cards()).toHaveLength(count);
    cards().forEach((card) => expect(card).toHaveClass('note-card-compact'));
  });

  it('keeps the pin button on a compact pinned card, so a mouse can unpin', () => {
    const props = chapterProps('pinned', pinnedNotes(1));
    render(<ChapterSection {...props} />);

    // fireEvent: the swipe wrapper's pointer capture is not in jsdom.
    fireEvent.click(screen.getByRole('button', { name: 'Unpin note' }));
    expect(props.onTogglePin).toHaveBeenCalledWith('pin-0', false);
  });

  it('switches to masonry at a third pin and back at an unpin, without remounting cards', () => {
    const props = chapterProps('pinned', pinnedNotes(2));
    const { rerender } = render(<ChapterSection {...props} />);
    const first = cards()[0];
    const header = screen.getByText('pinned');

    rerender(<ChapterSection {...props} notes={pinnedNotes(3)} />);
    expect(grid()).not.toHaveClass('pinned-row');
    expect(cards()[0]).not.toHaveClass('note-card-compact');
    expect(screen.getByText('pinned')).toBe(header);

    rerender(<ChapterSection {...props} notes={pinnedNotes(2)} />);
    expect(grid()).toHaveClass('pinned-row');
    expect(cards()[0]).toHaveClass('note-card-compact');
    // The first card stays in column one throughout, so it is the same element.
    expect(cards()[0]).toBe(first);
  });
});

describe('ChapterSection entrance stagger (C9)', () => {
  it('skips entrance stagger on search results', () => {
    const notes = Array.from({ length: 4 }, (_, i) => createMockNote({ id: `s-${i}` }));
    render(<ChapterSection {...chapterProps('thisWeek', notes)} isSearching searchQuery="note" />);

    expect(document.querySelectorAll('.note-card-entrance')).toHaveLength(0);
  });

  it('skips entrance stagger when animateEntrance is false', () => {
    const notes = Array.from({ length: 4 }, (_, i) => createMockNote({ id: `b-${i}` }));
    render(<ChapterSection {...chapterProps('thisWeek', notes)} animateEntrance={false} />);

    expect(document.querySelectorAll('.note-card-entrance')).toHaveLength(0);
  });

  it('applies a tighter stagger capped at 0.3s on initial load', () => {
    // 14 notes with focusedNoteId on the last reveals all 14 cards so we can verify the cap.
    const notes = Array.from({ length: 14 }, (_, i) => createMockNote({ id: `n-${i}` }));
    render(<ChapterSection {...chapterProps('thisWeek', notes)} animateEntrance focusedNoteId="n-13" />);

    const delayOf = (id: string) =>
      document.querySelector(`[data-library-card-id="${id}"]`)?.closest<HTMLElement>('.note-card-entrance')?.style.animationDelay;
    expect(document.querySelectorAll('.note-card-entrance').length).toBeGreaterThanOrEqual(12);
    expect(delayOf('n-0')).toBe('0s');
    expect(delayOf('n-1')).toBe('0.03s');
    expect(delayOf('n-10')).toBe('0.3s');
    expect(delayOf('n-13')).toBe('0.3s');
  });
});
