import { useState, useCallback } from 'react';

export interface VaultSettings {
  autoLockMinutes: 0 | 15 | 60;
  rememberBrowser: boolean;
}

export interface UseVaultSettingsResult {
  settings: VaultSettings;
  setAutoLockMinutes: (minutes: 0 | 15 | 60) => void;
  setRememberBrowser: (enabled: boolean) => void;
}

const DEFAULTS: VaultSettings = {
  autoLockMinutes: 0,
  rememberBrowser: false,
};

function storageKey(userId: string, key: string): string {
  return `yidhan-${userId}-vault-${key}`;
}

const VALID_AUTO_LOCK = [0, 15, 60] as const;

function parseAutoLockMinutes(value: string | null): 0 | 15 | 60 {
  if (!value) return DEFAULTS.autoLockMinutes;
  const parsed = parseInt(value, 10);
  return VALID_AUTO_LOCK.includes(parsed as 0 | 15 | 60)
    ? (parsed as 0 | 15 | 60)
    : DEFAULTS.autoLockMinutes;
}

function loadSettings(userId: string): VaultSettings {
  try {
    return {
      autoLockMinutes: parseAutoLockMinutes(localStorage.getItem(storageKey(userId, 'auto-lock-minutes'))),
      rememberBrowser: localStorage.getItem(storageKey(userId, 'remember-browser')) === 'true',
    };
  } catch (err) {
    console.warn('[useVaultSettings] Failed to load vault settings, using defaults:', err);
    return DEFAULTS;
  }
}

/**
 * Per-user vault settings stored in localStorage.
 * Separate from auth session settings (useSessionSettings).
 */
export function useVaultSettings(userId: string | null): UseVaultSettingsResult {
  const [settings, setSettings] = useState<VaultSettings>(() =>
    userId ? loadSettings(userId) : DEFAULTS
  );

  // Re-read settings when userId changes (adjusting state during render pattern)
  const [prevUserId, setPrevUserId] = useState<string | null>(userId);
  if (prevUserId !== userId) {
    setPrevUserId(userId);
    setSettings(userId ? loadSettings(userId) : DEFAULTS);
  }

  const setAutoLockMinutes = useCallback((minutes: 0 | 15 | 60) => {
    setSettings((prev) => ({ ...prev, autoLockMinutes: minutes }));
    if (userId) {
      try {
        localStorage.setItem(storageKey(userId, 'auto-lock-minutes'), String(minutes));
      } catch (err) { console.warn('[useVaultSettings] Failed to persist auto-lock setting:', err); }
    }
  }, [userId]);

  const setRememberBrowser = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, rememberBrowser: enabled }));
    if (userId) {
      try {
        localStorage.setItem(storageKey(userId, 'remember-browser'), String(enabled));
        // When disabling, immediately clear any persisted vault keys
        if (!enabled) {
          localStorage.removeItem(`yidhan-${userId}-vault-persisted-keys`);
        }
      } catch (err) { console.warn('[useVaultSettings] Failed to persist remember-browser setting:', err); }
    }
  }, [userId]);

  return { settings, setAutoLockMinutes, setRememberBrowser };
}
