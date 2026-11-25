import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagFilterBar } from './TagFilterBar';
import { TagPill } from './TagPill';
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

  it('keeps the tag row uncollapsed and edit controls interactive at 375px with three tags', async () => {
    const user = userEvent.setup({ delay: null });
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 375 });
    try {
      const { props } = renderBar();

      // Mobile never renders desktop collapse controls, keeping all tags and "+ Tag" on one row.
      expect(screen.queryByRole('button', { name: /Show \d+ more tags/i })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Collapse tags' })).toBeNull();

      // Edit controls stay reachable via programmatic focus and click on narrow screens,
      // and expand on hover and focus (not only focus-visible).
      const editButtons = screen.getAllByRole('button', { name: 'Edit tag' });
      expect(editButtons).toHaveLength(3);
      editButtons[0].focus();
      expect(editButtons[0]).toHaveFocus();
      expect(editButtons[0].className).toMatch(/\bgroup-hover:w-7\b/);
      expect(editButtons[0].className).toMatch(/\bfocus:w-7\b/);
      expect(editButtons[0].className).toMatch(/\bfocus:opacity-100\b/);

      await user.click(editButtons[2]);
      expect(props.onEditTag).toHaveBeenCalledWith(tags[2]);
      expect(props.onTagToggle).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Add tag' }));
      expect(props.onAddTag).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: originalWidth });
    }
  });

  it('preserves desktop two-row collapse and expand behaviour when tags overflow', async () => {
    const user = userEvent.setup({ delay: null });
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
    const getRectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute('data-tag-pill')) {
        // Place the third tag beyond the 2-row 108px desktop threshold.
        const isOverflow = this.textContent?.includes('Reading');
        return {
          top: isOverflow ? 116 : 0,
          bottom: isOverflow ? 148 : 36,
          left: 0,
          right: 80,
          width: 80,
          height: 36,
          x: 0,
          y: isOverflow ? 116 : 0,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        top: 0,
        bottom: 150,
        left: 0,
        right: 900,
        width: 900,
        height: 150,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });

    try {
      renderBar();
      const expandButton = await screen.findByRole('button', { name: 'Show 1 more tags' });
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      await user.click(expandButton);
      const collapseButton = screen.getByRole('button', { name: 'Collapse tags' });
      expect(collapseButton).toHaveAttribute('aria-expanded', 'true');

      await user.click(collapseButton);
      expect(await screen.findByRole('button', { name: 'Show 1 more tags' })).toBeInTheDocument();
    } finally {
      getRectSpy.mockRestore();
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: originalWidth });
    }
  });

  it('keeps TagPill remove control full-size and directly interactive below 640px', async () => {
    const user = userEvent.setup({ delay: null });
    const onRemove = vi.fn();
    const onClick = vi.fn();
    render(<TagPill tag={tags[0]} onClick={onClick} showRemove onRemove={onRemove} />);

    const removeButton = screen.getByRole('button', { name: 'Remove tag' });
    expect(removeButton.className).toMatch(/\bsize-7\b/);
    expect(removeButton.className).not.toMatch(/\bw-0\b/);

    await user.click(removeButton);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });
});
