/**
 * Which shell a page load starts in (item 61, step 5).
 *
 * The public shell renders the landing page and the public pages with React, the
 * router and the theme, and nothing else: no Supabase, no Dexie, no sync engine. The
 * app shell is everything, loaded lazily. A visitor starts in the public shell only
 * when nothing on this load can need Supabase:
 *
 * - no stored Supabase session;
 * - no auth callback in the URL: OAuth, magic-link and password-reset redirects carry
 *   tokens or a code that Supabase must read on this load, before anything else;
 * - no shared content waiting from the share target, which opens the sign-up modal;
 * - and a public route: `/`, `/privacy`, `/terms`, `/support`, `/security`,
 *   `/changelog` or `/roadmap`. Everything else, `/demo` and `/s/...` included,
 *   starts the app shell.
 *
 * The public shell hands over to the app shell, without a reload, when the visitor
 * opens sign-in or sign-up or leaves the public routes.
 *
 * public/boot.js makes the same decision before the bundle loads, to hide the static
 * landing shell whenever the app shell will start. Change both together;
 * appGate.test.ts runs boot.js against this function.
 */

import { isPublicPageRoute, parseRoute, type Route } from './routing/routes';

/** Matches `sb-<project-ref>-auth-token`, Supabase's default storage key. */
export function isSupabaseSessionKey(key: string | null): boolean {
  return !!key && key.indexOf('sb-') === 0 && key.indexOf('-auth-token') !== -1;
}

/** Where the share target keeps content for a visitor who has not signed in yet (src/hooks/useShareTarget.ts). */
export const SHARE_STORAGE_KEY = 'yidhan-shared-content';

function storageHolds(storage: Storage, test: (key: string | null) => boolean): boolean {
  for (let i = 0; i < storage.length; i++) {
    if (test(storage.key(i))) return true;
  }
  return false;
}

/**
 * Tokens or a code an auth redirect leaves in the URL. Implicit flow puts
 * `access_token` (or `error_description`) in the fragment; PKCE puts `code` in the
 * query. `reset=true` is our own password-reset redirect.
 */
export function hasAuthCallback(search: string, hash: string): boolean {
  const query = new URLSearchParams(search);
  if (query.has('code') || query.has('error_description') || query.get('reset') === 'true') return true;
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  return fragment.has('access_token') || fragment.has('refresh_token') || fragment.has('error_description');
}

/**
 * The routes the public shell renders. `/` parses as the library route; signed out,
 * it is the landing page. The gate asks this at startup and the public shell asks it
 * on every navigation, so the two cannot disagree about a route.
 */
export function isPublicShellRoute(route: Route): boolean {
  return route.name === 'library' || isPublicPageRoute(route);
}

export function isPublicShellPath(pathname: string): boolean {
  return isPublicShellRoute(parseRoute(pathname));
}

export interface GateInput {
  pathname: string;
  search: string;
  hash: string;
  /** `null` when storage cannot be read. */
  storage: Storage | null;
}

export function readGateInput(): GateInput {
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    storage,
  };
}

/** True when this load must start the full app shell rather than the public one. */
export function shouldStartApp({ pathname, search, hash, storage }: GateInput): boolean {
  if (!isPublicShellPath(pathname)) return true;
  if (hasAuthCallback(search, hash)) return true;
  if (new URLSearchParams(search).get('share') === 'true') return true;
  try {
    // Unreadable storage cannot hold a session Supabase could restore either, so the
    // public shell is right; sign-in still loads the app.
    if (storage && storageHolds(storage, isSupabaseSessionKey)) return true;
    if (storage && storage.getItem(SHARE_STORAGE_KEY) !== null) return true;
  } catch {
    return false;
  }
  return false;
}
