import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  applySecurityPreset,
  presetForSettings,
  settingsForPreset,
  SECURITY_PRESETS,
  type DeviceSecuritySettings,
  type SecurityPresetId,
} from './securityPresets';
import { TIMEOUT_OPTIONS, useSessionSettings } from '../hooks/useSessionSettings';
import { useVaultSettings, type AutoLockMinutes } from '../hooks/useVaultSettings';

vi.mock('react-hot-toast', () => ({ default: vi.fn() }));

const USER_ID = 'user-presets-1';
const key = (suffix: string) => `yidhan-${USER_ID}-${suffix}`;
const IDS: SecurityPresetId[] = ['shared', 'personal', 'stay-unlocked'];

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// The setup's localStorage mock methods are vi.fn()s, so a spy on one replaces its
// implementation instead of wrapping it. Put the real ones back after each test.
const realSetItem = vi.mocked(localStorage.setItem).getMockImplementation();
const realGetItem = vi.mocked(localStorage.getItem).getMockImplementation();
afterEach(() => {
  if (realSetItem) vi.mocked(localStorage.setItem).mockImplementation(realSetItem);
  if (realGetItem) vi.mocked(localStorage.getItem).mockImplementation(realGetItem);
});

describe('preset table', () => {
  it('holds the three presets from J1, in order', () => {
    expect(SECURITY_PRESETS.map((p) => [p.id, p.label])).toEqual([
      ['shared', 'Shared device'],
      ['personal', 'My device'],
      ['stay-unlocked', 'Stay unlocked'],
    ]);
  });

  it.each(IDS)('%s uses only values the settings hooks accept', (id) => {
    const s = settingsForPreset(id);
    expect([0, 15, 60]).toContain(s.autoLockMinutes);
    expect(TIMEOUT_OPTIONS.map((o) => o.value)).toContain(s.timeoutMinutes);
  });

  it('only "Stay unlocked" remembers the browser', () => {
    expect(IDS.filter((id) => settingsForPreset(id).rememberBrowser)).toEqual(['stay-unlocked']);
  });

  it('no preset turns the session timeout off', () => {
    for (const id of IDS) expect(settingsForPreset(id).timeoutMinutes).not.toBeNull();
  });

  it('gives each preset a different combination', () => {
    const combos = IDS.map((id) => JSON.stringify(settingsForPreset(id)));
    expect(new Set(combos).size).toBe(IDS.length);
  });

  it('returns a copy, so a caller cannot change the table', () => {
    settingsForPreset('shared').autoLockMinutes = 0;
    expect(settingsForPreset('shared').autoLockMinutes).toBe(15);
  });
});

describe('presetForSettings', () => {
  it.each(IDS)('maps %s settings back to %s', (id) => {
    expect(presetForSettings(settingsForPreset(id))).toBe(id);
  });

  it('reads the J1 values', () => {
    expect(presetForSettings({ autoLockMinutes: 15, rememberBrowser: false, timeoutMinutes: 60 })).toBe('shared');
    expect(presetForSettings({ autoLockMinutes: 60, rememberBrowser: false, timeoutMinutes: 10080 })).toBe('personal');
    expect(presetForSettings({ autoLockMinutes: 0, rememberBrowser: true, timeoutMinutes: 10080 })).toBe('stay-unlocked');
  });

  // Every combination the settings can hold maps to exactly one preset or Custom.
  const AUTO: AutoLockMinutes[] = [0, 15, 60];
  const TIMEOUTS = TIMEOUT_OPTIONS.map((o) => o.value);
  const all: DeviceSecuritySettings[] = AUTO.flatMap((autoLockMinutes) =>
    [false, true].flatMap((rememberBrowser) =>
      TIMEOUTS.map((timeoutMinutes) => ({ autoLockMinutes, rememberBrowser, timeoutMinutes }))));

  it('shows Custom for every combination that is not a preset', () => {
    const matched = all.filter((s) => presetForSettings(s) !== 'custom');
    expect(matched).toHaveLength(3);
    for (const s of all) {
      const id = presetForSettings(s);
      if (id !== 'custom') expect(settingsForPreset(id)).toEqual(s);
    }
  });

  it('shows Custom for the old defaults: auto-lock off, not remembered, 1 week', () => {
    expect(presetForSettings({ autoLockMinutes: 0, rememberBrowser: false, timeoutMinutes: 10080 })).toBe('custom');
  });

  it('shows Custom when one value differs from a preset', () => {
    expect(presetForSettings({ autoLockMinutes: 15, rememberBrowser: false, timeoutMinutes: 30 })).toBe('custom');
    expect(presetForSettings({ autoLockMinutes: 0, rememberBrowser: true, timeoutMinutes: null })).toBe('custom');
    expect(presetForSettings({ autoLockMinutes: 60, rememberBrowser: true, timeoutMinutes: 10080 })).toBe('custom');
  });
});

/** The real hooks, so a preset is checked against what storage and the timers will see. */
function renderSettings() {
  return renderHook(() => ({ vault: useVaultSettings(USER_ID), session: useSessionSettings(USER_ID) }));
}
type Rendered = ReturnType<typeof renderSettings>['result'];
const current = (r: Rendered): DeviceSecuritySettings => ({
  autoLockMinutes: r.current.vault.settings.autoLockMinutes,
  rememberBrowser: r.current.vault.settings.rememberBrowser,
  timeoutMinutes: r.current.session.settings.timeoutMinutes,
});
const targets = (r: Rendered, persistKeys?: () => boolean) => ({
  setAutoLockMinutes: r.current.vault.setAutoLockMinutes,
  setRememberBrowser: r.current.vault.setRememberBrowser,
  setTimeoutMinutes: r.current.session.setTimeoutMinutes,
  persistKeys,
});

