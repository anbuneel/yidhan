import { describe, it, expect } from 'vitest';
import {
  isSameRoute,
  isScrollRestoringRoute,
  normalizePath,
  parseRoute,
  routeToPath,
  routeToViewMode,
  type Route,
} from './routes';

describe('normalizePath', () => {
  it('collapses trailing slashes', () => {
    expect(normalizePath('/faded/')).toBe('/faded');
    expect(normalizePath('/faded///')).toBe('/faded');
  });

  it('keeps the root as a single slash', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('//')).toBe('/');
    expect(normalizePath('')).toBe('/');
  });
});

describe('parseRoute', () => {
  it('reads the library at the root', () => {
    expect(parseRoute('/')).toEqual({ name: 'library' });
  });

  it('reads a note address', () => {
    expect(parseRoute('/n/9f8b2c1a-0000-4000-8000-abcdefabcdef')).toEqual({
      name: 'note',
      noteId: '9f8b2c1a-0000-4000-8000-abcdefabcdef',
    });
  });

  it('accepts the non-UUID ids the demo starters use', () => {
    expect(parseRoute('/n/starter-welcome')).toEqual({ name: 'note', noteId: 'starter-welcome' });
  });

  it('reads faded and demo', () => {
    expect(parseRoute('/faded')).toEqual({ name: 'faded' });
    expect(parseRoute('/demo')).toEqual({ name: 'demo' });
  });

  it('reads every public page', () => {
    for (const page of ['changelog', 'roadmap', 'privacy', 'terms', 'support'] as const) {
      expect(parseRoute(`/${page}`)).toEqual({ name: page });
    }
  });

  it('reads a share route with and without a slug', () => {
    const token = 'abcdefghijklmnopqrstuv';
    expect(parseRoute(`/s/${token}`)).toEqual({ name: 'share', token });
    expect(parseRoute(`/s/${token}/my-letter`)).toEqual({ name: 'share', token });
  });

  it('rejects a share token of the wrong width', () => {
    expect(parseRoute('/s/tooshort')).toEqual({ name: 'notFound', path: '/s/tooshort' });
  });

  it('gates the playground behind the dev flag', () => {
    expect(parseRoute('/playground')).toEqual({ name: 'notFound', path: '/playground' });
    expect(parseRoute('/playground', { allowPlayground: true })).toEqual({ name: 'playground' });
  });

  it('treats a malformed note path as not found, not as a note', () => {
    expect(parseRoute('/n/')).toEqual({ name: 'notFound', path: '/n' });
    expect(parseRoute('/n/a/b')).toEqual({ name: 'notFound', path: '/n/a/b' });
    expect(parseRoute('/n/../../etc/passwd')).toEqual({
      name: 'notFound',
      path: '/n/../../etc/passwd',
    });
  });

  it('keeps the offending path on a 404 so the address bar still shows it', () => {
    expect(parseRoute('/nope')).toEqual({ name: 'notFound', path: '/nope' });
  });

  it('ignores a trailing slash everywhere', () => {
    expect(parseRoute('/n/abc/')).toEqual({ name: 'note', noteId: 'abc' });
    expect(parseRoute('/privacy/')).toEqual({ name: 'privacy' });
  });
});

describe('routeToPath', () => {
  const cases: Array<[Route, string]> = [
    [{ name: 'library' }, '/'],
    [{ name: 'note', noteId: 'abc' }, '/n/abc'],
    [{ name: 'faded' }, '/faded'],
    [{ name: 'demo' }, '/demo'],
    [{ name: 'changelog' }, '/changelog'],
    [{ name: 'support' }, '/support'],
    [{ name: 'playground' }, '/playground'],
    [{ name: 'share', token: 'abcdefghijklmnopqrstuv' }, '/s/abcdefghijklmnopqrstuv'],
    [{ name: 'notFound', path: '/nope' }, '/nope'],
  ];

  it.each(cases)('serializes %j', (route, path) => {
    expect(routeToPath(route)).toBe(path);
  });

  it('round-trips every addressable route', () => {
    for (const [route] of cases) {
      if (route.name === 'notFound') continue;
      expect(parseRoute(routeToPath(route), { allowPlayground: true })).toEqual(route);
    }
  });
});

describe('isSameRoute', () => {
  it('separates two different notes', () => {
    expect(isSameRoute({ name: 'note', noteId: 'a' }, { name: 'note', noteId: 'b' })).toBe(false);
    expect(isSameRoute({ name: 'note', noteId: 'a' }, { name: 'note', noteId: 'a' })).toBe(true);
  });

  it('separates two different 404s', () => {
    expect(isSameRoute({ name: 'notFound', path: '/a' }, { name: 'notFound', path: '/b' })).toBe(
      false
    );
  });

  it('treats parameterless routes of the same name as one place', () => {
    expect(isSameRoute({ name: 'library' }, { name: 'library' })).toBe(true);
    expect(isSameRoute({ name: 'library' }, { name: 'faded' })).toBe(false);
  });
});

describe('routeToViewMode', () => {
  it('renders a note address through the editor view', () => {
    expect(routeToViewMode({ name: 'note', noteId: 'abc' })).toBe('editor');
  });

  it('renders the demo and unknown addresses through the library view', () => {
    expect(routeToViewMode({ name: 'demo' })).toBe('library');
    expect(routeToViewMode({ name: 'notFound', path: '/x' })).toBe('library');
    expect(routeToViewMode({ name: 'share', token: 'abcdefghijklmnopqrstuv' })).toBe('library');
  });

  it('passes public pages through by name', () => {
    expect(routeToViewMode({ name: 'privacy' })).toBe('privacy');
    expect(routeToViewMode({ name: 'faded' })).toBe('faded');
  });
});

describe('isScrollRestoringRoute', () => {
  it('remembers the two list views and nothing else', () => {
    expect(isScrollRestoringRoute({ name: 'library' })).toBe(true);
    expect(isScrollRestoringRoute({ name: 'faded' })).toBe(true);
    expect(isScrollRestoringRoute({ name: 'note', noteId: 'a' })).toBe(false);
    expect(isScrollRestoringRoute({ name: 'privacy' })).toBe(false);
  });
});
