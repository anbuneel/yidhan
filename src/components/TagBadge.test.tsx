import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TagBadge, TagBadgeList } from './TagBadge';
import type { Tag } from '../types';

const createTag = (overrides: Partial<Tag> = {}): Tag => ({
  id: '1',
  name: 'Test Tag',
  color: 'terracotta',
  createdAt: new Date(),
  ...overrides,
});

describe('TagBadge', () => {
  it('renders the tag name', () => {
    const tag = createTag({ name: 'Important' });
    render(<TagBadge tag={tag} />);
    expect(screen.getByText('Important')).toBeInTheDocument();
  });

  it('applies the correct color', () => {
    const tag = createTag({ color: 'forest' });
    render(<TagBadge tag={tag} />);
    const badge = screen.getByText('Test Tag');
    expect(badge).toHaveStyle({ color: '#3D5A3D' });
  });

  it('renders a color indicator dot', () => {
    const tag = createTag({ color: 'gold' });
    const { container } = render(<TagBadge tag={tag} />);
    const dot = container.querySelector('.rounded-full');
    expect(dot).toHaveStyle({ background: '#D4AF37' });
  });
});

describe('TagBadgeList', () => {
  it('renders nothing when tags array is empty', () => {
    const { container } = render(<TagBadgeList tags={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all tags when count is within maxDisplay', () => {
    const tags = [
      createTag({ id: '1', name: 'Tag 1' }),
      createTag({ id: '2', name: 'Tag 2' }),
    ];
    render(<TagBadgeList tags={tags} maxDisplay={2} />);
    expect(screen.getByText('Tag 1')).toBeInTheDocument();
    expect(screen.getByText('Tag 2')).toBeInTheDocument();
  });

  it('shows "+X more" when tags exceed maxDisplay', () => {
    const tags = [
      createTag({ id: '1', name: 'Tag 1' }),
      createTag({ id: '2', name: 'Tag 2' }),
      createTag({ id: '3', name: 'Tag 3' }),
      createTag({ id: '4', name: 'Tag 4' }),
    ];
    render(<TagBadgeList tags={tags} maxDisplay={2} />);
    expect(screen.getByText('Tag 1')).toBeInTheDocument();
    expect(screen.getByText('Tag 2')).toBeInTheDocument();
    expect(screen.queryByText('Tag 3')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
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
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });
});
