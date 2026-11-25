import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { Globals, useSpring, animated } from '@react-spring/web';
import {
  REDUCED_MOTION_QUERY,
  syncSpringReducedMotion,
  useSpringReducedMotion,
} from './springMotion';

function createMockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const mql = {
    get matches() {
      return matches;
    },
    media: REDUCED_MOTION_QUERY,
    onchange: null,
    addEventListener: vi.fn((_type: string, cb: (event: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    }),
    removeEventListener: vi.fn((_type: string, cb: (event: MediaQueryListEvent) => void) => {
      listeners.delete(cb);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  const matchMedia = vi.fn((query: string) => {
    if (query === REDUCED_MOTION_QUERY) return mql;
    return {
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });

  const setMatches = (next: boolean) => {
    matches = next;
    const event = { matches: next, media: REDUCED_MOTION_QUERY } as MediaQueryListEvent;
    listeners.forEach((cb) => cb(event));
  };

  return { matchMedia, mql, setMatches };
}

describe('springMotion reduced motion (B3)', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    Globals.assign({ skipAnimation: false });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Globals.assign({ skipAnimation: false });
  });

  it('sets Globals.skipAnimation to true when prefers-reduced-motion: reduce matches', () => {
    const { matchMedia } = createMockMatchMedia(true);
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;

    const cleanup = syncSpringReducedMotion();
    expect(Globals.skipAnimation).toBe(true);
    cleanup();
  });

  it('keeps Globals.skipAnimation false when reduced motion is off', () => {
    const { matchMedia } = createMockMatchMedia(false);
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;

    const cleanup = syncSpringReducedMotion();
    expect(Globals.skipAnimation).toBe(false);
    cleanup();
  });

  it('reacts to dynamic prefers-reduced-motion changes', () => {
    const { matchMedia, setMatches } = createMockMatchMedia(false);
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;

    const onChange = vi.fn();
    const cleanup = syncSpringReducedMotion(onChange);
    expect(Globals.skipAnimation).toBe(false);

    setMatches(true);
    expect(Globals.skipAnimation).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(true);

    setMatches(false);
    expect(Globals.skipAnimation).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(false);

    cleanup();
  });

  it('skips react-spring animation frames when reduced motion is enabled', () => {
    const { matchMedia, setMatches } = createMockMatchMedia(true);
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;

    let springY = 100;
    let triggerMove: ((target: number) => void) | null = null;
    let latestReduced = false;

    function SpringProbe() {
      latestReduced = useSpringReducedMotion();
      const [{ y }, api] = useSpring(() => ({ y: 100 }));
      triggerMove = (target: number) => {
        api.start({ y: target, immediate: latestReduced });
      };
      springY = y.get();
      return <animated.div style={{ y }}>probe</animated.div>;
    }

    const { rerender } = render(<SpringProbe />);
    expect(Globals.skipAnimation).toBe(true);
    expect(latestReduced).toBe(true);

    act(() => {
      triggerMove?.(0);
    });
    rerender(<SpringProbe />);
    // With reduced motion enabled, the spring jumps straight to the target value without animating.
    expect(springY).toBe(0);

    // Toggling preference off live re-enables spring animations.
    act(() => {
      setMatches(false);
    });
    expect(Globals.skipAnimation).toBe(false);
    expect(latestReduced).toBe(false);
  });
});
