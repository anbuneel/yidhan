import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LandingPage } from './LandingPage';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useInstallPrompt', () => ({
  useInstallPrompt: () => ({ isInstallable: false, isInstalled: false, triggerInstall: vi.fn() }),
}));

function renderLanding() {
  const props = {
    onStartWriting: vi.fn(),
    onSignIn: vi.fn(),
    theme: 'dark' as const,
    onThemeToggle: vi.fn(),
    onDemoClick: vi.fn(),
    onDemoDraftClick: vi.fn(),
    onSecurityClick: vi.fn(),
    onChangelogClick: vi.fn(),
    onRoadmapClick: vi.fn(),
    onPrivacyClick: vi.fn(),
    onTermsClick: vi.fn(),
    onSupportClick: vi.fn(),
  };
  render(<LandingPage {...props} />);
  return props;
}

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: null, signOut: vi.fn() } as unknown as ReturnType<typeof useAuth>);
  });

  it('names the product and states the promise in the first screen', () => {
    renderLanding();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/personal notes/i);
    expect(screen.getByText(/locked on your device before it syncs/i)).toBeInTheDocument();
    expect(screen.getByText(/free to use\. no account needed to try\./i)).toBeInTheDocument();
  });

  it('every Try writing opens the Practice Space draft and never an in-page editor', () => {
    const props = renderLanding();

    const buttons = screen.getAllByRole('button', { name: /try writing/i });
    // The two labelled buttons plus the preview overlay.
    expect(buttons).toHaveLength(3);
    buttons.forEach((button) => fireEvent.click(button));

    expect(props.onDemoDraftClick).toHaveBeenCalledTimes(3);
    expect(props.onStartWriting).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('the keep-and-sync link opens sign-up without also opening the draft', () => {
    const props = renderLanding();

    fireEvent.click(screen.getByRole('button', { name: /create an account to keep and sync/i }));

    expect(props.onStartWriting).toHaveBeenCalledTimes(1);
    expect(props.onDemoDraftClick).not.toHaveBeenCalled();
  });

  it('shows three sample notes, none of them the welcome or the hero note', () => {
    const props = renderLanding();

    const openers = screen.getAllByRole('button', { name: /^open “.+” in the practice space$/i });
    expect(openers).toHaveLength(3);
    expect(screen.queryByText('Welcome to Yidhan')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'An idea for Saturday' })).not.toBeInTheDocument();

    fireEvent.click(openers[0]);
    expect(props.onDemoClick).toHaveBeenCalledTimes(1);
  });

  it('routes a plain click on Explore sample notes in-app but leaves a modified click to the browser', () => {
    const props = renderLanding();
    const link = screen.getByRole('link', { name: /explore sample notes/i });
    expect(link).toHaveAttribute('href', '/demo');

    fireEvent.click(link, { metaKey: true });
    expect(props.onDemoClick).not.toHaveBeenCalled();

    fireEvent.click(link);
    expect(props.onDemoClick).toHaveBeenCalledTimes(1);
  });

  it('the encryption fact and the locking link both reach the security page', () => {
    const props = renderLanding();

    fireEvent.click(screen.getByRole('button', { name: /encrypted before it syncs/i }));
    fireEvent.click(screen.getByRole('button', { name: /how the locking works/i }));

    expect(props.onSecurityClick).toHaveBeenCalledTimes(2);
  });

  it('the header sign-in reaches sign-in, not sign-up', () => {
    const props = renderLanding();

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(props.onSignIn).toHaveBeenCalledTimes(1);
    expect(props.onStartWriting).not.toHaveBeenCalled();
  });
});
