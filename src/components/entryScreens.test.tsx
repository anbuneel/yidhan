import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderEntryScreen, type EntryScreenProps } from './entryScreens';

// The three signed-out screens are lazy chunks (shell-size plan A2). Stubs stand in for
// them so these tests check the loading, not the screens.
vi.mock('./Auth', () => ({
  Auth: ({ initialMode, isModal }: { initialMode?: string; isModal?: boolean }) => (
    <div data-testid="auth">{`${initialMode}:${isModal ? 'modal' : 'page'}`}</div>
  ),
}));
vi.mock('./NotFoundPage', () => ({ NotFoundPage: () => <div data-testid="not-found" /> }));
vi.mock('../pages/DemoPage', () => ({ DemoPage: () => <div data-testid="demo-page" /> }));
vi.mock('./LandingPage', () => ({ LandingPage: () => <div data-testid="landing" /> }));

function baseProps(overrides: Partial<EntryScreenProps> = {}): EntryScreenProps {
  return {
    route: { name: 'demo', noteId: 'starter-used-books' },
    theme: 'dark',
    onThemeToggle: vi.fn(),
    isSignedIn: false,
    isPasswordRecovery: false,
    onPasswordResetComplete: vi.fn(),
    shareRoute: null,
    onShareInvalid: vi.fn(),
    nav: {
      onLogoClick: vi.fn(),
      onChangelogClick: vi.fn(),
      onRoadmapClick: vi.fn(),
      onPrivacyClick: vi.fn(),
      onTermsClick: vi.fn(),
      onSupportClick: vi.fn(),
      onSecurityClick: vi.fn(),
    },
    onDemoClick: vi.fn(),
    onDemoDraftClick: vi.fn(),
    onDemoNoteClick: vi.fn(),
    onDemoNoteStarted: vi.fn(),
    onSignIn: vi.fn(),
    onSignUp: vi.fn(),
    onSettingsClick: vi.fn(),
    authModal: { isOpen: false, mode: 'login', onClose: vi.fn() },
    ...overrides,
  };
}

describe('renderEntryScreen', () => {
  it('returns null for a signed-in visitor at /demo/n/<id> so the signed-in app takes over', () => {
    const screen = renderEntryScreen(
      baseProps({
        route: { name: 'demo', noteId: 'starter-used-books' },
        isSignedIn: true,
      })
    );
    expect(screen).toBeNull();
  });

  it('renders the practice space entry for a signed-out visitor at /demo/n/<id>', () => {
    const screen = renderEntryScreen(
      baseProps({
        route: { name: 'demo', noteId: 'starter-used-books' },
        isSignedIn: false,
      })
    );
    expect(screen).not.toBeNull();
  });

  const cases: Array<[string, Partial<EntryScreenProps>, string, string | null]> = [
    ['the sign-in modal over the landing', { route: { name: 'library' }, authModal: { isOpen: true, mode: 'login', onClose: vi.fn() } }, 'auth', 'login:modal'],
    ['the sign-up modal over the Practice Space', { route: { name: 'demo' }, authModal: { isOpen: true, mode: 'signup', onClose: vi.fn() } }, 'auth', 'signup:modal'],
    ['the password reset page', { route: { name: 'library' }, isPasswordRecovery: true }, 'auth', 'reset:page'],
    ['the Practice Space', { route: { name: 'demo' } }, 'demo-page', null],
    ['the 404 page', { route: { name: 'notFound', path: '/nowhere' } }, 'not-found', null],
  ];

  it.each(cases)('renders %s from its lazy chunk, and again after a remount', async (_name, props, testId, text) => {
    const first = render(<>{renderEntryScreen(baseProps(props))}</>);
    const shown = await screen.findByTestId(testId);
    if (text) expect(shown).toHaveTextContent(text);
    first.unmount();
    expect(screen.queryByTestId(testId)).toBeNull();

    render(<>{renderEntryScreen(baseProps(props))}</>);
    expect(await screen.findByTestId(testId)).toBeInTheDocument();
  });

  it('renders no sign-in screen while the auth modal is closed', async () => {
    render(<>{renderEntryScreen(baseProps({ route: { name: 'library' } }))}</>);
    expect(await screen.findByTestId('landing')).toBeInTheDocument();
    expect(screen.queryByTestId('auth')).toBeNull();
  });
});
