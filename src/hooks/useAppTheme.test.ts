import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppTheme } from './useAppTheme';

// The themes were renamed Light and Dark, but the stored values were always `light`
// and `dark`. These cases check the rename changed nothing about which theme a visitor
// gets: in the app (useAppTheme) or before first paint (public/boot.js).

const bootSource = readFileSync(resolve(__dirname, '../../public/boot.js'), 'utf8');

function setDevice(scheme: 'light' | 'dark') {
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) => ({ matches: query === `(prefers-color-scheme: ${scheme})`, media: query }) as MediaQueryList,
  );
}

function bootTheme(): string | null {
  document.documentElement.removeAttribute('data-theme');
  new Function(bootSource)();
  return document.documentElement.getAttribute('data-theme');
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('boot-hidden');
});

describe('theme choice', () => {
  it.each([
    ['light', 'dark'],
    ['dark', 'light'],
  ] as const)('a saved %s wins over a %s device, in the app and in boot.js', (saved, device) => {
    setDevice(device);
    localStorage.setItem('yidhan-theme', saved);
    expect(renderHook(() => useAppTheme()).result.current.theme).toBe(saved);
    expect(bootTheme()).toBe(saved);
  });

  it.each(['light', 'dark'] as const)('with nothing saved, follows a %s device', (device) => {
    setDevice(device);
    expect(renderHook(() => useAppTheme()).result.current.theme).toBe(device);
    expect(bootTheme()).toBe(device);
  });

  it.each(['kintsugi', 'midnight', 'washi', 'mori', 'Light'])(
    'does not treat the old or display name %s as a saved theme',
    (stored) => {
      setDevice('light');
      localStorage.setItem('yidhan-theme', stored);
      expect(renderHook(() => useAppTheme()).result.current.theme).toBe('light');
      expect(bootTheme()).toBe('light');
    },
  );

  it('saves the stored value, not a display name, when toggled', () => {
    setDevice('dark');
    const { result } = renderHook(() => useAppTheme());
    act(() => result.current.toggleTheme());
    expect(localStorage.getItem('yidhan-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('boot.js sets no theme when storage is blocked, so the shell falls to the media query', () => {
    setDevice('light');
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(bootTheme()).toBeNull();
  });
});
