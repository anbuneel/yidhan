/**
 * The route table.
 *
 * Pure functions over a pathname — no `window`, no React, no side effects — so the
 * whole address space of the app is testable without a browser. `useRouter` owns
 * the History API; this file owns what a URL *means*.
 */

import type { ViewMode } from '../types';

/** Public pages that are nothing but a static route segment. */
const PUBLIC_PAGE_ROUTES = ['changelog', 'roadmap', 'privacy', 'terms', 'support', 'security'] as const;

export type PublicPageName = (typeof PUBLIC_PAGE_ROUTES)[number];

export type Route =
  | { name: 'library' }
  | { name: 'note'; noteId: string }
  | { name: 'faded' }
  /**
   * `newNote` addresses `/demo/new`: open the Practice Space with a fresh, empty note
   * already in the editor. It is what the mobile "Start writing" button reaches, so
   * one tap lands on a blinking caret rather than on a library (item 45).
   */
  | { name: 'demo'; newNote?: boolean }
  | { name: PublicPageName }
  | { name: 'share'; token: string }
  | { name: 'playground' }
  | { name: 'notFound'; path: string };


export interface ParseRouteOptions {
  /** The playground is a dev-only design surface; in production its path is a 404. */
  allowPlayground?: boolean;
}

/**
 * A note id as it may appear in a path. Deliberately permissive — real notes carry
 * UUIDs, demo starters carry `starter-welcome` — but bounded, so a path cannot smuggle
 * a slash, a traversal, or an unbounded string into the route.
 *
 * An id that is well-formed but unknown is NOT a 404: it resolves to the library with
 * a notice once the notes have loaded (item 29). Only a malformed *shape* is a 404.
 */
const NOTE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Share tokens are fixed-width base64url — see `utils/shareRoute`. */
const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/**
 * Collapse a pathname to its canonical form: no trailing slash, `/` for the root.
 * `/faded/` and `/faded` are the same place; `//` is the root.
 */
export function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

function isPublicPageName(segment: string): segment is PublicPageName {
  return (PUBLIC_PAGE_ROUTES as readonly string[]).includes(segment);
}

/** Turn a pathname into the route it names. Never throws; unknown paths are `notFound`. */
export function parseRoute(pathname: string, options: ParseRouteOptions = {}): Route {
  const path = normalizePath(pathname);

  if (path === '/') return { name: 'library' };
  if (path === '/faded') return { name: 'faded' };
  if (path === '/demo') return { name: 'demo' };
  if (path === '/demo/new') return { name: 'demo', newNote: true };
  if (path === '/playground') {
    return options.allowPlayground ? { name: 'playground' } : { name: 'notFound', path };
  }

  const segments = path.slice(1).split('/');

  if (segments.length === 1 && isPublicPageName(segments[0])) {
    return { name: segments[0] };
  }

  if (segments[0] === 'n') {
    const noteId = segments[1];
    if (segments.length === 2 && noteId && NOTE_ID_PATTERN.test(noteId)) {
      return { name: 'note', noteId };
    }
    return { name: 'notFound', path };
  }

  // `/s/<token>` and `/s/<token>/<slug>` are both the same shared letter. The slug is
  // decoration for the person receiving the link; only the token addresses anything.
  if (segments[0] === 's') {
    const token = segments[1];
    if (segments.length <= 3 && token && SHARE_TOKEN_PATTERN.test(token)) {
      return { name: 'share', token };
    }
    return { name: 'notFound', path };
  }

  return { name: 'notFound', path };
}

/**
 * The path a route lives at.
 *
 * `notFound` returns the path it was parsed from, so a bad URL stays visible in the
 * address bar instead of being quietly rewritten to `/` — the same reason the old
 * `notFound` state suppressed the path-sync effect.
 */
export function routeToPath(route: Route): string {
  switch (route.name) {
    case 'library':
      return '/';
    case 'note':
      return `/n/${route.noteId}`;
    case 'faded':
      return '/faded';
    case 'demo':
      return route.newNote ? '/demo/new' : '/demo';
    case 'playground':
      return '/playground';
    case 'share':
      return `/s/${route.token}`;
    case 'notFound':
      return route.path;
    default:
      return `/${route.name}`;
  }
}

export function isSameRoute(a: Route, b: Route): boolean {
  if (a.name !== b.name) return false;
  if (a.name === 'note' && b.name === 'note') return a.noteId === b.noteId;
  if (a.name === 'share' && b.name === 'share') return a.token === b.token;
  if (a.name === 'notFound' && b.name === 'notFound') return a.path === b.path;
  // `/demo` and `/demo/new` are the same screen but not the same intent: replacing one
  // with the other is how the "new note" intent is consumed after it fires.
  if (a.name === 'demo' && b.name === 'demo') return Boolean(a.newNote) === Boolean(b.newNote);
  return true;
}

/**
 * The `ViewMode` a route renders as.
 *
 * `ViewMode` is the render switch App has always used; `Route` is the address. They
 * are not the same thing — `/n/<id>` and `/demo` both render through views that the
 * URL does not name one-to-one — so the mapping is explicit rather than a cast.
 */
export function routeToViewMode(route: Route): ViewMode {
  switch (route.name) {
    case 'note':
      return 'editor';
    case 'faded':
      return 'faded';
    case 'changelog':
    case 'roadmap':
    case 'privacy':
    case 'terms':
    case 'support':
    case 'security':
      return route.name;
    default:
      return 'library';
  }
}

/** Routes whose scroll offset is worth restoring when the user comes back to them. */
export function isScrollRestoringRoute(route: Route): boolean {
  return route.name === 'library' || route.name === 'faded';
}
