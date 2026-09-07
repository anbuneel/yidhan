import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecurityPage } from './SecurityPage';
import { PrivacyPage } from './PrivacyPage';

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
  onPrivacyClick: () => undefined,
  onTermsClick: () => undefined,
  onSupportClick: () => undefined,
};

describe('SecurityPage', () => {
  /**
   * These assert the page keeps making its uncomfortable admissions. A security page
   * that quietly loses the "what is visible even so" section becomes marketing, and
   * nothing else in the test suite would notice.
   */
  it('names the metadata that stays visible', () => {
    render(<SecurityPage {...nav} />);

    expect(screen.getByText(/Timestamps\./)).toBeInTheDocument();
    expect(screen.getByText(/Sizes\./)).toBeInTheDocument();
    expect(screen.getByText(/Tag names\./)).toBeInTheDocument();
  });

  it('says tag names are plaintext today, without softening it', () => {
    render(<SecurityPage {...nav} />);
    expect(screen.getByText(/stored in plaintext today/i)).toBeInTheDocument();
  });

  it('admits an unlocked vault does not survive a compromised browser', () => {
    render(<SecurityPage {...nav} />);
    expect(screen.getByText(/compromised browser/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot protect a device that is already/i)).toBeInTheDocument();
  });

  it('states the cost of "Remember this browser"', () => {
    render(<SecurityPage {...nav} />);
    expect(screen.getByText(/anyone with access to that browser profile/i)).toBeInTheDocument();
  });

  it('says a forgotten passphrase cannot be recovered', () => {
    render(<SecurityPage {...nav} />);
    expect(screen.getByText(/if the passphrase is gone, so are the notes/i)).toBeInTheDocument();
  });

  it('says practice drafts are not encrypted', () => {
    render(<SecurityPage {...nav} />);
    expect(screen.getByText(/without encryption/i)).toBeInTheDocument();
  });

  it('admits there has been no independent review', () => {
    render(<SecurityPage {...nav} />);
    expect(screen.getByText(/has not had one yet/i)).toBeInTheDocument();
  });

  it('says the share link is the key', () => {
    render(<SecurityPage {...nav} />);
    expect(screen.getByText(/anyone they forward it to, can read that note/i)).toBeInTheDocument();
  });

  it('points at security.txt and a contact address', () => {
    render(<SecurityPage {...nav} />);

    expect(screen.getByRole('link', { name: /security@yidhan\.app/i })).toHaveAttribute(
      'href',
      'mailto:security@yidhan.app'
    );
    expect(screen.getByRole('link', { name: /security\.txt/i })).toHaveAttribute(
      'href',
      '/.well-known/security.txt'
    );
  });

  it('promises not to threaten a good-faith reporter', () => {
    render(<SecurityPage {...nav} />);
    expect(screen.getByText(/will not threaten you/i)).toBeInTheDocument();
  });

  it('points at the outbound data inventory rather than summarising it', () => {
    render(<SecurityPage {...nav} />);
    expect(screen.getByText(/docs\/reference\/outbound-data\.md/)).toBeInTheDocument();
  });
});

describe('PrivacyPage links to the threat model', () => {
  it('offers a way through to the security page', async () => {
    const onSecurityClick = vi.fn();
    const user = userEvent.setup();
    render(<PrivacyPage {...nav} onSecurityClick={onSecurityClick} />);

    await user.click(screen.getByRole('button', { name: /security page/i }));
    expect(onSecurityClick).toHaveBeenCalledTimes(1);
  });
});
