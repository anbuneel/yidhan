import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNetworkStatus } from './useNetworkStatus';
import toast from 'react-hot-toast';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: vi.fn(),
}));

describe('useNetworkStatus', () => {
  let originalNavigator: Navigator;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Store original navigator
    originalNavigator = window.navigator;

    // Spy on window event listeners
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

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

  it('adds event listeners on mount', () => {
    renderHook(() => useNetworkStatus());

    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('removes event listeners on unmount', () => {
    const { unmount } = renderHook(() => useNetworkStatus());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('does not show toast when initially online', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });

    renderHook(() => useNetworkStatus());

    expect(toast).not.toHaveBeenCalled();
  });

  it('shows offline toast when initially offline', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });

    renderHook(() => useNetworkStatus());

    expect(toast).toHaveBeenCalledWith(
      'Connection lost. Changes may not be saved.',
      expect.objectContaining({
        icon: '雲',
        duration: 4000,
      })
    );
  });

  it('shows offline toast when going offline', () => {
    renderHook(() => useNetworkStatus());

    // Clear any initial calls
    vi.mocked(toast).mockClear();

    // Simulate going offline
    window.dispatchEvent(new Event('offline'));

    expect(toast).toHaveBeenCalledWith(
      'Connection lost. Changes may not be saved.',
      expect.objectContaining({
        icon: '雲',
        duration: 4000,
      })
    );
  });

  it('shows online toast when coming back online after being offline', () => {
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

  it('does not show online toast if never went offline', () => {
    renderHook(() => useNetworkStatus());

    // Clear any initial calls
    vi.mocked(toast).mockClear();

    // Trigger online event without going offline first
    window.dispatchEvent(new Event('online'));

    expect(toast).not.toHaveBeenCalled();
  });

  it('tracks offline state correctly across multiple transitions', () => {
    renderHook(() => useNetworkStatus());
    vi.mocked(toast).mockClear();

    // Go offline
    window.dispatchEvent(new Event('offline'));
    expect(toast).toHaveBeenCalledWith(
      'Connection lost. Changes may not be saved.',
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
      'Connection lost. Changes may not be saved.',
      expect.anything()
    );
  });

  it('applies correct styling to toasts', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });

    renderHook(() => useNetworkStatus());

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
});
