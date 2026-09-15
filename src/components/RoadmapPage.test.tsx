import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mocked so these assertions describe the rendering, not whatever the real
// roadmap happens to contain this week. Note there is deliberately no
// 'coming-soon' item — that group must not render at all.
vi.mock('../data/roadmap', () => ({
  roadmap: [
    { id: '1', title: 'Shipped thing', description: 'Already done', status: 'shipped' },
    { id: '2', title: 'Current thing', description: 'Being built', status: 'in-progress' },
    { id: '3', title: 'Idea thing', description: 'Maybe one day', status: 'exploring' },
  ],
  statusLabels: {
    'shipped': 'Shipped',
    'in-progress': 'In Progress',
    'coming-soon': 'Coming Soon',
    'exploring': 'Exploring',
  },
}));
vi.mock('./HeaderShell', () => ({ HeaderShell: () => <header>header</header> }));

import { RoadmapPage } from './RoadmapPage';

describe('RoadmapPage', () => {
  const defaultProps = {
    theme: 'dark' as const,
    onThemeToggle: vi.fn(),
    onSignIn: vi.fn(),
    onLogoClick: vi.fn(),
    onChangelogClick: vi.fn(),
  };

  it('renders each item under its status heading', () => {
    render(<RoadmapPage {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Shipped' })).toBeInTheDocument();
    expect(screen.getByText('Shipped thing')).toBeInTheDocument();
    expect(screen.getByText('Already done')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'In Progress' })).toBeInTheDocument();
    expect(screen.getByText('Current thing')).toBeInTheDocument();
  });

  it('omits a status group that has no items', () => {
    render(<RoadmapPage {...defaultProps} />);

    // An empty "Coming Soon" heading with nothing under it reads as a bug.
    expect(screen.queryByRole('heading', { name: 'Coming Soon' })).not.toBeInTheDocument();
  });

  it('orders the groups shipped first, exploring last', () => {
    render(<RoadmapPage {...defaultProps} />);

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

    // Fixed order, not data order: the mock lists exploring before it would
    // sort naturally, so a render that followed the array would fail here.
    expect(headings).toEqual(['Shipped', 'In Progress', 'Exploring']);
  });

  it('navigates to the changelog from the footer', async () => {
    const user = userEvent.setup({ delay: null });
    const onChangelogClick = vi.fn();
    render(<RoadmapPage {...defaultProps} onChangelogClick={onChangelogClick} />);

    await user.click(screen.getByRole('button', { name: 'Changelog' }));

    expect(onChangelogClick).toHaveBeenCalledTimes(1);
  });
});
