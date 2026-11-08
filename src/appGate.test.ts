import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SHARE_STORAGE_KEY,
  hasAuthCallback,
  isPublicShellPath,
  isSupabaseSessionKey,
  shouldStartApp,
  type GateInput,
} from './appGate';

const SESSION_KEY = 'sb-abcdefghijklmnop-auth-token';

function storageWith(entries: Record<string, string>): Storage {
  const keys = Object.keys(entries);
  return {
    get length() {
      return keys.length;
    },
    key: (index: number) => keys[index] ?? null,
    getItem: (key: string) => entries[key] ?? null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
}

function gate(overrides: Partial<GateInput> = {}): boolean {
  return shouldStartApp({ pathname: '/', search: '', hash: '', storage: storageWith({}), ...overrides });
}

describe('shouldStartApp', () => {
  it('keeps an anonymous visitor on a public route in the public shell', () => {
    for (const pathname of ['/', '/privacy', '/terms', '/support', '/security', '/changelog', '/roadmap', '/roadmap/']) {
      expect(gate({ pathname }), pathname).toBe(false);
    }
  });

  it('starts the app on every route the public shell does not render', () => {
    for (const pathname of ['/demo', '/demo/new', '/faded', '/n/abc', '/s/abcdefghijklmnopqrstuv', '/nowhere']) {
      expect(gate({ pathname }), pathname).toBe(true);
    }
  });

  it('starts the app for a stored Supabase session, so a signed-in visitor on / reaches the library', () => {
    expect(gate({ storage: storageWith({ [SESSION_KEY]: '{}' }) })).toBe(true);
    expect(gate({ pathname: '/privacy', storage: storageWith({ [SESSION_KEY]: '{}' }) })).toBe(true);
  });

  it('ignores other storage keys, including ones that look close', () => {
    expect(
      gate({ storage: storageWith({ 'yidhan-theme': 'dark', 'sb-token': 'x', 'my-sb-x-auth-token': 'x' }) })
    ).toBe(false);
  });

  it('starts the app for an OAuth, magic-link or reset callback, which Supabase must read on this load', () => {
    expect(gate({ hash: '#access_token=a&refresh_token=b&type=bearer' })).toBe(true);
    expect(gate({ hash: '#error=access_denied&error_description=denied' })).toBe(true);
    expect(gate({ search: '?code=abc' })).toBe(true);
    expect(gate({ search: '?reset=true', hash: '#access_token=a&type=recovery' })).toBe(true);
  });

  it('does not treat an ordinary fragment or query as a callback', () => {
    expect(gate({ hash: '#features' })).toBe(false);
    expect(gate({ search: '?utm_source=x' })).toBe(false);
  });

  it('starts the app for share-target content, new or waiting', () => {
    expect(gate({ search: '?share=true&text=hello' })).toBe(true);
    expect(gate({ storage: storageWith({ [SHARE_STORAGE_KEY]: '{"text":"hi"}' }) })).toBe(true);
  });

  it('stays public when storage cannot be read, since Supabase could not restore a session either', () => {
    expect(gate({ storage: null })).toBe(false);
    const throwing = storageWith({});
    Object.defineProperty(throwing, 'length', {
      get() {
        throw new Error('SecurityError');
      },
    });
    expect(gate({ storage: throwing })).toBe(false);
  });
});

describe('helpers', () => {
  it('matches the Supabase session key shape and nothing else', () => {
    expect(isSupabaseSessionKey(SESSION_KEY)).toBe(true);
    expect(isSupabaseSessionKey('sb-x-auth-token-code-verifier')).toBe(true);
    expect(isSupabaseSessionKey(null)).toBe(false);
    expect(isSupabaseSessionKey('yidhan-theme')).toBe(false);
  });

  it('reads callbacks from both the query and the fragment', () => {
    expect(hasAuthCallback('', '#refresh_token=x')).toBe(true);
    expect(hasAuthCallback('?error_description=x', '')).toBe(true);
    expect(hasAuthCallback('?reset=false', '')).toBe(false);
  });

  it('treats only / and the six public pages as public-shell paths', () => {
    expect(isPublicShellPath('/')).toBe(true);
    expect(isPublicShellPath('/security')).toBe(true);
    expect(isPublicShellPath('/demo')).toBe(false);
  });
});

// public/boot.js hides the landing shell when a session exists, before the bundle
// loads. If it and the gate disagreed, a signed-in visitor would see the landing flash
// before the library, or an anonymous one a blank page before the landing.
describe('public/boot.js agrees with the gate', () => {
  const bootSource = readFileSync(resolve(__dirname, '../public/boot.js'), 'utf8');

  afterEach(() => {
    document.documentElement.classList.remove('boot-hidden');
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  function bootHides(): boolean {
    document.documentElement.classList.remove('boot-hidden');
    new Function(bootSource)();
    return document.documentElement.classList.contains('boot-hidden');
  }

  const cases: { name: string; url: string; storage?: Record<string, string> }[] = [
    { name: 'anonymous on /', url: '/' },
    { name: 'session on /', url: '/', storage: { [SESSION_KEY]: '{}' } },
    { name: 'near-miss key on /', url: '/', storage: { 'sb-token': 'x' } },
    { name: 'OAuth callback on /', url: '/#access_token=a&refresh_token=b' },
    { name: 'OAuth error on /', url: '/#error=access_denied&error_description=no' },
    { name: 'PKCE code on /', url: '/?code=abc' },
    { name: 'password reset on /', url: '/?reset=true#access_token=a&type=recovery' },
    { name: 'share target on /', url: '/?share=true&text=hi' },
    { name: 'waiting share on /', url: '/', storage: { [SHARE_STORAGE_KEY]: '{}' } },
    { name: 'ordinary fragment on /', url: '/#features' },
    { name: 'anonymous on /privacy', url: '/privacy' },
  ];

  for (const { name, url, storage = {} } of cases) {
    it(name, () => {
      window.history.replaceState(null, '', url);
      for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value);
      const { pathname: path, search, hash } = window.location;
      const startsApp = gate({ pathname: path, search, hash, storage: storageWith(storage) });
      // On `/`, the shell shows exactly when the gate keeps the public shell. Off `/`,
      // boot.js always hides it, whichever shell React renders.
      if (path === '/') expect(bootHides()).toBe(startsApp);
      else expect(bootHides()).toBe(true);
    });
  }
});
