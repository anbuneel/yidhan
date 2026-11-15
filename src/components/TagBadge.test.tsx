import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TagBadge, TagBadgeList } from './TagBadge';
import { TAG_COLORS, type Tag, type TagColor } from '../types';

const createTag = (overrides: Partial<Tag> = {}): Tag => ({
  id: '1',
  name: 'Test Tag',
  color: 'terracotta',
  createdAt: new Date(),
  ...overrides,
});

describe('TagBadge', () => {
  it('renders the tag name as quiet italic text', () => {
    render(<TagBadge tag={createTag({ name: 'Important' })} />);
    const badge = screen.getByText('Important');
    expect(badge).toHaveClass('italic');
    expect(badge).toHaveStyle({ color: 'var(--color-text-tertiary)' });
  });

  it('renders every stored colour the same way', () => {
    const colors = Object.keys(TAG_COLORS) as TagColor[];
    const markup = colors.map((color) => {
      const { container, unmount } = render(<TagBadge tag={createTag({ color })} />);
      const html = container.innerHTML;
      unmount();
      return html;
    });
    expect(new Set(markup).size).toBe(1);
  });

  it('has no dot, fill, border or rounded chip', () => {
    const { container } = render(<TagBadge tag={createTag({ color: 'gold' })} />);
    const badge = container.firstChild as HTMLElement;
    expect(container.querySelector('.rounded-full')).toBeNull();
    expect(badge.style.background).toBe('');
    expect(badge.style.border).toBe('');
    expect(badge.style.borderRadius).toBe('');
    expect(container.innerHTML).not.toContain(TAG_COLORS.gold);
  });
});

describe('TagBadgeList', () => {
  it('renders nothing when tags array is empty', () => {
    const { container } = render(<TagBadgeList tags={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('joins tags with a middot', () => {
    const tags = [
      createTag({ id: '1', name: 'Tag 1' }),
      createTag({ id: '2', name: 'Tag 2' }),
    ];
    const { container } = render(<TagBadgeList tags={tags} maxDisplay={2} />);
    expect(screen.getByText('Tag 1')).toBeInTheDocument();
    expect(screen.getByText('Tag 2')).toBeInTheDocument();
    expect(container.textContent).toBe('Tag 1·Tag 2');
  });

  it('does not put a middot before a single tag', () => {
    const { container } = render(<TagBadgeList tags={[createTag({ name: 'Solo' })]} maxDisplay={2} />);
    expect(container.textContent).toBe('Solo');
  });

  it('shows "+N" when tags exceed maxDisplay', () => {
    const tags = [
      createTag({ id: '1', name: 'Tag 1' }),
      createTag({ id: '2', name: 'Tag 2' }),
      createTag({ id: '3', name: 'Tag 3' }),
      createTag({ id: '4', name: 'Tag 4' }),
    ];
    render(<TagBadgeList tags={tags} maxDisplay={2} />);
    expect(screen.queryByText('Tag 3')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByLabelText('2 more tags')).toBeInTheDocument();
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it('respects custom maxDisplay value', () => {
    const tags = [
      createTag({ id: '1', name: 'Tag 1' }),
      createTag({ id: '2', name: 'Tag 2' }),
      createTag({ id: '3', name: 'Tag 3' }),
    ];
    render(<TagBadgeList tags={tags} maxDisplay={1} />);
    expect(screen.getByText('Tag 1')).toBeInTheDocument();
    expect(screen.queryByText('Tag 2')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
});
