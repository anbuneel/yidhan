import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMockNote } from '../test/factories';
import type { ChapterKey } from '../utils/temporalGrouping';
import { ChapterNav } from './ChapterNav';
import { NoteCard } from './NoteCard';
import { TagSelector } from './TagSelector';
import { TimeRibbon } from './TimeRibbon';

const chapters: { key: ChapterKey; label: string }[] = [
  { key: 'thisWeek', label: 'This week' },
  { key: 'earlier', label: 'Earlier' },
];

describe('chapter nav keyboard visibility', () => {
  it('becomes visible when a dot takes keyboard focus, not only on hover or scroll', () => {
    render(<ChapterNav chapters={chapters} currentChapter="thisWeek" onChapterClick={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Chapter navigation' });
    // Hidden while idle; focus-within is the keyboard path to showing it.
    expect(nav).toHaveClass('opacity-0', 'focus-within:opacity-100');
    const dot = screen.getAllByRole('button')[0];
    expect(dot.className).toMatch(/focus-visible:ring-2/);
    expect(dot.className).toMatch(/focus-visible:ring-\[var\(--color-accent\)\]/);
  });

  it('shows the chapter name on focus and hides it on blur', () => {
    render(<ChapterNav chapters={chapters} currentChapter="thisWeek" onChapterClick={vi.fn()} />);
    const dot = screen.getAllByRole('button', { name: /^Jump to/ })[0];
    fireEvent.focus(dot);
    expect(dot.parentElement).toHaveTextContent(/\S/);
    fireEvent.blur(dot);
    expect(dot.parentElement?.textContent).toBe('');
  });
});

describe('time ribbon focus ring', () => {
  it('gives each chapter button a token-coloured focus-visible ring instead of removing the outline', () => {
    render(<TimeRibbon noteCount={40} chapters={chapters} currentChapter="thisWeek" onChapterClick={vi.fn()} />);
    expect(screen.getByRole('navigation', { name: 'Time navigation' })).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: /^Jump to/ })) {
      expect(button).toHaveClass('focus-ring');
      expect(button.className).not.toMatch(/focus:outline-none/);
    }
  });
});

describe('note card tab stops', () => {
  const note = createMockNote({ id: 'n1', title: 'One thought' });
  const renderCard = (isFocused: boolean) => render(
    <NoteCard note={note} onClick={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} isFocused={isFocused} />,
  );
  const cardOf = () => screen.getByRole('group', { name: 'Note: One thought' });
  const openButton = () => screen.getByRole('button', { name: 'Open note: One thought' });

  it('an unselected card has one stop: the Open note button', () => {
    renderCard(false);
    expect(cardOf()).toHaveAttribute('tabindex', '-1');
    expect(openButton()).not.toHaveAttribute('tabindex');
  });

  it('the J/K-selected card has one stop: the card itself, which keeps focus', () => {
    renderCard(true);
    expect(cardOf()).toHaveAttribute('tabindex', '0');
    expect(cardOf()).toHaveFocus();
    expect(openButton()).toHaveAttribute('tabindex', '-1');
  });

  it('gives the button back its stop once selection moves on', () => {
    const { rerender } = renderCard(true);
    rerender(<NoteCard note={note} onClick={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} isFocused={false} />);
    expect(openButton()).not.toHaveAttribute('tabindex');
    expect(cardOf()).toHaveAttribute('tabindex', '-1');
  });
});

describe('tag selector role', () => {
  const tags = [{ id: 'a', name: 'Journal', createdAt: new Date() }];

  it.each(['inline', 'dropdown'] as const)('is a disclosure of toggle buttons, not a listbox (%s)', (variant) => {
    render(<TagSelector tags={tags} selectedTagIds={[]} variant={variant} onToggleTag={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /Add tag/ });
    expect(trigger).not.toHaveAttribute('aria-haspopup');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');

    fireEvent.click(trigger);
    const panel = screen.getByRole('group', { name: 'Tags' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', panel.id);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Journal', pressed: false })).toBeInTheDocument();
  });
});
