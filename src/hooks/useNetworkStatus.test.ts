import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import toast from 'react-hot-toast';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: vi.fn(),
}));

// Import after mocking to get fresh module state
// Note: We need to reset the module between tests due to singleton pattern
describe('useNetworkStatus', () => {
  let originalNavigator: Navigator;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset the module to clear singleton state
    vi.resetModules();

    // Store original navigator
    originalNavigator = window.navigator;

    // Spy on window event listeners
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    // Default to online
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore navigator
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('adds event listeners on first use (singleton pattern)', async () => {
    const { useNetworkStatus } = await import('./useNetworkStatus');
    renderHook(() => useNetworkStatus());

    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('does not add duplicate listeners on multiple hook instances', async () => {
    const { useNetworkStatus } = await import('./useNetworkStatus');

    // First hook instance
    renderHook(() => useNetworkStatus());
    const callCountAfterFirst = addEventListenerSpy.mock.calls.filter(
      ([event]) => event === 'online' || event === 'offline'
    ).length;

    // Second hook instance - should not add more listeners
    renderHook(() => useNetworkStatus());
    const callCountAfterSecond = addEventListenerSpy.mock.calls.filter(
      ([event]) => event === 'online' || event === 'offline'
    ).length;

    expect(callCountAfterFirst).toBe(2); // online + offline
    expect(callCountAfterSecond).toBe(2); // Still just 2, not 4
  });

  it('does not show toast when initially online', async () => {
    const { useNetworkStatus } = await import('./useNetworkStatus');
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });

    renderHook(() => useNetworkStatus());

    expect(toast).not.toHaveBeenCalled();
  });

  it('sets isOnline to false when initially offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });

    const { useNetworkStatus } = await import('./useNetworkStatus');
    const { result } = renderHook(() => useNetworkStatus());

    // Should be offline but no toast on initial render (only on transition)
    expect(result.current.isOnline).toBe(false);
  });

  it('shows offline toast when going offline', async () => {
    const { useNetworkStatus } = await import('./useNetworkStatus');
    renderHook(() => useNetworkStatus());

    // Clear any initial calls
    vi.mocked(toast).mockClear();

    // Simulate going offline
    window.dispatchEvent(new Event('offline'));

    expect(toast).toHaveBeenCalledWith(
      'Offline. Your notes are safe locally.',
      expect.objectContaining({
        icon: '雲',
        duration: 4000,
      })
    );
  });

  it('shows online toast when coming back online after being offline', async () => {
    const { useNetworkStatus } = await import('./useNetworkStatus');
    renderHook(() => useNetworkStatus());

    // Clear any initial calls
    vi.mocked(toast).mockClear();

    // Go offline first
    window.dispatchEvent(new Event('offline'));

    // Clear the offline toast call
    vi.mocked(toast).mockClear();

    // Come back online
    window.dispatchEvent(new Event('online'));

    expect(toast).toHaveBeenCalledWith(
      'The path has cleared.',
      expect.objectContaining({
        icon: '〇',
        duration: 3000,
      })
    );
  });

  it('does not show online toast if never went offline', async () => {
    const { useNetworkStatus } = await import('./useNetworkStatus');
    renderHook(() => useNetworkStatus());

    // Clear any initial calls
    vi.mocked(toast).mockClear();

    // Trigger online event without going offline first
    window.dispatchEvent(new Event('online'));

    expect(toast).not.toHaveBeenCalled();
  });

  it('tracks offline state correctly across multiple transitions', async () => {
    const { useNetworkStatus } = await import('./useNetworkStatus');
    renderHook(() => useNetworkStatus());
    vi.mocked(toast).mockClear();

    // Go offline
    window.dispatchEvent(new Event('offline'));
    expect(toast).toHaveBeenCalledWith(
      'Offline. Your notes are safe locally.',
      expect.anything()
    );

    vi.mocked(toast).mockClear();

    // Come back online
    window.dispatchEvent(new Event('online'));
    expect(toast).toHaveBeenCalledWith(
      'The path has cleared.',
      expect.anything()
    );

    vi.mocked(toast).mockClear();

    // Online again (should not show toast - wasn't offline)
    window.dispatchEvent(new Event('online'));
    expect(toast).not.toHaveBeenCalled();

    // Go offline again
    window.dispatchEvent(new Event('offline'));
    expect(toast).toHaveBeenCalledWith(
      'Offline. Your notes are safe locally.',
      expect.anything()
    );
  });

  it('applies correct styling to toasts', async () => {
    const { useNetworkStatus } = await import('./useNetworkStatus');
    renderHook(() => useNetworkStatus());
    vi.mocked(toast).mockClear();

    // Go offline to trigger toast with styling
    window.dispatchEvent(new Event('offline'));

    expect(toast).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        style: expect.objectContaining({
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--glass-border)',
        }),
      })
    );
  });

  it('returns isOnline status', async () => {
    const { useNetworkStatus } = await import('./useNetworkStatus');
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(true);

    // Update navigator.onLine before dispatching (simulates real browser behavior)
    act(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);

    act(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOnline).toBe(true);
  });

  it('provides onReconnect callback', async () => {
    const { useNetworkStatus } = await import('./useNetworkStatus');
    const { result } = renderHook(() => useNetworkStatus());
    const reconnectHandler = vi.fn();

    result.current.onReconnect(reconnectHandler);

    // Go offline then online
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(reconnectHandler).toHaveBeenCalledTimes(1);
  });
});
