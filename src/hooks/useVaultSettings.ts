import { useState, useCallback } from 'react';

const VALID_AUTO_LOCK = [0, 15, 60] as const;
type AutoLockMinutes = (typeof VALID_AUTO_LOCK)[number];

export interface VaultSettings {
  autoLockMinutes: AutoLockMinutes;
  rememberBrowser: boolean;
}

export interface UseVaultSettingsResult {
  settings: VaultSettings;
  setAutoLockMinutes: (minutes: AutoLockMinutes) => void;
  setRememberBrowser: (
    enabled: boolean,
    options?: { persistKeys?: () => boolean }
  ) => boolean;
}

const DEFAULTS: VaultSettings = {
  autoLockMinutes: 0,
  rememberBrowser: false,
};

function storageKey(userId: string, key: string): string {
  return `yidhan-${userId}-vault-${key}`;
}

function parseAutoLockMinutes(value: string | null): AutoLockMinutes {
  if (!value) return DEFAULTS.autoLockMinutes;
  const parsed = parseInt(value, 10);
  return VALID_AUTO_LOCK.includes(parsed as AutoLockMinutes)
    ? (parsed as AutoLockMinutes)
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

  const setAutoLockMinutes = useCallback((minutes: AutoLockMinutes) => {
    setSettings((prev) => ({ ...prev, autoLockMinutes: minutes }));
    if (userId) {
      try {
        localStorage.setItem(storageKey(userId, 'auto-lock-minutes'), String(minutes));
      } catch (err) { console.warn('[useVaultSettings] Failed to persist auto-lock setting:', err); }
    }
  }, [userId]);

  const setRememberBrowser = useCallback((
    enabled: boolean,
    options?: { persistKeys?: () => boolean }
  ): boolean => {
    const persistKeys = options?.persistKeys;

    if (!userId) {
      if (enabled && persistKeys && !persistKeys()) {
        return false;
      }

      setSettings((prev) => ({ ...prev, rememberBrowser: enabled }));
      return true;
    }

    const rememberKey = storageKey(userId, 'remember-browser');
    const persistedKeysKey = storageKey(userId, 'persisted-keys');

    try {
      localStorage.setItem(rememberKey, String(enabled));

      if (enabled) {
        if (persistKeys && !persistKeys()) {
          localStorage.removeItem(rememberKey);
          localStorage.removeItem(persistedKeysKey);
          return false;
        }
      } else {
        localStorage.removeItem(persistedKeysKey);
      }

      setSettings((prev) => ({ ...prev, rememberBrowser: enabled }));
      return true;
    } catch (err) {
      console.warn('[useVaultSettings] Failed to persist remember-browser setting:', err);

      try {
        localStorage.removeItem(rememberKey);
        if (enabled) {
          localStorage.removeItem(persistedKeysKey);
        }
      } catch {
        // Best-effort cleanup after a failed write.
      }

      return false;
    }
  }, [userId]);

  return { settings, setAutoLockMinutes, setRememberBrowser };
}
