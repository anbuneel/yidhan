/**
 * useVaultSettings.test.ts — Phase 2b
 *
 * Tests per-user vault settings (autoLockMinutes, rememberBrowser).
 * Settings persist in localStorage keyed by userId.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVaultSettings } from './useVaultSettings';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('useVaultSettings', () => {
  const USER_ID = 'user-vault-123';

  it('should return defaults when no userId', () => {
    const { result } = renderHook(() => useVaultSettings(null));

    expect(result.current.settings.autoLockMinutes).toBe(0);
    expect(result.current.settings.rememberBrowser).toBe(false);
  });

  it('should return defaults for a new user with no saved settings', () => {
    const { result } = renderHook(() => useVaultSettings(USER_ID));

    expect(result.current.settings.autoLockMinutes).toBe(0);
    expect(result.current.settings.rememberBrowser).toBe(false);
  });

  it('should load saved autoLockMinutes from localStorage', () => {
    localStorage.setItem(`yidhan-${USER_ID}-vault-auto-lock-minutes`, '15');

    const { result } = renderHook(() => useVaultSettings(USER_ID));

    expect(result.current.settings.autoLockMinutes).toBe(15);
  });

  it('should load saved rememberBrowser from localStorage', () => {
    localStorage.setItem(`yidhan-${USER_ID}-vault-remember-browser`, 'true');

    const { result } = renderHook(() => useVaultSettings(USER_ID));

    expect(result.current.settings.rememberBrowser).toBe(true);
  });

  it('should fall back to defaults for invalid autoLockMinutes', () => {
    localStorage.setItem(`yidhan-${USER_ID}-vault-auto-lock-minutes`, '99');

    const { result } = renderHook(() => useVaultSettings(USER_ID));

    // 99 is not in [0, 15, 60], should fall back to default 0
    expect(result.current.settings.autoLockMinutes).toBe(0);
  });

  it('should persist autoLockMinutes to localStorage', () => {
    const { result } = renderHook(() => useVaultSettings(USER_ID));

    act(() => { result.current.setAutoLockMinutes(60); });

    expect(result.current.settings.autoLockMinutes).toBe(60);
    expect(localStorage.getItem(`yidhan-${USER_ID}-vault-auto-lock-minutes`)).toBe('60');
  });

  it('should persist rememberBrowser to localStorage', () => {
    const { result } = renderHook(() => useVaultSettings(USER_ID));

    act(() => { result.current.setRememberBrowser(true); });

    expect(result.current.settings.rememberBrowser).toBe(true);
    expect(localStorage.getItem(`yidhan-${USER_ID}-vault-remember-browser`)).toBe('true');
  });

  it('should clear persisted keys when disabling rememberBrowser', () => {
    localStorage.setItem(`yidhan-${USER_ID}-vault-remember-browser`, 'true');
    localStorage.setItem(`yidhan-${USER_ID}-vault-persisted-keys`, 'some-keys');

    const { result } = renderHook(() => useVaultSettings(USER_ID));

    act(() => { result.current.setRememberBrowser(false); });

    expect(result.current.settings.rememberBrowser).toBe(false);
    expect(localStorage.getItem(`yidhan-${USER_ID}-vault-persisted-keys`)).toBeNull();
  });

  it('should not persist to localStorage when userId is null', () => {
    const { result } = renderHook(() => useVaultSettings(null));

    act(() => { result.current.setAutoLockMinutes(15); });

    expect(result.current.settings.autoLockMinutes).toBe(15);
    // Nothing should be written to localStorage
    expect(localStorage.getItem(`yidhan-null-vault-auto-lock-minutes`)).toBeNull();
  });

  it('should reload settings when userId changes', () => {
    localStorage.setItem('yidhan-user-a-vault-auto-lock-minutes', '15');
    localStorage.setItem('yidhan-user-b-vault-auto-lock-minutes', '60');

    const { result, rerender } = renderHook(
      ({ userId }) => useVaultSettings(userId),
      { initialProps: { userId: 'user-a' as string | null } }
    );

    expect(result.current.settings.autoLockMinutes).toBe(15);

    rerender({ userId: 'user-b' });
    expect(result.current.settings.autoLockMinutes).toBe(60);
  });

  it('should reset to defaults when userId changes to null', () => {
    localStorage.setItem(`yidhan-${USER_ID}-vault-auto-lock-minutes`, '60');

    const { result, rerender } = renderHook(
      ({ userId }) => useVaultSettings(userId),
      { initialProps: { userId: USER_ID as string | null } }
    );

    expect(result.current.settings.autoLockMinutes).toBe(60);

    rerender({ userId: null });
    expect(result.current.settings.autoLockMinutes).toBe(0);
    expect(result.current.settings.rememberBrowser).toBe(false);
  });
});
