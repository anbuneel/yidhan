import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SupportPage } from './SupportPage';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}));

const nav = {
  theme: 'dark' as const,
  onThemeToggle: () => undefined,
  onSignIn: () => undefined,
  onLogoClick: () => undefined,
  onChangelogClick: () => undefined,
  onRoadmapClick: () => undefined,
};

describe('SupportPage', () => {
  it('says plainly who runs Yidhan and what support to expect', () => {
    render(<SupportPage {...nav} />);

    const paragraph = screen.getByText(/maintained by one person, with no company/i);
    expect(paragraph).toHaveTextContent(/free and open source/i);
    expect(paragraph).toHaveTextContent(/reply within a few days/i);
    expect(paragraph).toHaveTextContent(/no support team and no guaranteed response time/i);
    expect(paragraph).toHaveTextContent(/the code is public/i);
    expect(paragraph).toHaveTextContent(/lose both your passphrase and your recovery key/i);
    // No absolute claim about who can open notes: tags, dates and sizes stay visible.
    expect(paragraph).not.toHaveTextContent(/no one can open/i);
    expect(screen.getByRole('link', { name: 'anbs.dev@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:anbs.dev@gmail.com'
    );
  });

  it('asks for nothing: no donation or funding appeal', () => {
    render(<SupportPage {...nav} />);
    expect(document.body).not.toHaveTextContent(/donat|sponsor|patreon|fund|tip jar|buy me/i);
  });
});
