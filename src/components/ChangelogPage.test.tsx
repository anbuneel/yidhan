import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The real changelog grows with every release, so tests asserting its content
// would break on each entry. Mock it and assert the rendering instead.
vi.mock('../data/changelog', () => ({
  changelog: [
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
    expect(screen.getByText('Mar 14, 2026')).toBeInTheDocument();
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
    expect(screen.getByTitle('Fixed')).toHaveTextContent('✓');
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
