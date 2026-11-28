import { cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EDITOR_FALLBACK_DELAY_MS, EDITOR_IDLE_TIMEOUT_MS, useEditorWarmup } from './useEditorWarmup';

type IdleCallback = (deadline: IdleDeadline) => void;

describe('useEditorWarmup', () => {
  let idle: { callback: IdleCallback; options?: IdleRequestOptions } | null;
  const cancelIdle = vi.fn();

  beforeEach(() => {
    idle = null;
    cancelIdle.mockReset();
    vi.stubGlobal('requestIdleCallback', (callback: IdleCallback, options?: IdleRequestOptions) => {
      idle = { callback, options };
      return 7;
    });
    vi.stubGlobal('cancelIdleCallback', cancelIdle);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  const runIdle = () => idle?.callback({ didTimeout: false, timeRemaining: () => 10 });

  it('does not fetch at mount: it waits for idle, with a timeout', () => {
    const preload = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useEditorWarmup(true, preload));
    expect(preload).not.toHaveBeenCalled();
    expect(idle?.options).toEqual({ timeout: EDITOR_IDLE_TIMEOUT_MS });
    runIdle();
    expect(preload).toHaveBeenCalledTimes(1);
  });

  it('fetches at once on a pointer over a note card, and only once', () => {
    const preload = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <div data-library-card-id="note-1">
        <span>Card title</span>
      </div>
    );
    renderHook(() => useEditorWarmup(true, preload));
    fireEvent.pointerOver(getByText('Card title'));
    expect(preload).toHaveBeenCalledTimes(1);
    expect(cancelIdle).toHaveBeenCalledWith(7);
    fireEvent.pointerOver(getByText('Card title'));
    runIdle();
    expect(preload).toHaveBeenCalledTimes(1);
  });

  it('fetches at once when a note card takes focus', () => {
    const preload = vi.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <div data-library-card-id="note-1">
        <button type="button">Open note</button>
      </div>
    );
    renderHook(() => useEditorWarmup(true, preload));
    fireEvent.focusIn(getByRole('button', { name: 'Open note' }));
    expect(preload).toHaveBeenCalledTimes(1);
  });

  it('ignores pointer and focus outside the cards', () => {
    const preload = vi.fn().mockResolvedValue(undefined);
    const { getByRole } = render(<button type="button">Settings</button>);
    renderHook(() => useEditorWarmup(true, preload));
    fireEvent.pointerOver(getByRole('button', { name: 'Settings' }));
    fireEvent.focusIn(getByRole('button', { name: 'Settings' }));
    expect(preload).not.toHaveBeenCalled();
  });

  it('does nothing while disabled: locked, or away from the library', () => {
    const preload = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(<div data-library-card-id="note-1">Card</div>);
    renderHook(() => useEditorWarmup(false, preload));
    fireEvent.pointerOver(getByText('Card'));
    expect(idle).toBeNull();
    expect(preload).not.toHaveBeenCalled();
  });

  it('stops listening and cancels the idle callback on unmount', () => {
    const preload = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(<div data-library-card-id="note-1">Card</div>);
    const hook = renderHook(() => useEditorWarmup(true, preload));
    hook.unmount();
    expect(cancelIdle).toHaveBeenCalledWith(7);
    fireEvent.pointerOver(getByText('Card'));
    expect(preload).not.toHaveBeenCalled();
  });

  it('arms again after a remount, for a library shown again', () => {
    const preload = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useEditorWarmup(true, preload)).unmount();
    renderHook(() => useEditorWarmup(true, preload));
    runIdle();
    expect(preload).toHaveBeenCalledTimes(1);
  });

  it('falls back to a short timer where there is no requestIdleCallback', () => {
    vi.unstubAllGlobals();
    const original = window.requestIdleCallback;
    // @ts-expect-error: removing it to stand in for Safari.
    delete window.requestIdleCallback;
    vi.useFakeTimers();
    try {
      const preload = vi.fn().mockResolvedValue(undefined);
      renderHook(() => useEditorWarmup(true, preload));
      vi.advanceTimersByTime(EDITOR_FALLBACK_DELAY_MS - 1);
      expect(preload).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(preload).toHaveBeenCalledTimes(1);
    } finally {
      if (original) window.requestIdleCallback = original;
    }
  });
});
