import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The real changelog grows with every release, so tests asserting its content
// would break on each entry. Mock it and assert the rendering instead.
vi.mock('../data/changelog', () => ({
  changelog: [
    { version: '9.9.10', date: '2026-03-14', changes: [
      { type: 'fix', text: 'A later fix the same day' },
    ] },
    { version: '9.9.9', date: '2026-03-14', changes: [
      { type: 'feature', text: 'A brand new thing' },
      { type: 'fix', text: 'A thing that was broken' },
    ] },
    { version: '9.9.8', date: 'not a date', changes: [
      { type: 'improvement', text: 'A thing made better' },
    ] },
  ],
}));
vi.mock('./HeaderShell', () => ({ HeaderShell: () => <header>header</header> }));

import { ChangelogPage } from './ChangelogPage';

describe('ChangelogPage', () => {
  const defaultProps = {
    theme: 'dark' as const,
    onThemeToggle: vi.fn(),
    onSignIn: vi.fn(),
    onLogoClick: vi.fn(),
    onRoadmapClick: vi.fn(),
  };

  it('renders every entry with its version and changes', () => {
    render(<ChangelogPage {...defaultProps} />);

    expect(screen.getByText('A brand new thing')).toBeInTheDocument();
    expect(screen.getByText('A thing that was broken')).toBeInTheDocument();
    expect(screen.getByText('A thing made better')).toBeInTheDocument();
  });

  it('formats a valid date for reading', () => {
    render(<ChangelogPage {...defaultProps} />);

    // Rendered rather than raw: '2026-03-14' would be a timestamp on a page
    // about what changed and when.
    expect(screen.queryByText('2026-03-14')).not.toBeInTheDocument();
    expect(screen.getByText('March 14, 2026')).toBeInTheDocument();
  });

  it('groups releases from one day into one update, with the versions in small text', () => {
    render(<ChangelogPage {...defaultProps} />);

    const days = screen.getAllByRole('article');
    expect(days).toHaveLength(2);
    expect(within(days[0]).getByRole('heading', { level: 2 })).toHaveTextContent('March 14, 2026');
    expect(within(days[0]).getByTestId('changelog-versions')).toHaveTextContent('9.9.9, 9.9.10');
    // Newest release first, each in its own order.
    expect(within(days[0]).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('A later fix the same day'),
      expect.stringContaining('A brand new thing'),
      expect.stringContaining('A thing that was broken'),
    ]);
  });

  it('keeps a day with one release as one version', () => {
    render(<ChangelogPage {...defaultProps} />);

    const days = screen.getAllByRole('article');
    expect(within(days[1]).getByTestId('changelog-versions')).toHaveTextContent(/^9\.9\.8$/);
  });

  it('falls back to the raw string when the date cannot be parsed', () => {
    render(<ChangelogPage {...defaultProps} />);

    // A malformed date must not render as "Invalid Date" on a public page.
    expect(screen.getByText('not a date')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });

  it('labels each change type on its icon', () => {
    render(<ChangelogPage {...defaultProps} />);

    // The visible mark is an icon; the word is carried on title. Asserted here
    // because the icon alone does not say which kind of change it is.
    expect(screen.getByTitle('New')).toHaveTextContent('✦');
    for (const fixed of screen.getAllByTitle('Fixed')) expect(fixed).toHaveTextContent('✓');
    expect(screen.getByTitle('Improved')).toHaveTextContent('↑');
  });

  it('navigates to the roadmap from the footer', async () => {
    const user = userEvent.setup({ delay: null });
    const onRoadmapClick = vi.fn();
    render(<ChangelogPage {...defaultProps} onRoadmapClick={onRoadmapClick} />);

    await user.click(screen.getByRole('button', { name: 'Roadmap' }));

    expect(onRoadmapClick).toHaveBeenCalledTimes(1);
  });
});
