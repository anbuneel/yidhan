import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderEntryScreen, type EntryScreenProps } from './entryScreens';
import { BootBlankScreen, LoadingFallback } from './LoadingFallback';
import { APP_LOADER_DELAY_MS, appBootScreen, resetAppBootForTests, useAppBoot } from '../hooks/useAppLoader';

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

// App's order: the boot gate first, then the entry screens. `user` is null while auth
// resolves, so the entry screens alone would read a signed-in reload as signed out.
function BootThenEntry({ authLoading, loading }: { authLoading: boolean; loading: boolean }) {
  const phase = useAppBoot(authLoading || loading);
  const boot = appBootScreen(phase, { authLoading, fromPublicShell: false });
  if (boot === 'loader') return <LoadingFallback message="Preparing your space..." />;
  if (boot === 'blank') return <BootBlankScreen />;
  return <>{renderEntryScreen(baseProps({ route: { name: 'library' }, isSignedIn: !authLoading }))}</>;
}

describe('the boot gate in front of the entry screens (shell-size plan C7)', () => {
  it('never paints the landing page on a signed-in reload, inside the delay or after it', () => {
    vi.useFakeTimers();
    resetAppBootForTests();
    try {
      const { rerender } = render(<BootThenEntry authLoading loading={false} />);
      expect(screen.getByTestId('boot-blank')).toBeInTheDocument();
      expect(screen.queryByTestId('landing')).toBeNull();

      act(() => vi.advanceTimersByTime(APP_LOADER_DELAY_MS));
      expect(screen.getByText('Preparing your space...')).toBeInTheDocument();
      expect(screen.queryByTestId('landing')).toBeNull();

      // Auth resolves with a user: the entry screens step aside for the library.
      rerender(<BootThenEntry authLoading={false} loading={false} />);
      expect(screen.queryByTestId('landing')).toBeNull();
      expect(screen.queryByTestId('boot-blank')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
