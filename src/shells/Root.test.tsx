import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppStart } from './PublicShell';
import { Root, LANDING_HANDOFF_CLASS } from './Root';

// The app shell stands in for everything Supabase-backed. If the public shell ever
// rendered it, or imported it statically, these tests would see the marker.
const appShellRender = vi.fn();
vi.mock('./AppShell', () => ({
  default: ({ start }: { start: AppStart }) => {
    appShellRender(start);
    return (
      <div data-testid="app-shell">
        {start.fromPublicShell ? 'from-public' : 'direct'}:{start.authModal ?? 'none'}
      </div>
    );
  },
}));

const markAppShellStarted = vi.fn();
vi.mock('./appShellStarted', () => ({ markAppShellStarted: () => markAppShellStarted() }));

const SESSION_KEY = 'sb-abcdefghijklmnop-auth-token';

function visit(url: string) {
  window.history.replaceState(null, '', url);
  return render(<Root />);
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  document.documentElement.classList.remove(LANDING_HANDOFF_CLASS);
  appShellRender.mockClear();
  markAppShellStarted.mockClear();
});

describe('Root', () => {
  it('renders the landing page for an anonymous visitor without loading the app shell', async () => {
    visit('/');
    expect(await screen.findAllByRole('button', { name: /^try writing$/i })).not.toHaveLength(0);
    expect(screen.queryByTestId('app-shell')).toBeNull();
    expect(appShellRender).not.toHaveBeenCalled();
    // Session Replay waits for this; an anonymous landing visit never sends it.
    expect(markAppShellStarted).not.toHaveBeenCalled();
  });

  it('renders a public page for an anonymous visitor without loading the app shell', async () => {
    visit('/privacy');
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(appShellRender).not.toHaveBeenCalled();
  });

  it('loads the app shell straight away when a session is stored, so / reaches the library', async () => {
    window.localStorage.setItem(SESSION_KEY, '{}');
    visit('/');
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('direct:none');
    expect(screen.queryByRole('button', { name: /^try writing$/i })).toBeNull();
    expect(markAppShellStarted).toHaveBeenCalled();
  });

  it('loads the app shell straight away for an OAuth callback', async () => {
    visit('/#access_token=a&refresh_token=b&token_type=bearer');
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('direct:none');
  });

  it('loads the app shell for a shared letter and for the Practice Space', async () => {
    const { unmount } = visit('/s/abcdefghijklmnopqrstuv#k=key');
    expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
    unmount();
    visit('/demo');
    expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
  });

  it('hands over to the app shell with the sign-in modal requested, without a reload', async () => {
    const user = userEvent.setup();
    visit('/');
    const signIn = (await screen.findAllByRole('button', { name: /^sign in$/i }))[0];
    await user.click(signIn);
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('from-public:login');
    expect(document.documentElement).toHaveClass(LANDING_HANDOFF_CLASS);
    expect(markAppShellStarted).toHaveBeenCalled();
  });

  it('hands over with the sign-up modal requested from Create an account', async () => {
    const user = userEvent.setup();
    visit('/');
    const start = await screen.findByRole('button', { name: /create an account/i });
    await user.click(start);
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('from-public:signup');
  });

  it('hands over when the visitor leaves the public routes for the Practice Space', async () => {
    const user = userEvent.setup();
    visit('/');
    await user.click((await screen.findAllByRole('button', { name: /^try writing$/i }))[0]);
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('from-public:none');
    expect(document.documentElement).not.toHaveClass(LANDING_HANDOFF_CLASS);
    expect(window.location.pathname).toBe('/demo/new');
  });

  it('hands over when Back or Forward reaches a route the public shell does not render', async () => {
    visit('/');
    await screen.findAllByRole('button', { name: /^try writing$/i });
    await act(async () => {
      window.history.pushState(null, '', '/faded');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
  });

  it('stays in the public shell while moving between public pages', async () => {
    const user = userEvent.setup();
    visit('/');
    const privacy = (await screen.findAllByRole('button', { name: /^privacy$/i }))[0];
    await user.click(privacy);
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/privacy');
    expect(appShellRender).not.toHaveBeenCalled();
  });

  it('keeps the landing on screen while the app shell chunk is still loading', async () => {
    // A fresh module graph, so the app chunk has not loaded in an earlier test, and a
    // chunk that arrives only when released.
    vi.resetModules();
    let release: () => void = () => {};
    const arrived = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.doMock('./AppShell', async () => {
      await arrived;
      return { default: () => <div data-testid="app-shell" /> };
    });
    const { Root: FreshRoot } = await import('./Root');
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/');
    render(<FreshRoot />);

    await user.click((await screen.findAllByRole('button', { name: /^try writing$/i }))[0]);
    expect(window.location.pathname).toBe('/demo/new');
    expect(screen.getAllByRole('button', { name: /^try writing$/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/loading|preparing/i)).toBeNull();

    release();
    expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
    vi.doUnmock('./AppShell');
  });
});
