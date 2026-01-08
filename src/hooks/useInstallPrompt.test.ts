import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

describe('useInstallPrompt', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();

    // Clear localStorage
    localStorage.clear();

    // Spy on window event listeners
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    // Mock matchMedia for display-mode check
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(display-mode: standalone)' ? false : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('sets up beforeinstallprompt listener', async () => {
    const { useInstallPrompt } = await import('./useInstallPrompt');
    renderHook(() => useInstallPrompt());

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'beforeinstallprompt',
      expect.any(Function)
    );
  });

  it('sets up appinstalled listener', async () => {
    const { useInstallPrompt } = await import('./useInstallPrompt');
    renderHook(() => useInstallPrompt());

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'appinstalled',
      expect.any(Function)
    );
  });

  it('returns isInstallable false when no prompt event', async () => {
    const { useInstallPrompt } = await import('./useInstallPrompt');
    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.isInstallable).toBe(false);
  });

  it('returns isInstalled false when not in standalone mode', async () => {
    const { useInstallPrompt } = await import('./useInstallPrompt');
    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.isInstalled).toBe(false);
  });

  it('returns isInstalled true when in standalone mode', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { useInstallPrompt } = await import('./useInstallPrompt');
    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.isInstalled).toBe(true);
  });

  it('tracks visits and persists to localStorage', async () => {
    const { useInstallPrompt } = await import('./useInstallPrompt');
    renderHook(() => useInstallPrompt());

    // Check localStorage was written
    const stored = localStorage.getItem('zenote-engagement');
    expect(stored).not.toBeNull();
    const data = JSON.parse(stored!);
    expect(data.visits).toBe(1);
    expect(data.lastVisit).toBe(new Date().toDateString());
  });

  it('does not double-count visits on same day', async () => {
    // Set up as if already visited today
    localStorage.setItem(
      'zenote-engagement',
      JSON.stringify({
        notesCreated: 0,
        visits: 1,
        lastVisit: new Date().toDateString(),
      })
    );

    const { useInstallPrompt } = await import('./useInstallPrompt');
    renderHook(() => useInstallPrompt());

    const stored = JSON.parse(localStorage.getItem('zenote-engagement')!);
    expect(stored.visits).toBe(1); // Should still be 1, not 2
  });

  it('trackNoteCreated increments note count', async () => {
    const { useInstallPrompt } = await import('./useInstallPrompt');
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      result.current.trackNoteCreated();
    });

    const stored = JSON.parse(localStorage.getItem('zenote-engagement')!);
    expect(stored.notesCreated).toBe(1);
  });

  it('trackNoteCreated stops incrementing after threshold', async () => {
    localStorage.setItem(
      'zenote-engagement',
      JSON.stringify({
        notesCreated: 3,
        visits: 1,
        lastVisit: new Date().toDateString(),
      })
    );

    const { useInstallPrompt } = await import('./useInstallPrompt');
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      result.current.trackNoteCreated();
    });

    const stored = JSON.parse(localStorage.getItem('zenote-engagement')!);
    expect(stored.notesCreated).toBe(3); // Should not increment past threshold
  });

  it('shouldShowPrompt is false when not engaged', async () => {
    const { useInstallPrompt } = await import('./useInstallPrompt');
    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.shouldShowPrompt).toBe(false);
  });

  it('dismissPrompt sets dismissed flag in localStorage', async () => {
    const { useInstallPrompt } = await import('./useInstallPrompt');
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      result.current.dismissPrompt();
    });

    expect(localStorage.getItem('zenote-install-dismissed')).toBe('true');
  });

  it('respects previously dismissed state', async () => {
    localStorage.setItem('zenote-install-dismissed', 'true');

    const { useInstallPrompt } = await import('./useInstallPrompt');
    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.shouldShowPrompt).toBe(false);
  });

  it('triggerInstall returns false when no prompt available', async () => {
    const { useInstallPrompt } = await import('./useInstallPrompt');
    const { result } = renderHook(() => useInstallPrompt());

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.triggerInstall();
    });

    expect(returnValue).toBe(false);
  });

  it('does not add duplicate event listeners (singleton pattern)', async () => {
    const { useInstallPrompt } = await import('./useInstallPrompt');

    // First hook instance
    renderHook(() => useInstallPrompt());
    const callCountAfterFirst = addEventListenerSpy.mock.calls.filter(
      ([event]) => event === 'beforeinstallprompt' || event === 'appinstalled'
    ).length;

    // Second hook instance
    renderHook(() => useInstallPrompt());
    const callCountAfterSecond = addEventListenerSpy.mock.calls.filter(
      ([event]) => event === 'beforeinstallprompt' || event === 'appinstalled'
    ).length;

    expect(callCountAfterFirst).toBe(2); // beforeinstallprompt + appinstalled
    expect(callCountAfterSecond).toBe(2); // Still just 2, not 4
  });
});
