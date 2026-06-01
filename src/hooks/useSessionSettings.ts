import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';

export interface SessionSettings {
  /** Session timeout in minutes (null = never, only available when trusted device is on) */
  timeoutMinutes: number | null;
  /** Whether this device is marked as trusted */
  isTrustedDevice: boolean;
  /** Timestamp when device was trusted (for 90-day TTL) */
  trustedAt: string | null;
}

export interface TimeoutOption {
  label: string;
  value: number | null;
  requiresTrustedDevice?: boolean;
}

/** Available timeout options */
export const TIMEOUT_OPTIONS: TimeoutOption[] = [
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '24 hours', value: 1440 },
  { label: '1 week', value: 10080 },
  { label: 'Never', value: null, requiresTrustedDevice: true },
];

/** Default timeout: 1 week */
const DEFAULT_TIMEOUT_MINUTES = 10080;

/** Trusted device extends timeout to 14 days */
const TRUSTED_DEVICE_TIMEOUT_MINUTES = 20160;

/** Trusted device TTL: 90 days */
const TRUST_TTL_DAYS = 90;

/** Storage key suffixes (prefixed with userId) */
const STORAGE_KEYS = {
  timeout: 'session-timeout',
  trustedDevice: 'trusted-device',
  trustedAt: 'trusted-at',
};

/** Generate storage key for a user */
const getStorageKey = (userId: string, key: string) => `yidhan-${userId}-${key}`;

/** Check if trust has expired (> 90 days old) */
const isTrustExpired = (trustedAt: string | null): boolean => {
  if (!trustedAt) return true;
  const trustedDate = new Date(trustedAt);
  const expiryDate = new Date(trustedDate.getTime() + TRUST_TTL_DAYS * 24 * 60 * 60 * 1000);
  return new Date() > expiryDate;
};

export interface UseSessionSettingsResult {
  /** Current session settings */
  settings: SessionSettings;
  /** Update session timeout preference */
  setTimeoutMinutes: (minutes: number | null) => void;
  /** Enable trusted device (starts 90-day TTL) */
  enableTrustedDevice: () => void;
  /** Disable trusted device */
  disableTrustedDevice: () => void;
  /** Toggle trusted device status */
  toggleTrustedDevice: () => void;
  /** Get effective timeout (considering trusted device extends to 14 days) */
  getEffectiveTimeout: () => number | null;
  /** Available timeout options (filtered by trusted device status) */
  availableTimeoutOptions: TimeoutOption[];
}

/**
 * Hook for managing session timeout and trusted device settings.
 *
 * Settings are stored per-user in localStorage to prevent cross-account leakage.
 * Trusted device status expires after 90 days.
 *
 * @param userId - Current user's ID (null if not logged in)
 */
interface LoadSettingsResult {
  settings: SessionSettings;
  /** True if trusted device status was expired and cleared during load */
  trustExpired: boolean;
}

/** Load settings from localStorage for a given user */
function loadSettingsFromStorage(userId: string | null): LoadSettingsResult {
  if (!userId) {
    return {
      settings: {
        timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
        isTrustedDevice: false,
        trustedAt: null,
      },
      trustExpired: false,
    };
  }

  // Load stored settings
  const storedTimeout = localStorage.getItem(getStorageKey(userId, STORAGE_KEYS.timeout));
  const storedTrusted = localStorage.getItem(getStorageKey(userId, STORAGE_KEYS.trustedDevice));
  const storedTrustedAt = localStorage.getItem(getStorageKey(userId, STORAGE_KEYS.trustedAt));

  // Parse timeout (could be number or 'null' string for "never")
  let timeoutMinutes: number | null = DEFAULT_TIMEOUT_MINUTES;
  if (storedTimeout !== null) {
    timeoutMinutes = storedTimeout === 'null' ? null : parseInt(storedTimeout, 10);
    // Fix: proper null guard for NaN check
    if (timeoutMinutes !== null && isNaN(timeoutMinutes)) {
      timeoutMinutes = DEFAULT_TIMEOUT_MINUTES;
    }
  }

  // Parse trusted device status
  let isTrustedDevice = storedTrusted === 'true';
  let trustedAt = storedTrustedAt;
  let trustExpired = false;

  // Check if trust has expired (90-day TTL) - detect BEFORE clearing
  if (isTrustedDevice && isTrustExpired(trustedAt)) {
    trustExpired = true;
    // Trust has expired - clear it
    isTrustedDevice = false;
    trustedAt = null;
    localStorage.removeItem(getStorageKey(userId, STORAGE_KEYS.trustedDevice));
    localStorage.removeItem(getStorageKey(userId, STORAGE_KEYS.trustedAt));

    // If timeout was "never", revert to default
    if (timeoutMinutes === null) {
      timeoutMinutes = DEFAULT_TIMEOUT_MINUTES;
      localStorage.setItem(getStorageKey(userId, STORAGE_KEYS.timeout), String(timeoutMinutes));
    }
  }

  return {
    settings: {
      timeoutMinutes,
      isTrustedDevice,
      trustedAt,
    },
    trustExpired,
  };
}

