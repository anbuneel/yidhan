import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { Globals, useSpring, animated } from '@react-spring/web';
import {
  REDUCED_MOTION_QUERY,
  syncSpringReducedMotion,
  useSpringReducedMotion,
} from './springMotion';
import { resetGestureRuntimeForTests } from './gestureRuntime';
import { BottomSheet } from '../components/BottomSheet';
import { PullToRefresh } from '../components/PullToRefresh';
import { SwipeableNoteCard } from '../components/SwipeableNoteCard';
import { createMockNote } from '../test/factories';

type DragCallback = (state: Record<string, unknown>) => unknown;

const { capturedDragHandlers } = vi.hoisted(() => ({
  capturedDragHandlers: [] as DragCallback[],
}));

vi.mock('@use-gesture/react', () => ({
  useDrag: (handler: DragCallback) => {
    capturedDragHandlers.push(handler);
    return () => ({});
  },
}));

vi.mock('../hooks/useMobileDetect', () => ({
  useMobileDetect: () => true,
}));

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
    capturedDragHandlers.length = 0;
    resetGestureRuntimeForTests();
    Globals.assign({ skipAnimation: false });
  });

  afterEach(() => {
    resetGestureRuntimeForTests();
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

  it('shares a single matchMedia listener across many mounted callers and detaches on last unmount', () => {
    const { matchMedia, mql } = createMockMatchMedia(true);
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;

    function Consumer() {
      const reduced = useSpringReducedMotion();
      return <span>{String(reduced)}</span>;
    }

    const { unmount } = render(
      <>
        <Consumer />
        <Consumer />
        <Consumer />
      </>
    );

    expect(mql.addEventListener).toHaveBeenCalledTimes(1);
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('handles older WebKit matchMedia with addListener/removeListener only', () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: REDUCED_MOTION_QUERY,
      addListener,
      removeListener,
    }) as unknown as typeof window.matchMedia;

    const cleanup = syncSpringReducedMotion();
    expect(Globals.skipAnimation).toBe(true);
    expect(addListener).toHaveBeenCalledTimes(1);
    cleanup();
    expect(removeListener).toHaveBeenCalledTimes(1);
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
    expect(springY).toBe(0);

    act(() => {
      setMatches(false);
    });
    expect(Globals.skipAnimation).toBe(false);
    expect(latestReduced).toBe(false);
  });

  it('BottomSheet on mobile works before gestures load and dismisses immediately on drag under reduced motion once loaded', async () => {
    const { matchMedia } = createMockMatchMedia(true);
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;
    const onClose = vi.fn();

    render(
      <BottomSheet isOpen onClose={onClose} title="Settings">
        <button type="button">Item</button>
      </BottomSheet>
    );

    // Dialog is accessible immediately even before the gesture chunk resolves.
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();

    await waitFor(() => expect(capturedDragHandlers.length).toBeGreaterThan(0));
    expect(Globals.skipAnimation).toBe(true);
    const dragHandler = capturedDragHandlers[capturedDragHandlers.length - 1];
    const cancel = vi.fn();
    act(() => {
      dragHandler({ movement: [0, 150], velocity: [0, 0.2], down: false, cancel });
    });

    // Under reduced motion, onClose fires synchronously without a 200ms timer.
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('PullToRefresh stays inert and preserves child DOM before gestures load, then refreshes under reduced motion', async () => {
    const { matchMedia } = createMockMatchMedia(true);
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <PullToRefresh onRefresh={onRefresh}>
        <div data-testid="ptr-child">Library</div>
      </PullToRefresh>
    );

    // Before the deferred gesture chunk resolves, drag is inert and children render normally.
    const childBefore = screen.getByTestId('ptr-child');
    expect(capturedDragHandlers).toHaveLength(0);

    await waitFor(() => expect(capturedDragHandlers.length).toBeGreaterThan(0));
    // Activating gestures must not remount library content.
    expect(screen.getByTestId('ptr-child')).toBe(childBefore);
    expect(Globals.skipAnimation).toBe(true);
    const dragHandler = capturedDragHandlers[capturedDragHandlers.length - 1];

    // Pull down past threshold (250 * 0.4 = 100 >= 80) and release.
    await act(async () => {
      dragHandler({ movement: [0, 250], down: true, first: true });
      dragHandler({ movement: [0, 250], down: false, first: false });
    });
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));

    // Refresh state must reset cleanly under reduced motion so a second pull refreshes again.
    await act(async () => {
      dragHandler({ movement: [0, 250], down: true, first: true });
      dragHandler({ movement: [0, 250], down: false, first: false });
    });
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(2));
  });

  it('SwipeableNoteCard works normally before gestures load without remounting NoteCard, then toggles pin on swipe', async () => {
    const { matchMedia } = createMockMatchMedia(true);
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;
    const note = createMockNote({ id: 'n-1', title: 'Draft', pinned: false });
    const onClick = vi.fn();
    const onTogglePin = vi.fn();

    render(
      <SwipeableNoteCard
        note={note}
        onClick={onClick}
        onDelete={vi.fn()}
        onTogglePin={onTogglePin}
      />
    );

    // Before the gesture chunk resolves: swipe is inert, card renders and opens on click.
    const cardBefore = screen.getByRole('button', { name: 'Open note: Draft' }).closest('.note-card');
    expect(cardBefore).toBeInTheDocument();
    expect(capturedDragHandlers).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Open note: Draft' }));
    expect(onClick).toHaveBeenCalledWith('n-1');

    await waitFor(() => expect(capturedDragHandlers.length).toBeGreaterThan(0));
    // Activating gestures must not remount NoteCard.
    expect(screen.getByRole('button', { name: 'Open note: Draft' }).closest('.note-card')).toBe(cardBefore);
    expect(Globals.skipAnimation).toBe(true);
    const dragHandler = capturedDragHandlers[capturedDragHandlers.length - 1];

    act(() => {
      dragHandler({
        movement: [160, 0],
        velocity: [0.5, 0],
        direction: [1, 0],
        down: false,
        cancel: vi.fn(),
      });
    });

    // Pin toggles immediately without waiting for wobbly spring onRest.
    expect(onTogglePin).toHaveBeenCalledWith('n-1', true);
  });
});
