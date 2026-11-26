/**
 * The new-account default (design critique PR 4, J1): a new account starts on
 * "My device". An existing account's settings are never touched.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSessionGuards, type UseSessionGuardsOptions } from './useSessionGuards';
import { presetForSettings } from '../lib/securityPresets';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn() }) }));

const USER_ID = 'user-guards-1';
const key = (suffix: string) => `yidhan-${USER_ID}-${suffix}`;

function render(initial: Partial<UseSessionGuardsOptions>) {
  const base: UseSessionGuardsOptions = {
    userId: USER_ID,
    isEncryptionSetup: false,
    isUnlocked: false,
    isAccountSetup: false,
    lockVault: vi.fn(),
    signOut: vi.fn(async () => {}),
  };
  return renderHook((props: Partial<UseSessionGuardsOptions>) => useSessionGuards({ ...base, ...props }), {
    initialProps: initial,
  });
}

const presetOf = (result: ReturnType<typeof render>['result']) => presetForSettings({
  autoLockMinutes: result.current.vaultSettings.settings.autoLockMinutes,
  rememberBrowser: result.current.vaultSettings.settings.rememberBrowser,
  timeoutMinutes: result.current.sessionSettings.settings.timeoutMinutes,
});

beforeEach(() => {
  localStorage.clear();
});

describe('useSessionGuards new-account default', () => {
  it('puts a new account on "My device"', () => {
    const { result } = render({ isAccountSetup: true });

    expect(presetOf(result)).toBe('personal');
    expect(localStorage.getItem(key('vault-auto-lock-minutes'))).toBe('60');
    expect(localStorage.getItem(key('vault-remember-browser'))).toBe('false');
    expect(localStorage.getItem(key('session-timeout'))).toBe('10080');
  });

  it('does not fire for an existing account, which stays on its old values', () => {
    const { result } = render({ isAccountSetup: false });

    expect(presetOf(result)).toBe('custom');
    expect(localStorage.getItem(key('vault-auto-lock-minutes'))).toBeNull();
    expect(localStorage.getItem(key('session-timeout'))).toBeNull();
  });

  it.each([
    ['vault-auto-lock-minutes', '0'],
    ['vault-remember-browser', 'true'],
    ['session-timeout', '30'],
  ])('does not overwrite settings already stored on this browser (%s)', (suffix, value) => {
    localStorage.setItem(key(suffix), value);

    render({ isAccountSetup: true });

    expect(localStorage.getItem(key(suffix))).toBe(value);
    if (suffix !== 'vault-auto-lock-minutes') expect(localStorage.getItem(key('vault-auto-lock-minutes'))).toBeNull();
  });

  it('applies once, so a change made during setup is not undone on a re-render', () => {
    const { result, rerender } = render({ isAccountSetup: true });
    result.current.vaultSettings.setAutoLockMinutes(15);

    rerender({ isAccountSetup: false });
    rerender({ isAccountSetup: true });

    expect(localStorage.getItem(key('vault-auto-lock-minutes'))).toBe('15');
  });

  it('does nothing while signed out', () => {
    render({ userId: undefined, isAccountSetup: true });

    expect(localStorage.length).toBe(0);
  });
});
