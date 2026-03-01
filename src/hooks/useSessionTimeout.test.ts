/**
 * useSessionTimeout.test.ts — Phase 2b
 *
 * Tests the session timeout hook with warning period, countdown,
 * activity event listeners, and cleanup.
 * Uses vi.useFakeTimers for deterministic timer control.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionTimeout } from './useSessionTimeout';

/** Flush the queueMicrotask that initializes the timeout */
async function flushMicrotasks(): Promise<void> {
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSessionTimeout', () => {
  it('should call onTimeout after timeoutMinutes', async () => {
    const onTimeout = vi.fn();
    renderHook(() =>
      useSessionTimeout({ timeoutMinutes: 10, warningMinutes: 2, onTimeout, enabled: true })
    );

    await flushMicrotasks();

    // Advance past full timeout
    act(() => { vi.advanceTimersByTime(10 * 60 * 1000); });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('should call onWarning before timeout', async () => {
    const onWarning = vi.fn();
    const onTimeout = vi.fn();
    renderHook(() =>
      useSessionTimeout({ timeoutMinutes: 10, warningMinutes: 2, onWarning, onTimeout, enabled: true })
    );

    await flushMicrotasks();

    // Advance to warning period (10 - 2 = 8 minutes)
    act(() => { vi.advanceTimersByTime(8 * 60 * 1000); });
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should set isWarning and minutesRemaining during warning period', async () => {
    const onWarning = vi.fn();
    const { result } = renderHook(() =>
      useSessionTimeout({ timeoutMinutes: 10, warningMinutes: 2, onWarning, enabled: true })
    );

    await flushMicrotasks();

    expect(result.current.isWarning).toBe(false);
    expect(result.current.minutesRemaining).toBeNull();

    // Enter warning period (at 8 minutes)
    act(() => { vi.advanceTimersByTime(8 * 60 * 1000); });
    expect(result.current.isWarning).toBe(true);
    expect(result.current.minutesRemaining).toBe(2);

    // Advance 1 minute — countdown should decrement to 1
    act(() => { vi.advanceTimersByTime(60 * 1000); });
    expect(result.current.minutesRemaining).toBe(1);
  });

  it('should not fire when disabled', async () => {
    const onTimeout = vi.fn();
    const onWarning = vi.fn();
    renderHook(() =>
      useSessionTimeout({ timeoutMinutes: 5, onWarning, onTimeout, enabled: false })
    );

    await flushMicrotasks();

    act(() => { vi.advanceTimersByTime(30 * 60 * 1000); });
    expect(onWarning).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should not fire when timeoutMinutes is null', async () => {
    const onTimeout = vi.fn();
    renderHook(() =>
      useSessionTimeout({ timeoutMinutes: null, onTimeout, enabled: true })
    );

    await flushMicrotasks();

    act(() => { vi.advanceTimersByTime(60 * 60 * 1000); });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should reset timer on activity events when not in warning state', async () => {
    const onTimeout = vi.fn();
    const onWarning = vi.fn();
    renderHook(() =>
      useSessionTimeout({ timeoutMinutes: 10, warningMinutes: 2, onWarning, onTimeout, enabled: true })
    );

    await flushMicrotasks();

    // Advance 7 minutes (just before 8 minute warning threshold)
    act(() => { vi.advanceTimersByTime(7 * 60 * 1000); });

    // Simulate activity — should reset the timer
    act(() => { window.dispatchEvent(new Event('mousedown')); });

    // Advance 7 more minutes from reset — still before new warning threshold
    act(() => { vi.advanceTimersByTime(7 * 60 * 1000); });
    expect(onWarning).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should NOT reset on activity during warning state', async () => {
    const onWarning = vi.fn();
    const { result } = renderHook(() =>
      useSessionTimeout({ timeoutMinutes: 10, warningMinutes: 2, onWarning, enabled: true })
    );

    await flushMicrotasks();

    // Enter warning period
    act(() => { vi.advanceTimersByTime(8 * 60 * 1000); });
    expect(result.current.isWarning).toBe(true);

    // Activity during warning should NOT reset (user must click "Stay" via resetTimeout)
    act(() => { window.dispatchEvent(new Event('keydown')); });
    expect(result.current.isWarning).toBe(true);
  });

  it('should reset when resetTimeout is called manually (user clicks Stay)', async () => {
    const onWarning = vi.fn();
    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useSessionTimeout({ timeoutMinutes: 10, warningMinutes: 2, onWarning, onTimeout, enabled: true })
    );

    await flushMicrotasks();

    // Enter warning period
    act(() => { vi.advanceTimersByTime(8 * 60 * 1000); });
    expect(result.current.isWarning).toBe(true);

    // Manually reset (simulates "Stay" button click)
    act(() => { result.current.resetTimeout(); });
    expect(result.current.isWarning).toBe(false);
    expect(result.current.minutesRemaining).toBeNull();

    // Should NOT timeout at original time
    act(() => { vi.advanceTimersByTime(2 * 60 * 1000); });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should clean up timers on unmount', async () => {
    const onTimeout = vi.fn();
    const { unmount } = renderHook(() =>
      useSessionTimeout({ timeoutMinutes: 5, onTimeout, enabled: true })
    );

    await flushMicrotasks();

    unmount();

    act(() => { vi.advanceTimersByTime(30 * 60 * 1000); });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should clean up when switching from enabled to disabled', async () => {
    const onTimeout = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useSessionTimeout({ timeoutMinutes: 5, onTimeout, enabled }),
      { initialProps: { enabled: true } }
    );

    await flushMicrotasks();

    act(() => { vi.advanceTimersByTime(2 * 60 * 1000); });
    rerender({ enabled: false });

    // Flush the microtask from the disabled effect
    await flushMicrotasks();

    act(() => { vi.advanceTimersByTime(30 * 60 * 1000); });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should use the latest onTimeout callback', async () => {
    const onTimeout1 = vi.fn();
    const onTimeout2 = vi.fn();
    const { rerender } = renderHook(
      ({ onTimeout }) => useSessionTimeout({ timeoutMinutes: 1, onTimeout, enabled: true }),
      { initialProps: { onTimeout: onTimeout1 } }
    );

    await flushMicrotasks();

    rerender({ onTimeout: onTimeout2 });

    act(() => { vi.advanceTimersByTime(1 * 60 * 1000); });
    expect(onTimeout1).not.toHaveBeenCalled();
    expect(onTimeout2).toHaveBeenCalledTimes(1);
  });

  it('should use defaults when no options provided', async () => {
    const { result } = renderHook(() => useSessionTimeout());

    await flushMicrotasks();

    expect(result.current.isWarning).toBe(false);
    expect(result.current.minutesRemaining).toBeNull();
    expect(result.current.resetTimeout).toBeInstanceOf(Function);
  });

  it('should reset on touchstart activity', async () => {
    const onWarning = vi.fn();
    renderHook(() =>
      useSessionTimeout({ timeoutMinutes: 10, warningMinutes: 2, onWarning, enabled: true })
    );

    await flushMicrotasks();

    // Advance 7 minutes
    act(() => { vi.advanceTimersByTime(7 * 60 * 1000); });

    // Touch activity resets
    act(() => { window.dispatchEvent(new Event('touchstart')); });

    // 7 more minutes from reset — should not warn yet
    act(() => { vi.advanceTimersByTime(7 * 60 * 1000); });
    expect(onWarning).not.toHaveBeenCalled();
  });
});
