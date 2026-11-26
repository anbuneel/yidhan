/**
 * useSessionSettings.test.ts
 *
 * Session timeout settings: localStorage persistence, the 90-day "Never",
 * effective timeout, and the upgrade from the removed trusted-device flag (PR 4, J3).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { StrictMode } from 'react';
import toast from 'react-hot-toast';
import { useSessionSettings, TIMEOUT_OPTIONS, hasStoredSessionTimeout } from './useSessionSettings';
import { useSessionTimeout } from './useSessionTimeout';
import { useVaultSettings } from './useVaultSettings';

vi.mock('react-hot-toast', () => ({
  default: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// The setup's localStorage mock methods are vi.fn()s, so a spy on one replaces its
// implementation instead of wrapping it. Put the real ones back after each test.
const realSetItem = vi.mocked(localStorage.setItem).getMockImplementation();
const realGetItem = vi.mocked(localStorage.getItem).getMockImplementation();
afterEach(() => {
  if (realSetItem) vi.mocked(localStorage.setItem).mockImplementation(realSetItem);
  if (realGetItem) vi.mocked(localStorage.getItem).mockImplementation(realGetItem);
});

const USER_ID = 'user-session-456';
const DAY_MS = 24 * 60 * 60 * 1000;
const key = (suffix: string) => `yidhan-${USER_ID}-${suffix}`;

/** The keys the old trusted-device switch wrote. "Never" reads the same ones now. */
const storeNeverRecord = (since: Date | string = new Date()) => {
  localStorage.setItem(key('trusted-device'), 'true');
  localStorage.setItem(key('trusted-at'), typeof since === 'string' ? since : since.toISOString());
};
const expired = () => new Date(Date.now() - 91 * DAY_MS);

