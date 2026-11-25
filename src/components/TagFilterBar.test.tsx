import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagFilterBar } from './TagFilterBar';
import { TAG_COLORS, type Tag, type TagColor } from '../types';

const tag = (id: string, name: string, color: TagColor): Tag => ({ id, name, color, createdAt: new Date() });

const tags = [tag('a', 'Journal', 'terracotta'), tag('b', 'Ideas', 'gold'), tag('c', 'Reading', 'plum')];

function renderBar(selectedTagIds: string[] = [], overrides = {}) {
  const props = {
    tags,
    selectedTagIds,
    onTagToggle: vi.fn(),
    onClearFilter: vi.fn(),
    onAddTag: vi.fn(),
    onEditTag: vi.fn(),
    ...overrides,
  };
  return { ...render(<TagFilterBar {...props} />), props };
}

describe('TagFilterBar', () => {
  it('marks only "All notes" as pressed when no tag is selected', () => {
    renderBar();
    expect(screen.getByRole('button', { name: 'All notes' })).toHaveAttribute('aria-pressed', 'true');
    for (const t of tags) {
      expect(screen.getByRole('button', { name: `Filter by ${t.name}` })).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('gives the active style to exactly the selected tag', () => {
    renderBar(['b']);
    const pressed = screen.getAllByRole('button', { pressed: true });
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveAccessibleName('Filter by Ideas');
    expect(pressed[0]).toHaveStyle({ color: 'var(--color-accent-text)', textDecorationLine: 'underline' });
    expect(screen.getByRole('button', { name: 'Filter by Journal' })).toHaveStyle({
      color: 'var(--color-text-secondary)',
      textDecorationLine: 'none',
    });
  });

  it('never renders a stored tag colour, active or not', () => {
    const { container } = renderBar(['a', 'b', 'c']);
    const html = container.innerHTML.toLowerCase();
    for (const value of Object.values(TAG_COLORS)) {
      expect(html).not.toContain(value.toLowerCase());
    }
    expect(container.querySelector('.rounded-full.size-2')).toBeNull();
  });

  it('renders tags with different colours identically', () => {
    renderBar();
    const journal = screen.getByRole('button', { name: 'Filter by Journal' });
    const reading = screen.getByRole('button', { name: 'Filter by Reading' });
    expect(journal.getAttribute('style')).toBe(reading.getAttribute('style'));
    expect(journal.className).toBe(reading.className);
  });

  it('has no chip chrome: no border, fill or blur on tags', () => {
    renderBar(['a']);
    for (const button of screen.getAllByRole('button', { name: /^Filter by|^All notes$/ })) {
      expect(button.style.border).toBe('');
      expect(button.style.background).toBe('');
      expect(button.getAttribute('style') ?? '').not.toMatch(/backdrop|blur/);
    }
  });

  it('clears the filter from "All notes"', async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderBar(['a']);
    await user.click(screen.getByRole('button', { name: 'All notes' }));
    expect(props.onClearFilter).toHaveBeenCalledTimes(1);
    expect(props.onTagToggle).not.toHaveBeenCalled();
  });

  it('does not toggle the filter when the edit control is used', async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderBar();
    await user.click(screen.getAllByRole('button', { name: 'Edit tag' })[1]);
    expect(props.onEditTag).toHaveBeenCalledWith(tags[1]);
    expect(props.onTagToggle).not.toHaveBeenCalled();
  });

  it('keeps the edit control reachable by keyboard', async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderBar();
    screen.getByRole('button', { name: 'Filter by Journal' }).focus();
    await user.tab();
    expect(screen.getAllByRole('button', { name: 'Edit tag' })[0]).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(props.onEditTag).toHaveBeenCalledWith(tags[0]);
    expect(props.onTagToggle).not.toHaveBeenCalled();
  });

  it('opens the add flow from "Add tag"', async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderBar();
    await user.click(screen.getByRole('button', { name: 'Add tag' }));
    expect(props.onAddTag).toHaveBeenCalledTimes(1);
  });

  it('shows just "All notes" and "Add tag" with no tags', () => {
    renderBar([], { tags: [] });
    expect(screen.getByRole('button', { name: 'All notes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add tag' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Filter by/ })).toBeNull();
  });

  it('keeps "+ Tag" on the tag row at 375px with three tags while preserving desktop wrap', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 375 });
    try {
      const { container } = renderBar();
      const row = container.querySelector('.flex') as HTMLElement;
      expect(row).not.toBeNull();
      // Mobile: single non-wrapping row so "+ Tag" never orphans onto a lone second line.
      expect(row.className).toMatch(/\bflex-nowrap\b/);
      expect(row.className).toMatch(/\boverflow-x-auto\b/);
      // Desktop (sm+) keeps the original wrapping row and spacing.
      expect(row.className).toMatch(/\bsm:flex-wrap\b/);
      expect(row.className).toMatch(/\bsm:overflow-visible\b/);
      expect(row.className).toMatch(/\bsm:gap-x-2\b/);

      const allNotes = screen.getByRole('button', { name: 'All notes' });
      expect(allNotes.className).not.toMatch(/(^|\s)mr-7(\s|$)/);
      expect(allNotes.className).toMatch(/\bsm:mr-7\b/);

      const addTag = screen.getByRole('button', { name: 'Add tag' });
      expect(addTag.parentElement).toBe(row);
      expect(addTag.className).toMatch(/\bshrink-0\b/);

      // Edit controls take zero width on phones until focused, and stay 28px on desktop.
      for (const editButton of screen.getAllByRole('button', { name: 'Edit tag' })) {
        expect(editButton.className).toMatch(/\bw-0\b/);
        expect(editButton.className).toMatch(/\bsm:w-7\b/);
        expect(editButton.className).toMatch(/\bfocus-visible:w-7\b/);
      }
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: originalWidth });
    }
  });
});
