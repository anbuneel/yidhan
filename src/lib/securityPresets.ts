/**
 * The "On this device" presets in Settings → Security (design critique PR 4, J1 and J2).
 *
 * A preset is a name for one combination of three existing settings: vault auto-lock,
 * "Remember this browser" and the session timeout. Nothing new is stored. The preset
 * shown is read back from the stored settings, so an existing reader lands on the
 * matching preset, or on Custom, and the upgrade changes nothing.
 */

import type { AutoLockMinutes } from '../hooks/useVaultSettings';

export type SecurityPresetId = 'shared' | 'personal' | 'stay-unlocked';
export type SecurityPresetChoice = SecurityPresetId | 'custom';

export interface DeviceSecuritySettings {
  autoLockMinutes: AutoLockMinutes;
  rememberBrowser: boolean;
  /** Session timeout in minutes. null is "Never". */
  timeoutMinutes: number | null;
}

export interface SecurityPreset {
  id: SecurityPresetId;
  label: string;
  description: string;
  settings: DeviceSecuritySettings;
}

const WEEK_MINUTES = 10080;

/**
 * Every value here must be one the settings hooks accept: auto-lock 0, 15 or 60;
 * timeout one of `TIMEOUT_OPTIONS`. The draft gave "Stay unlocked" a 90-day timeout.
 * That is not an option, and a browser timer cannot hold more than about 24 days, so
 * it uses 1 week, the longest timeout that still ends on its own.
 */
export const SECURITY_PRESETS: readonly SecurityPreset[] = [
  {
    id: 'shared',
    label: 'Shared device',
    description: 'Locks after 15 minutes idle. Signs you out after 1 hour idle. Nothing stays after you close the tab.',
    settings: { autoLockMinutes: 15, rememberBrowser: false, timeoutMinutes: 60 },
  },
  {
    id: 'personal',
    label: 'My device',
    description: 'Locks after 1 hour idle. Signs you out after 1 week idle. You enter your passphrase again after closing the tab.',
    settings: { autoLockMinutes: 60, rememberBrowser: false, timeoutMinutes: WEEK_MINUTES },
  },
  {
    id: 'stay-unlocked',
    label: 'Stay unlocked',
    description: 'Never locks on its own and stays unlocked after you close the browser. Signs you out after 1 week idle. Only for a device no one else uses.',
    settings: { autoLockMinutes: 0, rememberBrowser: true, timeoutMinutes: WEEK_MINUTES },
  },
];

/** The preset new accounts start on. */
export const DEFAULT_SECURITY_PRESET: SecurityPresetId = 'personal';

export function getSecurityPreset(id: SecurityPresetId): SecurityPreset {
  const preset = SECURITY_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown security preset: ${id}`);
  return preset;
}

/** The preset these settings match exactly, or 'custom'. */
export function presetForSettings(settings: DeviceSecuritySettings): SecurityPresetChoice {
  const match = SECURITY_PRESETS.find((p) =>
    p.settings.autoLockMinutes === settings.autoLockMinutes
    && p.settings.rememberBrowser === settings.rememberBrowser
    && p.settings.timeoutMinutes === settings.timeoutMinutes,
  );
  return match ? match.id : 'custom';
}

/** The settings a preset stands for. A copy, so callers cannot change the table. */
export function settingsForPreset(id: SecurityPresetId): DeviceSecuritySettings {
  return { ...getSecurityPreset(id).settings };
}

export interface SecurityPresetTargets {
  setAutoLockMinutes: (minutes: AutoLockMinutes) => void;
  /** Returns false when the choice could not be stored. Must fail closed. */
  setRememberBrowser: (enabled: boolean, options?: { persistKeys?: () => boolean }) => boolean;
  /** Returns false when the choice could not be stored. */
  setTimeoutMinutes: (minutes: number | null) => boolean;
  /** Writes the unlocked keys to localStorage. Only passed while the vault is unlocked. */
  persistKeys?: () => boolean;
}

export type ApplyPresetResult =
  | { ok: true }
  | { ok: false; failed: 'remember-browser' | 'timeout' };

/**
 * Apply a preset. "Remember this browser" goes first: when it cannot be turned on
 * (localStorage blocked or full), nothing else changes, so the reader is never left
 * on a looser auto-lock with nothing remembered. Turning it off always lands, because
 * `setRememberBrowser(false)` drops the setting in memory even when storage fails.
 */
export function applySecurityPreset(id: SecurityPresetId, targets: SecurityPresetTargets): ApplyPresetResult {
  const next = settingsForPreset(id);

  const remembered = targets.setRememberBrowser(next.rememberBrowser, {
    persistKeys: next.rememberBrowser ? targets.persistKeys : undefined,
  });
  if (next.rememberBrowser && !remembered) {
    return { ok: false, failed: 'remember-browser' };
  }

  targets.setAutoLockMinutes(next.autoLockMinutes);
  if (!targets.setTimeoutMinutes(next.timeoutMinutes)) {
    return { ok: false, failed: 'timeout' };
  }
  return { ok: true };
}