describe('useSessionSettings', () => {
  it('returns defaults when no userId', () => {
    const { result } = renderHook(() => useSessionSettings(null));

    expect(result.current.settings).toEqual({ timeoutMinutes: 10080, neverSince: null });
  });

  it('returns defaults for a new user', () => {
    const { result } = renderHook(() => useSessionSettings(USER_ID));

    expect(result.current.settings).toEqual({ timeoutMinutes: 10080, neverSince: null });
  });

  it('loads a saved timeout', () => {
    localStorage.setItem(key('session-timeout'), '60');

    const { result } = renderHook(() => useSessionSettings(USER_ID));

    expect(result.current.settings.timeoutMinutes).toBe(60);
  });

  it('falls back to the default for an invalid timeout value', () => {
    localStorage.setItem(key('session-timeout'), 'garbage');

    const { result } = renderHook(() => useSessionSettings(USER_ID));

    expect(result.current.settings.timeoutMinutes).toBe(10080);
  });

  it('offers every option, Never included, with its 90-day limit in the label', () => {
    expect(TIMEOUT_OPTIONS.map((o) => o.value)).toEqual([30, 60, 1440, 10080, null]);
    expect(TIMEOUT_OPTIONS.find((o) => o.value === null)?.label).toBe('Never (for 90 days)');
  });

  describe('setTimeoutMinutes', () => {
    it('updates the timeout and stores it', () => {
      const { result } = renderHook(() => useSessionSettings(USER_ID));

      let ok = false;
      act(() => { ok = result.current.setTimeoutMinutes(30); });

      expect(ok).toBe(true);
      expect(result.current.settings.timeoutMinutes).toBe(30);
      expect(localStorage.getItem(key('session-timeout'))).toBe('30');
    });

    it('starts a 90-day Never without any trusted-device step', () => {
      const { result } = renderHook(() => useSessionSettings(USER_ID));

      act(() => { result.current.setTimeoutMinutes(null); });

      expect(result.current.settings.timeoutMinutes).toBeNull();
      expect(result.current.settings.neverSince).toBeTruthy();
      expect(result.current.getEffectiveTimeout()).toBeNull();
      expect(localStorage.getItem(key('session-timeout'))).toBe('null');
      expect(localStorage.getItem(key('trusted-device'))).toBe('true');
      expect(localStorage.getItem(key('trusted-at'))).toBe(result.current.settings.neverSince);
    });

    it('reads a chosen Never back after a remount', () => {
      const first = renderHook(() => useSessionSettings(USER_ID));
      act(() => { first.result.current.setTimeoutMinutes(null); });
      first.unmount();

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.getEffectiveTimeout()).toBeNull();
    });

    it('drops the Never record when a finite timeout is chosen', () => {
      storeNeverRecord();
      localStorage.setItem(key('session-timeout'), 'null');
      const { result } = renderHook(() => useSessionSettings(USER_ID));

      act(() => { result.current.setTimeoutMinutes(60); });

      expect(result.current.settings).toEqual({ timeoutMinutes: 60, neverSince: null });
      expect(localStorage.getItem(key('trusted-device'))).toBeNull();
      expect(localStorage.getItem(key('trusted-at'))).toBeNull();
    });

    it('does not update when userId is null', () => {
      const { result } = renderHook(() => useSessionSettings(null));

      let ok = true;
      act(() => { ok = result.current.setTimeoutMinutes(30); });

      expect(ok).toBe(false);
      expect(result.current.settings.timeoutMinutes).toBe(10080);
    });

    it('ignores a value that is not an option', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() => useSessionSettings(USER_ID));

      let ok = true;
      act(() => { ok = result.current.setTimeoutMinutes(45); });

      expect(ok).toBe(false);
      expect(result.current.getEffectiveTimeout()).toBe(10080);
      expect(localStorage.getItem(key('session-timeout'))).toBeNull();
      warn.mockRestore();
    });

    it('returns false and keeps the old choice when storage is blocked', () => {
      localStorage.setItem(key('session-timeout'), '60');
      const { result } = renderHook(() => useSessionSettings(USER_ID));
      const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      let ok = true;
      act(() => { ok = result.current.setTimeoutMinutes(null); });

      expect(ok).toBe(false);
      expect(result.current.getEffectiveTimeout()).toBe(60);
      setItem.mockRestore();
      warn.mockRestore();
    });
  });

  describe('when a finite timeout cannot be stored', () => {
    it('applies it for this session and returns false', () => {
      localStorage.setItem(key('session-timeout'), '10080');
      const { result } = renderHook(() => useSessionSettings(USER_ID));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });

      let ok = true;
      act(() => { ok = result.current.setTimeoutMinutes(60); });

      expect(ok).toBe(false);
      expect(result.current.getEffectiveTimeout()).toBe(60);
      warn.mockRestore();
    });
  });

  describe('getEffectiveTimeout', () => {
    const FINITE_OPTIONS = TIMEOUT_OPTIONS.filter((o) => o.value !== null);

    it.each(FINITE_OPTIONS)('applies "$label"', ({ value }) => {
      localStorage.setItem(key('session-timeout'), String(value));

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.getEffectiveTimeout()).toBe(value);
    });

    it('does not apply a stored Never without its record', () => {
      // A stray 'null' with no record must not turn the timeout off.
      localStorage.setItem(key('session-timeout'), 'null');

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.getEffectiveTimeout()).toBe(10080);
      expect(result.current.settings.timeoutMinutes).toBe(10080);
      expect(localStorage.getItem(key('session-timeout'))).toBe('10080');
      expect(toast).not.toHaveBeenCalled();
    });

    it.each(['0', '-5', '45', '30abc', '1e9', '20160'])(
      'does not enforce stored value %s that is not an option',
      (stored) => {
        localStorage.setItem(key('session-timeout'), stored);

        const { result } = renderHook(() => useSessionSettings(USER_ID));

        expect(result.current.getEffectiveTimeout()).toBe(10080);
        expect(localStorage.getItem(key('session-timeout'))).toBe('10080');
      },
    );

    it.each([
      ['unreadable', 'not-a-date'],
      ['future', new Date(Date.now() + DAY_MS).toISOString()],
    ])('treats an %s start date as expired, so Never does not apply', (_kind, since) => {
      storeNeverRecord(since);
      localStorage.setItem(key('session-timeout'), 'null');

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.getEffectiveTimeout()).toBe(10080);
      expect(localStorage.getItem(key('trusted-device'))).toBeNull();
    });

    it('keeps Never when its start date is a minute ahead of the clock', () => {
      storeNeverRecord(new Date(Date.now() + 60 * 1000));
      localStorage.setItem(key('session-timeout'), 'null');

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.getEffectiveTimeout()).toBeNull();
    });

    it('ends Never after 90 days, with a notice', () => {
      storeNeverRecord(expired());
      localStorage.setItem(key('session-timeout'), 'null');

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.getEffectiveTimeout()).toBe(10080);
      expect(localStorage.getItem(key('session-timeout'))).toBe('10080');
      expect(toast).toHaveBeenCalledTimes(1);
      expect(toast).toHaveBeenCalledWith(expect.stringContaining('ended after 90 days'), expect.anything());
    });

    it('still applies corrected settings when storage is full', () => {
      storeNeverRecord(expired());
      localStorage.setItem(key('session-timeout'), 'null');
      const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.getEffectiveTimeout()).toBe(10080);
      expect(localStorage.getItem(key('trusted-device'))).toBeNull();
      expect(toast).toHaveBeenCalledTimes(1);
      setItem.mockRestore();
      warn.mockRestore();
    });

    it('shows the notice when the user signs in after Never ended', () => {
      storeNeverRecord(expired());
      localStorage.setItem(key('session-timeout'), 'null');

      const { rerender } = renderHook(({ id }) => useSessionSettings(id), {
        initialProps: { id: null as string | null },
      });
      rerender({ id: USER_ID });

      expect(toast).toHaveBeenCalledTimes(1);
    });

    it('shows the notice once under StrictMode', () => {
      storeNeverRecord(expired());
      localStorage.setItem(key('session-timeout'), 'null');

      renderHook(() => useSessionSettings(USER_ID), { wrapper: StrictMode });

      expect(toast).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(key('trusted-device'))).toBeNull();
    });

    it('does not show the notice while Never is live', () => {
      storeNeverRecord();
      localStorage.setItem(key('session-timeout'), 'null');

      renderHook(() => useSessionSettings(USER_ID));

      expect(toast).not.toHaveBeenCalled();
    });

    it('leaves vault auto-lock and "Remember this browser" alone', () => {
      localStorage.setItem(key('vault-auto-lock-minutes'), '15');
      localStorage.setItem(key('vault-remember-browser'), 'true');

      const { result } = renderHook(() => ({
        session: useSessionSettings(USER_ID),
        vault: useVaultSettings(USER_ID),
      }));
      const vaultBefore = result.current.vault.settings;

      act(() => { result.current.session.setTimeoutMinutes(null); });
      act(() => { result.current.session.setTimeoutMinutes(30); });

      expect(result.current.vault.settings).toEqual(vaultBefore);
      expect(localStorage.getItem(key('vault-auto-lock-minutes'))).toBe('15');
      expect(localStorage.getItem(key('vault-remember-browser'))).toBe('true');
    });
  });

  /**
   * J3: the trusted-device flag is gone. Every combination stored by the old version
   * must enforce the same timeout as before: nobody is signed out sooner, and no
   * session gets longer. `oldEffective` is the PR 1 rule, written out.
   */
  describe('upgrade from the trusted-device version', () => {
    type Trust = 'none' | 'valid' | 'expired' | 'flag-only';
    const TRUST: Trust[] = ['none', 'valid', 'expired', 'flag-only'];
    const STORED_TIMEOUTS: (string | null)[] = [null, '30', '60', '1440', '10080', 'null', 'garbage'];

    function oldEffective(trust: Trust, stored: string | null): number | null {
      const trusted = trust === 'valid';
      if (stored === 'null') return trusted ? null : 10080;
      const n = Number(stored);
      return stored !== null && [30, 60, 1440, 10080].includes(n) ? n : 10080;
    }

    const cases = TRUST.flatMap((trust) => STORED_TIMEOUTS.map((stored) => [trust, stored] as const));

    it.each(cases)('trust %s, stored timeout %s: same timeout as before', (trust, stored) => {
      if (trust === 'valid') storeNeverRecord(new Date(Date.now() - 10 * DAY_MS));
      if (trust === 'expired') storeNeverRecord(expired());
      if (trust === 'flag-only') localStorage.setItem(key('trusted-device'), 'true');
      if (stored !== null) localStorage.setItem(key('session-timeout'), stored);

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.getEffectiveTimeout()).toBe(oldEffective(trust, stored));
    });

    it('keeps the old 90-day end date for a trusted device on Never', () => {
      const trustedAt = new Date(Date.now() - 80 * DAY_MS).toISOString();
      storeNeverRecord(trustedAt);
      localStorage.setItem(key('session-timeout'), 'null');

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.settings.neverSince).toBe(trustedAt);
    });

    it('drops a trust flag that no longer does anything, without a notice', () => {
      storeNeverRecord(expired());
      localStorage.setItem(key('session-timeout'), '30');

      const { result } = renderHook(() => useSessionSettings(USER_ID));

      expect(result.current.getEffectiveTimeout()).toBe(30);
      expect(localStorage.getItem(key('trusted-device'))).toBeNull();
      expect(localStorage.getItem(key('trusted-at'))).toBeNull();
      expect(localStorage.getItem(key('session-timeout'))).toBe('30');
      expect(toast).not.toHaveBeenCalled();
    });
  });

  describe('30 minutes chosen', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('ends the session after 30 minutes of inactivity, even with an old trust flag', async () => {
      storeNeverRecord();
      localStorage.setItem(key('session-timeout'), '30');
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
});

describe('hasStoredSessionTimeout', () => {
  it('is false with nothing stored and true once a timeout is stored', () => {
    expect(hasStoredSessionTimeout(USER_ID)).toBe(false);
    localStorage.setItem(key('session-timeout'), '60');
    expect(hasStoredSessionTimeout(USER_ID)).toBe(true);
  });

  it('counts unreadable storage as nothing stored', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(hasStoredSessionTimeout(USER_ID)).toBe(false);
  });
});

describe('setTimeoutMinutes when the Never record cannot be cleared', () => {
  it('still applies the stored finite timeout, and the next load cleans up', () => {
    storeNeverRecord();
    localStorage.setItem(key('session-timeout'), 'null');
    const { result, unmount } = renderHook(() => useSessionSettings(USER_ID));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const realRemove = vi.mocked(localStorage.removeItem).getMockImplementation();
    vi.mocked(localStorage.removeItem).mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    let ok = false;
    act(() => { ok = result.current.setTimeoutMinutes(60); });

    expect(ok).toBe(true);
    expect(result.current.getEffectiveTimeout()).toBe(60);
    if (realRemove) vi.mocked(localStorage.removeItem).mockImplementation(realRemove);
    warn.mockRestore();
    unmount();

    const again = renderHook(() => useSessionSettings(USER_ID));
    expect(again.result.current.getEffectiveTimeout()).toBe(60);
    expect(localStorage.getItem(key('trusted-device'))).toBeNull();
  });
});
