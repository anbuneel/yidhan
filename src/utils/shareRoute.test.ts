import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toBase64Url } from '../lib/encryption';
import {
  getShareKeyStorageKey,
  parseShareRoute,
  preserveShareKeyFromLocation,
  reloadWithPreservedShareContext,
} from './shareRoute';

const TEST_TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const TEST_PATH = `/s/${TEST_TOKEN}`;
const TEST_KEY = toBase64Url(new Uint8Array(Array.from({ length: 32 }, (_, index) => index + 1)));

describe('shareRoute', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('parses a share key from the URL fragment', () => {
    const route = parseShareRoute(TEST_PATH, `#k=${TEST_KEY}`);

    expect(route).not.toBeNull();
    expect(route?.token).toBe(TEST_TOKEN);
    expect(route?.shareKey).toHaveLength(32);
  });

  it('falls back to the persisted share key when the fragment is missing', () => {
    expect(preserveShareKeyFromLocation(TEST_PATH, `#k=${TEST_KEY}`)).toBe(true);

    const route = parseShareRoute(TEST_PATH, '');

    expect(route).not.toBeNull();
    expect(route?.shareKey).toHaveLength(32);
  });

  it('returns null for non-share paths', () => {
    expect(parseShareRoute('/', '')).toBeNull();
    expect(parseShareRoute('/demo', '')).toBeNull();
  });

  it('persists the current share key before reloading', () => {
    const reload = vi.fn();

    reloadWithPreservedShareContext(
      { pathname: TEST_PATH, hash: `#k=${TEST_KEY}` },
      reload
    );

    expect(sessionStorage.getItem(getShareKeyStorageKey(TEST_TOKEN))).toBe(TEST_KEY);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('keeps the URL fragment as the fallback when session storage persistence fails', () => {
    const setItemSpy = vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });

    expect(preserveShareKeyFromLocation(TEST_PATH, `#k=${TEST_KEY}`)).toBe(false);
    expect(sessionStorage.getItem(getShareKeyStorageKey(TEST_TOKEN))).toBeNull();

    setItemSpy.mockRestore();
  });
});
