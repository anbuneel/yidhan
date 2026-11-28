import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMobileDetect } from './useMobileDetect';

function createControllableMatchMedia(initial: Record<string, boolean>) {
  const state = { ...initial };
  const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>();

  const getListeners = (query: string) => {
    let set = listeners.get(query);
    if (!set) {
      set = new Set();
      listeners.set(query, set);
    }
    return set;
  };

  const mqls = new Map<string, MediaQueryList>();
  const matchMedia = vi.fn((query: string) => {
    let mql = mqls.get(query);
    if (!mql) {
      const set = getListeners(query);
      mql = {
        get matches() {
          return Boolean(state[query]);
        },
        media: query,
        onchange: null,
        addEventListener: vi.fn((_type: string, cb: (event: MediaQueryListEvent) => void) => {
          set.add(cb);
        }),
        removeEventListener: vi.fn((_type: string, cb: (event: MediaQueryListEvent) => void) => {
          set.delete(cb);
        }),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList;
      mqls.set(query, mql);
    }
    return mql;
  });

  const setMatches = (query: string, value: boolean) => {
    state[query] = value;
    const event = { matches: value, media: query } as MediaQueryListEvent;
    getListeners(query).forEach((cb) => cb(event));
  };

  return { matchMedia, mqls, setMatches };
}

describe('useMobileDetect (C19)', () => {
  const originalMatchMedia = window.matchMedia;
  const originalMaxTouchPoints = navigator.maxTouchPoints;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: originalMaxTouchPoints,
    });
  });

  it('does not attach a window resize listener and reacts to matchMedia changes', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    const { matchMedia, mqls, setMatches } = createControllableMatchMedia({
      '(max-width: 767px)': false,
      '(pointer: coarse)': false,
    });
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;
    const addListenerSpy = vi.spyOn(window, 'addEventListener');

    const { result, unmount } = renderHook(() => useMobileDetect());

    expect(addListenerSpy.mock.calls.some(([type]) => type === 'resize')).toBe(false);
    expect(result.current).toBe(false);

    act(() => setMatches('(max-width: 767px)', true));
    expect(result.current).toBe(true);

    act(() => setMatches('(max-width: 767px)', false));
    expect(result.current).toBe(false);

    act(() => setMatches('(pointer: coarse)', true));
    expect(result.current).toBe(true);

    unmount();
    expect(mqls.get('(max-width: 767px)')?.removeEventListener).toHaveBeenCalledTimes(1);
    expect(mqls.get('(pointer: coarse)')?.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('stays false on a non-touch desktop even when viewport narrows', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    const hadOntouchstart = 'ontouchstart' in window;
    if (hadOntouchstart) {
      delete (window as unknown as Record<string, unknown>).ontouchstart;
    }

    const { matchMedia, setMatches } = createControllableMatchMedia({
      '(max-width: 767px)': false,
      '(pointer: coarse)': false,
    });
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;

    const { result } = renderHook(() => useMobileDetect());
    expect(result.current).toBe(false);

    act(() => setMatches('(max-width: 767px)', true));
    expect(result.current).toBe(false);
  });
});
