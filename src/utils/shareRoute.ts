import { fromBase64Url } from '../lib/encryption';

const EMPTY_SHARE_KEY = new Uint8Array(0);

const SHARE_ROUTE_PATTERN = /^\/s\/([A-Za-z0-9_-]{22})(?:\/|$)/;
const SHARE_KEY_FRAGMENT_PATTERN = /^#k=([A-Za-z0-9_-]{43})$/;
const SHARE_KEY_SESSION_PREFIX = 'yidhan-share-key:';

export interface ShareRouteState {
  token: string;
  shareKey: Uint8Array;
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function decodeShareKey(shareKeyBase64Url: string): Uint8Array {
  try {
    const shareKey = fromBase64Url(shareKeyBase64Url);
    return shareKey.length === 32 ? shareKey : EMPTY_SHARE_KEY;
  } catch (error) {
    console.warn('Failed to decode share key:', error);
    return EMPTY_SHARE_KEY;
  }
}

function getShareTokenFromPath(pathname: string): string | null {
  return pathname.match(SHARE_ROUTE_PATTERN)?.[1] ?? null;
}

export function getShareKeyStorageKey(token: string): string {
  return `${SHARE_KEY_SESSION_PREFIX}${token}`;
}

function persistShareKeyToSession(token: string, shareKeyBase64Url: string): boolean {
  const storage = getSessionStorage();
  if (!storage) return false;

  try {
    storage.setItem(getShareKeyStorageKey(token), shareKeyBase64Url);
    return true;
  } catch (error) {
    console.warn('Failed to persist share key to session storage:', error);
    return false;
  }
}

export function clearPersistedShareKey(token: string): void {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.removeItem(getShareKeyStorageKey(token));
  } catch (error) {
    console.warn('Failed to clear persisted share key:', error);
  }
}

function getPersistedShareKey(token: string): Uint8Array {
  const storage = getSessionStorage();
  if (!storage) return EMPTY_SHARE_KEY;

  const persistedKey = storage.getItem(getShareKeyStorageKey(token));
  if (!persistedKey) return EMPTY_SHARE_KEY;

  const shareKey = decodeShareKey(persistedKey);
  if (shareKey.length === 0) {
    clearPersistedShareKey(token);
  }

  return shareKey;
}

export function preserveShareKeyFromLocation(pathname: string, hash: string): boolean {
  const token = getShareTokenFromPath(pathname);
  const encodedKey = hash.match(SHARE_KEY_FRAGMENT_PATTERN)?.[1];

  if (!token || !encodedKey) return false;

  return persistShareKeyToSession(token, encodedKey);
}

export function reloadWithPreservedShareContext(
  locationLike: Pick<Location, 'pathname' | 'hash'> = window.location,
  reload: () => void = () => window.location.reload()
): void {
  preserveShareKeyFromLocation(locationLike.pathname, locationLike.hash);
  reload();
}

export function parseShareRoute(pathname: string, hash: string): ShareRouteState | null {
  const token = getShareTokenFromPath(pathname);
  if (!token) return null;

  const encodedKey = hash.match(SHARE_KEY_FRAGMENT_PATTERN)?.[1];
  if (encodedKey) {
    return { token, shareKey: decodeShareKey(encodedKey) };
  }

  return {
    token,
    shareKey: getPersistedShareKey(token),
  };
}
