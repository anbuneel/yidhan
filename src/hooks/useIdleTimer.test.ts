/**
 * useIdleTimer.test.ts — Phase 2b
 *
 * Tests the simple idle timer hook that fires onIdle after N minutes.
 * Uses vi.useFakeTimers for deterministic timer control.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleTimer } from './useIdleTimer';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useIdleTimer', () => {
  it('should fire onIdle after the specified minutes', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ minutes: 5, onIdle, enabled: true }));

    // Advance 4 minutes — should not fire yet
    act(() => { vi.advanceTimersByTime(4 * 60 * 1000); });
    expect(onIdle).not.toHaveBeenCalled();

    // Advance to 5 minutes — should fire
    act(() => { vi.advanceTimersByTime(1 * 60 * 1000); });
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('should not fire when disabled', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ minutes: 1, onIdle, enabled: false }));

    act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('should not fire when minutes is 0', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ minutes: 0, onIdle, enabled: true }));

    act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('should reset on mousedown activity', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ minutes: 5, onIdle, enabled: true }));

    // Advance 4 minutes
    act(() => { vi.advanceTimersByTime(4 * 60 * 1000); });

    // Simulate user activity
    act(() => { window.dispatchEvent(new Event('mousedown')); });

    // Advance another 4 minutes — should not fire (timer was reset)
    act(() => { vi.advanceTimersByTime(4 * 60 * 1000); });
    expect(onIdle).not.toHaveBeenCalled();

    // Advance 1 more minute (5 total since reset) — should fire
    act(() => { vi.advanceTimersByTime(1 * 60 * 1000); });
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('should reset on keydown activity', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ minutes: 1, onIdle, enabled: true }));

    act(() => { vi.advanceTimersByTime(50 * 1000); });
    act(() => { window.dispatchEvent(new Event('keydown')); });
    act(() => { vi.advanceTimersByTime(50 * 1000); });
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('should reset on touchstart activity', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ minutes: 1, onIdle, enabled: true }));

    act(() => { vi.advanceTimersByTime(50 * 1000); });
    act(() => { window.dispatchEvent(new Event('touchstart')); });
    act(() => { vi.advanceTimersByTime(50 * 1000); });
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('should clean up timers on unmount', () => {
    const onIdle = vi.fn();
    const { unmount } = renderHook(() => useIdleTimer({ minutes: 1, onIdle, enabled: true }));

    unmount();

    act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('should clean up when disabled after being enabled', () => {
    const onIdle = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useIdleTimer({ minutes: 1, onIdle, enabled }),
      { initialProps: { enabled: true } }
    );

    act(() => { vi.advanceTimersByTime(30 * 1000); });
    rerender({ enabled: false });

    act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('should use the latest onIdle callback', () => {
    const onIdle1 = vi.fn();
    const onIdle2 = vi.fn();
    const { rerender } = renderHook(
      ({ onIdle }) => useIdleTimer({ minutes: 1, onIdle, enabled: true }),
      { initialProps: { onIdle: onIdle1 } }
    );

    rerender({ onIdle: onIdle2 });

    act(() => { vi.advanceTimersByTime(1 * 60 * 1000); });
    expect(onIdle1).not.toHaveBeenCalled();
    expect(onIdle2).toHaveBeenCalledTimes(1);
  });
});