describe('applySecurityPreset', () => {
  it.each(IDS)('applies %s and reads back as %s, also after a remount', (id) => {
    const { result, unmount } = renderSettings();

    act(() => { expect(applySecurityPreset(id, targets(result))).toEqual({ ok: true }); });

    expect(current(result)).toEqual(settingsForPreset(id));
    expect(presetForSettings(current(result))).toBe(id);
    unmount();
    const again = renderSettings();
    expect(presetForSettings(current(again.result))).toBe(id);
  });

  it('persists the unlocked keys when "Stay unlocked" is chosen while unlocked', () => {
    const { result } = renderSettings();
    const persistKeys = vi.fn(() => {
      localStorage.setItem(key('vault-persisted-keys'), '{}');
      return true;
    });

    act(() => { applySecurityPreset('stay-unlocked', targets(result, persistKeys)); });

    expect(persistKeys).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(key('vault-remember-browser'))).toBe('true');
  });

  it.each(['shared', 'personal'] as const)('%s clears remembered keys and never persists them', (id) => {
    localStorage.setItem(key('vault-remember-browser'), 'true');
    localStorage.setItem(key('vault-persisted-keys'), '{}');
    const { result } = renderSettings();
    const persistKeys = vi.fn(() => true);

    act(() => { applySecurityPreset(id, targets(result, persistKeys)); });

    expect(persistKeys).not.toHaveBeenCalled();
    expect(result.current.vault.settings.rememberBrowser).toBe(false);
    expect(localStorage.getItem(key('vault-persisted-keys'))).toBeNull();
    expect(localStorage.getItem(key('vault-remember-browser'))).toBe('false');
  });

  it('ends a 90-day Never when a preset is chosen', () => {
    localStorage.setItem(key('trusted-device'), 'true');
    localStorage.setItem(key('trusted-at'), new Date().toISOString());
    localStorage.setItem(key('session-timeout'), 'null');
    const { result } = renderSettings();

    act(() => { applySecurityPreset('stay-unlocked', targets(result)); });

    expect(result.current.session.getEffectiveTimeout()).toBe(10080);
    expect(localStorage.getItem(key('trusted-device'))).toBeNull();
  });

  describe('where localStorage is unavailable', () => {
    function blockWrites() {
      vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    }

    it('never turns on "Remember this browser", and changes nothing else', () => {
      localStorage.setItem(key('vault-auto-lock-minutes'), '15');
      localStorage.setItem(key('session-timeout'), '60');
      const { result } = renderSettings();
      const before = current(result);
      blockWrites();

      let outcome: ReturnType<typeof applySecurityPreset> | undefined;
      act(() => { outcome = applySecurityPreset('stay-unlocked', targets(result, () => true)); });

      expect(outcome).toEqual({ ok: false, failed: 'remember-browser' });
      expect(result.current.vault.settings.rememberBrowser).toBe(false);
      expect(current(result)).toEqual(before);
      expect(localStorage.getItem(key('vault-remember-browser'))).toBeNull();
    });

    it('never turns it on when the keys cannot be persisted', () => {
      const { result } = renderSettings();

      let outcome: ReturnType<typeof applySecurityPreset> | undefined;
      act(() => { outcome = applySecurityPreset('stay-unlocked', targets(result, () => false)); });

      expect(outcome).toEqual({ ok: false, failed: 'remember-browser' });
      expect(result.current.vault.settings.rememberBrowser).toBe(false);
      expect(result.current.vault.settings.autoLockMinutes).toBe(0);
      expect(localStorage.getItem(key('vault-remember-browser'))).toBeNull();
      expect(localStorage.getItem(key('vault-persisted-keys'))).toBeNull();
    });

    it('still turns remembering off and tightens the lock for "Shared device"', () => {
      localStorage.setItem(key('vault-remember-browser'), 'true');
      const { result } = renderSettings();
      blockWrites();

      let outcome: ReturnType<typeof applySecurityPreset> | undefined;
      act(() => { outcome = applySecurityPreset('shared', targets(result)); });

      // Nothing could be stored, so the caller is told; the vault side applies in memory.
      expect(outcome).toEqual({ ok: false, failed: 'partial' });
      expect(result.current.vault.settings.rememberBrowser).toBe(false);
      expect(result.current.vault.settings.autoLockMinutes).toBe(15);
    });

    it('reports a partial save when only the auto-lock write fails', () => {
      localStorage.setItem(key('vault-auto-lock-minutes'), '0');
      const { result } = renderSettings();
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const real = vi.mocked(localStorage.setItem).getMockImplementation();
      vi.mocked(localStorage.setItem).mockImplementation((k: string, v: string) => {
        if (k === key('vault-auto-lock-minutes')) throw new DOMException('full', 'QuotaExceededError');
        real?.(k, v);
      });

      let outcome: ReturnType<typeof applySecurityPreset> | undefined;
      act(() => { outcome = applySecurityPreset('shared', targets(result)); });

      expect(outcome).toEqual({ ok: false, failed: 'partial' });
      // The rest still lands, and the stricter lock applies for this session.
      expect(result.current.vault.settings.autoLockMinutes).toBe(15);
      expect(localStorage.getItem(key('session-timeout'))).toBe('60');
    });
  });
});