export function useSessionSettings(userId: string | null): UseSessionSettingsResult {
  // Use useMemo to compute initial settings synchronously
  const initialResult = useMemo(() => loadSettingsFromStorage(userId), [userId]);

  const [settings, setSettings] = useState<SessionSettings>(initialResult.settings);

  // Track previous userId to detect changes
  const prevUserIdRef = useRef(userId);

  // Sync settings when userId changes
  // This is intentional: syncing state with an external store (localStorage)
  // The pattern follows React docs for syncing with external systems
  useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      const result = loadSettingsFromStorage(userId);

      // Show toast if trust expired (detected before keys were cleared)
      if (result.trustExpired) {
        toast('Your trusted device status has expired. Please re-enable in Settings if this is still your personal device.', {
          duration: 6000,
          style: {
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--glass-border)',
          },
        });
      }

      setSettings(result.settings);
    }
  }, [userId]);

  const setTimeoutMinutes = useCallback((minutes: number | null) => {
    if (!userId) return;

    // "Never" requires trusted device
    if (minutes === null && !settings.isTrustedDevice) {
      console.warn('Cannot set timeout to "never" without trusted device enabled');
      return;
    }

    localStorage.setItem(
      getStorageKey(userId, STORAGE_KEYS.timeout),
      minutes === null ? 'null' : String(minutes)
    );

    setSettings((prev) => ({ ...prev, timeoutMinutes: minutes }));
  }, [userId, settings.isTrustedDevice]);

  const enableTrustedDevice = useCallback(() => {
    if (!userId) return;

    const now = new Date().toISOString();
    localStorage.setItem(getStorageKey(userId, STORAGE_KEYS.trustedDevice), 'true');
    localStorage.setItem(getStorageKey(userId, STORAGE_KEYS.trustedAt), now);

    setSettings((prev) => ({
      ...prev,
      isTrustedDevice: true,
      trustedAt: now,
    }));
  }, [userId]);

  const disableTrustedDevice = useCallback(() => {
    if (!userId) return;

    localStorage.removeItem(getStorageKey(userId, STORAGE_KEYS.trustedDevice));
    localStorage.removeItem(getStorageKey(userId, STORAGE_KEYS.trustedAt));

    // If timeout was "never", revert to default
    const revertTimeout = settings.timeoutMinutes === null;
    if (revertTimeout) {
      localStorage.setItem(getStorageKey(userId, STORAGE_KEYS.timeout), String(DEFAULT_TIMEOUT_MINUTES));
    }

    setSettings((prev) => ({
      ...prev,
      isTrustedDevice: false,
      trustedAt: null,
      timeoutMinutes: revertTimeout ? DEFAULT_TIMEOUT_MINUTES : prev.timeoutMinutes,
    }));
  }, [userId, settings.timeoutMinutes]);

  const toggleTrustedDevice = useCallback(() => {
    if (settings.isTrustedDevice) {
      disableTrustedDevice();
    } else {
      enableTrustedDevice();
    }
  }, [settings.isTrustedDevice, enableTrustedDevice, disableTrustedDevice]);

  const getEffectiveTimeout = useCallback((): number | null => {
    // Trusted device extends timeout to 14 days (unless user explicitly set "never")
    if (settings.isTrustedDevice) {
      // If user set "never", respect that
      if (settings.timeoutMinutes === null) {
        return null;
      }
      // Otherwise, extend to 14 days
      return TRUSTED_DEVICE_TIMEOUT_MINUTES;
    }

    // Non-trusted device uses user setting (or default)
    return settings.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES;
  }, [settings.isTrustedDevice, settings.timeoutMinutes]);

  // Filter timeout options based on trusted device status
  const availableTimeoutOptions = useMemo(
    () => TIMEOUT_OPTIONS.filter(
      (option) => !option.requiresTrustedDevice || settings.isTrustedDevice
    ),
    [settings.isTrustedDevice]
  );

  return {
    settings,
    setTimeoutMinutes,
    enableTrustedDevice,
    disableTrustedDevice,
    toggleTrustedDevice,
    getEffectiveTimeout,
    availableTimeoutOptions,
  };
}

/**
 * Utility to set trusted device during login (before hook is fully initialized)
 */
export function setTrustedDeviceOnLogin(userId: string) {
  const now = new Date().toISOString();
  localStorage.setItem(getStorageKey(userId, STORAGE_KEYS.trustedDevice), 'true');
  localStorage.setItem(getStorageKey(userId, STORAGE_KEYS.trustedAt), now);
}
