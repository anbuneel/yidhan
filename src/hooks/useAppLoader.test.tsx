import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APP_LOADER_DELAY_MS,
  appBootScreen,
  resetAppBootForTests,
  useAppBoot,
  type AppBootPhase,
} from './useAppLoader';
import { BootLoadingFallback } from '../components/LoadingFallback';

beforeEach(() => {
  vi.useFakeTimers();
  resetAppBootForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderBoot(initialLoading: boolean) {
  const phases: AppBootPhase[] = [];
  const hook = renderHook(
    ({ loading }: { loading: boolean }) => {
      const phase = useAppBoot(loading);
      phases.push(phase);
      return phase;
    },
    { initialProps: { loading: initialLoading } },
  );
  return { ...hook, phases };
}

describe('useAppBoot', () => {
  it('never shows the loader when boot finishes inside the delay', () => {
    const { result, rerender, phases } = renderBoot(true);
    expect(result.current).toBe('waiting');

    act(() => vi.advanceTimersByTime(APP_LOADER_DELAY_MS - 20));
    rerender({ loading: false });
    expect(result.current).toBe('done');

    // The timer must not fire later and bring the loader back.
    act(() => vi.advanceTimersByTime(APP_LOADER_DELAY_MS * 4));
    expect(result.current).toBe('done');
    expect(phases).not.toContain('loader');
  });

  it('shows nothing to wait for when the app is ready on the first render', () => {
    const { result, phases } = renderBoot(false);
    act(() => vi.advanceTimersByTime(APP_LOADER_DELAY_MS * 2));
    expect(result.current).toBe('done');
    expect(phases).toEqual(['done']);
  });

  it('shows the loader after the delay and drops it the moment boot finishes', () => {
    const { result, rerender } = renderBoot(true);

    act(() => vi.advanceTimersByTime(APP_LOADER_DELAY_MS - 1));
    expect(result.current).toBe('waiting');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('loader');

    // No minimum hold: the render that sees boot finish is already done.
    rerender({ loading: false });
    expect(result.current).toBe('done');
  });

  it('clears the delay timer on unmount', () => {
    const { unmount } = renderBoot(true);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not show the loader for a later load: a user change or a lock after boot', () => {
    const { result, rerender, phases } = renderBoot(true);
    rerender({ loading: false });
    const bootEndedAt = phases.length;

    // Sign-out then sign-in, or a lock then an unlock, starts another notes load.
    rerender({ loading: true });
    expect(result.current).toBe('done');
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(APP_LOADER_DELAY_MS * 4));
    expect(result.current).toBe('done');
    expect(phases.slice(bootEndedAt).every((phase) => phase === 'done')).toBe(true);
  });

  it('does not restart a boot that already finished when App remounts', () => {
    const first = renderBoot(true);
    first.rerender({ loading: false });
    first.unmount();

    const second = renderBoot(true);
    expect(second.result.current).toBe('done');
    act(() => vi.advanceTimersByTime(APP_LOADER_DELAY_MS * 4));
    expect(second.phases).toEqual(['done']);
  });

  it('counts the delay once per page load, across the chunk fallback and App', () => {
    // Root's fallback waits while the app shell chunk loads...
    const fallback = render(<BootLoadingFallback message="Preparing your space..." />);
    act(() => vi.advanceTimersByTime(100));
    fallback.unmount();

    // ...then App mounts still booting. It owes only the rest of the delay.
    const { result } = renderBoot(true);
    expect(result.current).toBe('waiting');
    act(() => vi.advanceTimersByTime(APP_LOADER_DELAY_MS - 100));
    expect(result.current).toBe('loader');
  });
});

describe('BootLoadingFallback', () => {
  it('is blank inside the delay and shows the loader after it', () => {
    render(<BootLoadingFallback message="Preparing your space..." />);
    expect(screen.getByTestId('boot-blank')).toBeInTheDocument();
    expect(screen.queryByText('Preparing your space...')).toBeNull();

    act(() => vi.advanceTimersByTime(APP_LOADER_DELAY_MS));
    expect(screen.queryByTestId('boot-blank')).toBeNull();
    expect(screen.getByText('Preparing your space...')).toBeInTheDocument();
  });
});

describe('appBootScreen', () => {
  const signedInReload = { authLoading: true, fromPublicShell: false };

  it('is blank, never an entry screen, while auth resolves inside the delay', () => {
    expect(appBootScreen('waiting', signedInReload)).toBe('blank');
  });

  it('shows the loader past the delay', () => {
    expect(appBootScreen('loader', signedInReload)).toBe('loader');
  });

  it('still blocks the landing page while auth resolves after a remount', () => {
    // Boot already finished in this page load, so the phase is done, but `user` is
    // null until auth resolves and the entry screens would read that as signed out.
    expect(appBootScreen('done', signedInReload)).toBe('blank');
  });

  it('lets the public shell handoff keep its landing page', () => {
    expect(appBootScreen('done', { authLoading: true, fromPublicShell: true })).toBeNull();
  });

  it('gets out of the way once boot is done and auth has resolved', () => {
    expect(appBootScreen('done', { authLoading: false, fromPublicShell: false })).toBeNull();
  });
});
