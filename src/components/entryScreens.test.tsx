import { describe, expect, it, vi } from 'vitest';
import { renderEntryScreen, type EntryScreenProps } from './entryScreens';

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
});
