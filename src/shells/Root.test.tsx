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

// The signed-out screens' chunks (shell-size plan A2). Root warms the one the app
// shell is about to show; these spies record which.
const preloads = vi.hoisted(() => ({ auth: vi.fn(), demo: vi.fn(), notFound: vi.fn() }));
vi.mock('../components/entryScreenChunks', () => ({
  Auth: { preload: preloads.auth },
  DemoPage: { preload: preloads.demo },
  NotFoundPage: { preload: preloads.notFound },
}));
const preloaded = () => ({
  auth: preloads.auth.mock.calls.length,
  demo: preloads.demo.mock.calls.length,
  notFound: preloads.notFound.mock.calls.length,
});

const SESSION_KEY = 'sb-abcdefghijklmnop-auth-token';

function visit(url: string) {
  window.history.replaceState(null, '', url);
  return render(<Root />);
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  document.documentElement.classList.remove(LANDING_HANDOFF_CLASS);
  appShellRender.mockClear();
  Object.values(preloads).forEach((spy) => spy.mockClear());
  window.localStorage.clear();
});

describe('Root', () => {
  it('renders the landing page for an anonymous visitor without loading the app shell', async () => {
    visit('/');
    expect(await screen.findAllByRole('button', { name: /^try writing$/i })).not.toHaveLength(0);
    expect(screen.queryByTestId('app-shell')).toBeNull();
    expect(appShellRender).not.toHaveBeenCalled();
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

  it('hands over when the visitor clicks a sample note link on the landing page', async () => {
    const user = userEvent.setup();
    visit('/');
    const sample = await screen.findByRole('link', { name: /open “why i still buy used books”/i });
    await user.click(sample);
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('from-public:none');
    expect(window.location.pathname).toBe('/demo/n/starter-used-books');
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

  it('hands over when another tab signs in, and ignores other storage changes', async () => {
    visit('/');
    await screen.findAllByRole('button', { name: /^try writing$/i });
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'yidhan-theme', newValue: 'light' }));
      // A sign-out elsewhere removes the key; nothing to hand over for.
      window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY, newValue: null }));
    });
    expect(appShellRender).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY, newValue: '{}' }));
    });
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('from-public:none');
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

  describe('warming the signed-out screen chunks', () => {
    it('warms nothing on an anonymous landing or public page visit', async () => {
      const { unmount } = visit('/');
      await screen.findAllByRole('button', { name: /^try writing$/i });
      unmount();
      visit('/privacy');
      await screen.findByRole('heading', { level: 1 });
      expect(preloaded()).toEqual({ auth: 0, demo: 0, notFound: 0 });
    });

    it('warms nothing for a signed-in reader on /', async () => {
      window.localStorage.setItem(SESSION_KEY, '{}');
      visit('/');
      await screen.findByTestId('app-shell');
      expect(preloaded()).toEqual({ auth: 0, demo: 0, notFound: 0 });
    });

    it('warms Auth when sign-in is clicked, not the Practice Space', async () => {
      const user = userEvent.setup();
      visit('/');
      await user.click((await screen.findAllByRole('button', { name: /^sign in$/i }))[0]);
      await screen.findByTestId('app-shell');
      expect(preloaded()).toEqual({ auth: 1, demo: 0, notFound: 0 });
    });

    it('warms the Practice Space from Try writing, not Auth', async () => {
      const user = userEvent.setup();
      visit('/');
      await user.click((await screen.findAllByRole('button', { name: /^try writing$/i }))[0]);
      await screen.findByTestId('app-shell');
      expect(preloaded()).toEqual({ auth: 0, demo: 1, notFound: 0 });
    });

    it('warms the screen of a direct visit: the Practice Space, a 404, a recovery link', async () => {
      let view = visit('/demo');
      await screen.findByTestId('app-shell');
      expect(preloaded()).toEqual({ auth: 0, demo: 1, notFound: 0 });
      view.unmount();

      view = visit('/no-such-page');
      await screen.findByTestId('app-shell');
      expect(preloads.notFound).toHaveBeenCalledTimes(1);
      view.unmount();

      visit('/#access_token=a&refresh_token=b&type=recovery');
      await screen.findByTestId('app-shell');
      expect(preloads.auth).toHaveBeenCalledTimes(1);
    });

    it('warms Auth for our own password-reset redirect, /?reset=true&code=', async () => {
      visit('/?reset=true&code=abc');
      await screen.findByTestId('app-shell');
      expect(preloaded()).toEqual({ auth: 1, demo: 0, notFound: 0 });
    });

    it('does not warm Auth for a sign-in callback that is not a reset', async () => {
      let view = visit('/?code=abc');
      await screen.findByTestId('app-shell');
      view.unmount();
      view = visit('/?reset=false&code=abc');
      await screen.findByTestId('app-shell');
      view.unmount();
      visit('/#access_token=a&refresh_token=b&type=magiclink');
      await screen.findByTestId('app-shell');
      expect(preloads.auth).not.toHaveBeenCalled();
    });
  });
});
