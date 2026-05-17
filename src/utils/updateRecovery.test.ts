import { describe, expect, it, vi } from 'vitest';
import { isChunkLoadError, reloadForUpdatedApp } from './updateRecovery';

describe('updateRecovery', () => {
  it('detects dynamic import chunk failures', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: /assets/App.js'))).toBe(true);
    expect(isChunkLoadError('Importing a module script failed.')).toBe(true);
    expect(isChunkLoadError(new Error('Network request failed'))).toBe(false);
  });

  it('reloads once and preserves share-link keys', () => {
    const reload = vi.fn();

    const didReload = reloadForUpdatedApp({
      locationLike: {
        pathname: '/s/abcdefghijklmnopqrstuv',
        hash: '#k=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12',
      },
      now: 1000,
      reload,
      storage: sessionStorage,
    });

    expect(didReload).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('yidhan-update-reload-attempted')).toBe('1000');
    expect(sessionStorage.getItem('yidhan-share-key:abcdefghijklmnopqrstuv')).toBe(
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12'
    );
  });

  it('does not loop reloads inside the cooldown window', () => {
    const reload = vi.fn();
    sessionStorage.setItem('yidhan-update-reload-attempted', '1000');

    const didReload = reloadForUpdatedApp({
      now: 2000,
      reload,
      storage: sessionStorage,
    });

    expect(didReload).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('still reloads when session storage is unavailable', () => {
    const reload = vi.fn();

    const didReload = reloadForUpdatedApp({
      now: 1000,
      reload,
      storage: null,
    });

    expect(didReload).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('still reloads when storage writes fail', () => {
    const reload = vi.fn();
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error('quota exceeded');
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } satisfies Storage;

    const didReload = reloadForUpdatedApp({
      now: 1000,
      reload,
      storage,
    });

    expect(didReload).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

});
