/**
 * useSessionSettings.test.ts — Phase 2b
 *
 * Tests session timeout & trusted device settings.
 * Covers localStorage persistence, 90-day TTL expiry,
 * timeout options filtering, and effective timeout calculation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import toast from 'react-hot-toast';
import { useSessionSettings, TIMEOUT_OPTIONS, setTrustedDeviceOnLogin } from './useSessionSettings';
import { useSessionTimeout } from './useSessionTimeout';
import { useVaultSettings } from './useVaultSettings';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

const USER_ID = 'user-session-456';

describe('useSessionSettings', () => {
  it('should return defaults when no userId', () => {
    const { result } = renderHook(() => useSessionSettings(null));

    expect(result.current.settings.timeoutMinutes).toBe(10080); // 1 week
    expect(result.current.settings.isTrustedDevice).toBe(false);
    expect(result.current.settings.trustedAt).toBeNull();
  });

  it('should return defaults for a new user', () => {
    const { result } = renderHook(() => useSessionSettings(USER_ID));

    expect(result.current.settings.timeoutMinutes).toBe(10080);
    expect(result.current.settings.isTrustedDevice).toBe(false);
  });

  it('should load saved timeout from localStorage', () => {
    localStorage.setItem(`yidhan-${USER_ID}-session-timeout`, '60');

    const { result } = renderHook(() => useSessionSettings(USER_ID));

    expect(result.current.settings.timeoutMinutes).toBe(60);
  });

  it('should handle "null" string for never timeout', () => {
    localStorage.setItem(`yidhan-${USER_ID}-session-timeout`, 'null');
    localStorage.setItem(`yidhan-${USER_ID}-trusted-device`, 'true');
    localStorage.setItem(`yidhan-${USER_ID}-trusted-at`, new Date().toISOString());

    const { result } = renderHook(() => useSessionSettings(USER_ID));

    expect(result.current.settings.timeoutMinutes).toBeNull();
  });

  it('should fall back to default for invalid timeout value', () => {
    localStorage.setItem(`yidhan-${USER_ID}-session-timeout`, 'garbage');

    const { result } = renderHook(() => useSessionSettings(USER_ID));

    expect(result.current.settings.timeoutMinutes).toBe(10080);
  });

  describe('setTimeoutMinutes', () => {
    it('should update timeout and persist to localStorage', () => {
      const { result } = renderHook(() => useSessionSettings(USER_ID));

      act(() => { result.current.setTimeoutMinutes(30); });

      expect(result.current.settings.timeoutMinutes).toBe(30);
      expect(localStorage.getItem(`yidhan-${USER_ID}-session-timeout`)).toBe('30');
    });

    it('should store "null" string for never timeout', () => {
      // Must be trusted to set "never"
      localStorage.setItem(`yidhan-${USER_ID}-trusted-device`, 'true');
      localStorage.setItem(`yidhan-${USER_ID}-trusted-at`, new Date().toISOString());

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      act(() => { result.current.setTimeoutMinutes(null); });

      expect(result.current.settings.timeoutMinutes).toBeNull();
      expect(localStorage.getItem(`yidhan-${USER_ID}-session-timeout`)).toBe('null');
    });

    it('should reject "never" timeout without trusted device', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() => useSessionSettings(USER_ID));

      act(() => { result.current.setTimeoutMinutes(null); });

      // Should remain at default
      expect(result.current.settings.timeoutMinutes).toBe(10080);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot set timeout to "never"')
      );
      warnSpy.mockRestore();
    });

    it('should not update when userId is null', () => {
      const { result } = renderHook(() => useSessionSettings(null));

      act(() => { result.current.setTimeoutMinutes(30); });

      // Should remain at default
      expect(result.current.settings.timeoutMinutes).toBe(10080);
    });
  });

  describe('trusted device', () => {
    it('should enable trusted device with timestamp', () => {
      const { result } = renderHook(() => useSessionSettings(USER_ID));

      act(() => { result.current.enableTrustedDevice(); });

      expect(result.current.settings.isTrustedDevice).toBe(true);
      expect(result.current.settings.trustedAt).toBeTruthy();
      expect(localStorage.getItem(`yidhan-${USER_ID}-trusted-device`)).toBe('true');
      expect(localStorage.getItem(`yidhan-${USER_ID}-trusted-at`)).toBeTruthy();
    });

    it('should disable trusted device and clear storage', () => {
      localStorage.setItem(`yidhan-${USER_ID}-trusted-device`, 'true');
      localStorage.setItem(`yidhan-${USER_ID}-trusted-at`, new Date().toISOString());

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      act(() => { result.current.disableTrustedDevice(); });

      expect(result.current.settings.isTrustedDevice).toBe(false);
      expect(result.current.settings.trustedAt).toBeNull();
      expect(localStorage.getItem(`yidhan-${USER_ID}-trusted-device`)).toBeNull();
    });

    it('should revert "never" timeout when disabling trusted device', () => {
      localStorage.setItem(`yidhan-${USER_ID}-trusted-device`, 'true');
      localStorage.setItem(`yidhan-${USER_ID}-trusted-at`, new Date().toISOString());
      localStorage.setItem(`yidhan-${USER_ID}-session-timeout`, 'null');

      const { result } = renderHook(() => useSessionSettings(USER_ID));
      expect(result.current.settings.timeoutMinutes).toBeNull();

      act(() => { result.current.disableTrustedDevice(); });

      // Should revert to default (1 week)
      expect(result.current.settings.timeoutMinutes).toBe(10080);
    });

    it('should toggle trusted device', () => {
      const { result } = renderHook(() => useSessionSettings(USER_ID));

      act(() => { result.current.toggleTrustedDevice(); });
      expect(result.current.settings.isTrustedDevice).toBe(true);

      act(() => { result.current.toggleTrustedDevice(); });
      expect(result.current.settings.isTrustedDevice).toBe(false);
    });

    it('should expire trust after 90 days', () => {
      const ninetyOneDaysAgo = new Date();
      ninetyOneDaysAgo.setDate(ninetyOneDaysAgo.getDate() - 91);

      localStorage.setItem(`yidhan-${USER_ID}-trusted-device`, 'true');
      localStorage.setItem(`yidhan-${USER_ID}-trusted-at`, ninetyOneDaysAgo.toISOString());

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      // Trust should be expired on load
      expect(result.current.settings.isTrustedDevice).toBe(false);
      expect(result.current.settings.trustedAt).toBeNull();
    });

    it('should revert "never" timeout when trust expires', () => {
      const ninetyOneDaysAgo = new Date();
      ninetyOneDaysAgo.setDate(ninetyOneDaysAgo.getDate() - 91);

      localStorage.setItem(`yidhan-${USER_ID}-trusted-device`, 'true');
      localStorage.setItem(`yidhan-${USER_ID}-trusted-at`, ninetyOneDaysAgo.toISOString());
      localStorage.setItem(`yidhan-${USER_ID}-session-timeout`, 'null');

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      // "never" should revert to default
      expect(result.current.settings.timeoutMinutes).toBe(10080);
    });

    it('should not enable trusted device when userId is null', () => {
      const { result } = renderHook(() => useSessionSettings(null));

      act(() => { result.current.enableTrustedDevice(); });

      expect(result.current.settings.isTrustedDevice).toBe(false);
    });
  });

  describe('getEffectiveTimeout', () => {
    const trustDevice = (trustedAt = new Date()) => {
      localStorage.setItem(`yidhan-${USER_ID}-trusted-device`, 'true');
      localStorage.setItem(`yidhan-${USER_ID}-trusted-at`, trustedAt.toISOString());
    };
    const expiredTrust = () => new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);

    const FINITE_OPTIONS = TIMEOUT_OPTIONS.filter((o) => o.value !== null);

    it.each(FINITE_OPTIONS)('applies "$label" on a non-trusted device', ({ value }) => {
      localStorage.setItem(`yidhan-${USER_ID}-session-timeout`, String(value));

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.getEffectiveTimeout()).toBe(value);
    });

    // I1: a trusted device used to replace every choice with 14 days.
    it.each(FINITE_OPTIONS)('applies "$label" on a trusted device', ({ value }) => {
      trustDevice();
      localStorage.setItem(`yidhan-${USER_ID}-session-timeout`, String(value));

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.settings.isTrustedDevice).toBe(true);
      expect(result.current.getEffectiveTimeout()).toBe(value);
    });

    it('applies a choice made after trusting the device', () => {
      const { result } = renderHook(() => useSessionSettings(USER_ID));

      act(() => { result.current.enableTrustedDevice(); });
      act(() => { result.current.setTimeoutMinutes(30); });

      expect(result.current.getEffectiveTimeout()).toBe(30);
    });

    it('keeps the chosen timeout when trust is turned on', () => {
      localStorage.setItem(`yidhan-${USER_ID}-session-timeout`, '60');
      const { result } = renderHook(() => useSessionSettings(USER_ID));

      act(() => { result.current.enableTrustedDevice(); });

      expect(result.current.getEffectiveTimeout()).toBe(60);
    });

    it('returns the 1-week default on a trusted device with no choice saved', () => {
      trustDevice();

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.getEffectiveTimeout()).toBe(10080);
    });

    it('should return null for "never" on trusted device', () => {
      trustDevice();
      localStorage.setItem(`yidhan-${USER_ID}-session-timeout`, 'null');

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.getEffectiveTimeout()).toBeNull();
    });

    it('does not apply a stored "never" without a trusted device', () => {
      // A stray 'null' with no trust flag must not turn the timeout off.
      localStorage.setItem(`yidhan-${USER_ID}-session-timeout`, 'null');

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.settings.isTrustedDevice).toBe(false);
      expect(result.current.getEffectiveTimeout()).toBe(10080);
    });

    it('does not apply "never" once trust has expired', () => {
      trustDevice(expiredTrust());
      localStorage.setItem(`yidhan-${USER_ID}-session-timeout`, 'null');

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.settings.isTrustedDevice).toBe(false);
      expect(result.current.getEffectiveTimeout()).toBe(10080);
    });

    it('keeps a finite choice when trust expires', () => {
      trustDevice(expiredTrust());
      localStorage.setItem(`yidhan-${USER_ID}-session-timeout`, '30');

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.settings.isTrustedDevice).toBe(false);
      expect(result.current.getEffectiveTimeout()).toBe(30);
    });

    it('shows the expiry toast when the user signs in after trust expired', () => {
      trustDevice(expiredTrust());

      const { rerender } = renderHook(({ id }) => useSessionSettings(id), {
        initialProps: { id: null as string | null },
      });
      rerender({ id: USER_ID });

      expect(toast).toHaveBeenCalledTimes(1);
      expect(toast).toHaveBeenCalledWith(
        expect.stringContaining('trusted device status has expired'),
        expect.anything(),
      );
    });

    it('shows the expiry toast when trust expired before first mount', () => {
      trustDevice(expiredTrust());

      const { rerender } = renderHook(() => useSessionSettings(USER_ID));
      rerender();

      expect(toast).toHaveBeenCalledTimes(1);
    });

    it('does not show the expiry toast while trust is valid', () => {
      trustDevice();

      const { rerender } = renderHook(({ id }) => useSessionSettings(id), {
        initialProps: { id: null as string | null },
      });
      rerender({ id: USER_ID });

      expect(toast).not.toHaveBeenCalled();
    });

    it('leaves vault auto-lock and "Remember this browser" alone', () => {
      localStorage.setItem(`yidhan-${USER_ID}-vault-auto-lock-minutes`, '15');
      localStorage.setItem(`yidhan-${USER_ID}-vault-remember-browser`, 'true');

      const { result } = renderHook(() => ({
        session: useSessionSettings(USER_ID),
        vault: useVaultSettings(USER_ID),
      }));
      const vaultBefore = result.current.vault.settings;

      act(() => { result.current.session.enableTrustedDevice(); });
      act(() => { result.current.session.setTimeoutMinutes(null); });
      act(() => { result.current.session.disableTrustedDevice(); });

      expect(result.current.vault.settings).toEqual(vaultBefore);
      expect(localStorage.getItem(`yidhan-${USER_ID}-vault-auto-lock-minutes`)).toBe('15');
      expect(localStorage.getItem(`yidhan-${USER_ID}-vault-remember-browser`)).toBe('true');
    });

    it('should return default when no custom timeout set', () => {
      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.getEffectiveTimeout()).toBe(10080);
    });
  });

  describe('trusted device with 30 minutes chosen', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('ends the session after 30 minutes of inactivity', async () => {
      localStorage.setItem(`yidhan-${USER_ID}-trusted-device`, 'true');
      localStorage.setItem(`yidhan-${USER_ID}-trusted-at`, new Date().toISOString());
      localStorage.setItem(`yidhan-${USER_ID}-session-timeout`, '30');
      const onTimeout = vi.fn();

      renderHook(() => {
        const timeoutMinutes = useSessionSettings(USER_ID).getEffectiveTimeout();
        return useSessionTimeout({ timeoutMinutes, warningMinutes: 5, onTimeout, enabled: true });
      });
      await act(async () => { await Promise.resolve(); });

      act(() => { vi.advanceTimersByTime(29 * 60 * 1000); });
      expect(onTimeout).not.toHaveBeenCalled();

      act(() => { vi.advanceTimersByTime(60 * 1000); });
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('availableTimeoutOptions', () => {
    it('should exclude "Never" option for non-trusted devices', () => {
      const { result } = renderHook(() => useSessionSettings(USER_ID));

      const neverOption = result.current.availableTimeoutOptions.find(
        (o) => o.value === null
      );
      expect(neverOption).toBeUndefined();
    });

    it('should include "Never" option for trusted devices', () => {
      localStorage.setItem(`yidhan-${USER_ID}-trusted-device`, 'true');
      localStorage.setItem(`yidhan-${USER_ID}-trusted-at`, new Date().toISOString());

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      const neverOption = result.current.availableTimeoutOptions.find(
        (o) => o.value === null
      );
      expect(neverOption).toBeDefined();
    });

    it('should always include non-restricted options', () => {
      const { result } = renderHook(() => useSessionSettings(USER_ID));

      const nonRestricted = TIMEOUT_OPTIONS.filter((o) => !o.requiresTrustedDevice);
      expect(result.current.availableTimeoutOptions).toHaveLength(nonRestricted.length);
    });
  });
});

describe('setTrustedDeviceOnLogin', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should set trusted device flag and timestamp in localStorage', () => {
    setTrustedDeviceOnLogin(USER_ID);

    expect(localStorage.getItem(`yidhan-${USER_ID}-trusted-device`)).toBe('true');
    expect(localStorage.getItem(`yidhan-${USER_ID}-trusted-at`)).toBeTruthy();
  });
});
