import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

export interface SessionSettings {
  /** Session timeout in minutes. null is "Never", which lasts 90 days from `neverSince`. */
  timeoutMinutes: number | null;
  /** When "Never" was chosen. Set only while the timeout is "Never". */
  neverSince: string | null;
}

export interface TimeoutOption {
  label: string;
  value: number | null;
}

/** Available timeout options */
export const TIMEOUT_OPTIONS: TimeoutOption[] = [
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '24 hours', value: 1440 },
  { label: '1 week', value: 10080 },
  { label: 'Never (for 90 days)', value: null },
];

/** Default timeout: 1 week */
export const DEFAULT_TIMEOUT_MINUTES = 10080;

/** "Never" lasts 90 days, then falls back to the default. */
const NEVER_TTL_DAYS = 90;

/**
 * Storage key suffixes (prefixed with userId).
 *
 * `trusted-device` and `trusted-at` are the names from when "Never" needed a separate
 * "trusted device" switch (removed in design critique PR 4, J3). They now record only
 * that "Never" was chosen, and when. The names are kept so an account that chose Never
 * before the upgrade keeps it, with the same 90-day end date, and nobody is signed out.
 */
const STORAGE_KEYS = {
  timeout: 'session-timeout',
  neverChosen: 'trusted-device',
  neverSince: 'trusted-at',
};

/** Generate storage key for a user */
const getStorageKey = (userId: string, key: string) => `yidhan-${userId}-${key}`;

/**
 * Check if "Never" has run out (> 90 days old). Fails closed: a missing, unreadable
 * or future timestamp counts as expired, so "Never" can never outlive its 90 days.
 * A few minutes of future skew is allowed, so a small clock correction does not
 * end a "Never" that was just chosen.
 */
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const isNeverExpired = (neverSince: string | null): boolean => {
  if (!neverSince) return true;
  const since = new Date(neverSince).getTime();
  const now = Date.now();
  if (Number.isNaN(since) || since > now + CLOCK_SKEW_MS) return true;
  return now > since + NEVER_TTL_DAYS * 24 * 60 * 60 * 1000;
};

/** Only the listed options are enforced. Anything else stored falls back to the default. */
const ALLOWED_FINITE_TIMEOUTS = new Set(
  TIMEOUT_OPTIONS.flatMap((option) => (option.value === null ? [] : [option.value]))
);

/** True when this user has stored a session timeout on this browser. Fails closed to true. */
export function hasStoredSessionTimeout(userId: string): boolean {
  try {
    return localStorage.getItem(getStorageKey(userId, STORAGE_KEYS.timeout)) !== null;
  } catch {
    return true;
  }
}

export interface UseSessionSettingsResult {
  /** Current session settings */
  settings: SessionSettings;
  /**
   * Choose a session timeout. Choosing "Never" starts its 90 days. Returns false,
   * and changes nothing, when the value is not an option or cannot be stored.
   */
  setTimeoutMinutes: (minutes: number | null) => boolean;
  /** The timeout to enforce: always the chosen one. */
  getEffectiveTimeout: () => number | null;
}

interface LoadSettingsResult {
  settings: SessionSettings;
  /** True if a stored "Never" had run out */
  neverExpired: boolean;
  /** True if storage holds values the settings above corrected */
  needsRepair: boolean;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn('[useSessionSettings] Failed to read session settings:', err);
    return null;
  }
}

/**
 * Read settings from localStorage for a given user. Pure: it never writes, so it is
 * safe to call during render. `repairStorage` writes the corrections afterwards.
 *
 * Upgrade from the trusted-device version: a timeout of Never needed trust, and trust
 * expired after 90 days. Here Never needs a "Never chosen" record that expires after
 * 90 days, read from the same keys, so every old combination enforces exactly what it
 * did before. With a finite timeout the old trust flag did nothing, so it is dropped.
 */
function loadSettingsFromStorage(userId: string | null): LoadSettingsResult {
  const defaults: SessionSettings = { timeoutMinutes: DEFAULT_TIMEOUT_MINUTES, neverSince: null };
  if (!userId) {
    return { settings: defaults, neverExpired: false, needsRepair: false };
  }

  const storedTimeout = readStorage(getStorageKey(userId, STORAGE_KEYS.timeout));
  const storedNeverChosen = readStorage(getStorageKey(userId, STORAGE_KEYS.neverChosen));
  const storedNeverSince = readStorage(getStorageKey(userId, STORAGE_KEYS.neverSince));
  const hasNeverRecord = storedNeverChosen !== null || storedNeverSince !== null;

  if (storedTimeout === 'null') {
    const neverValid = storedNeverChosen === 'true' && !isNeverExpired(storedNeverSince);
    if (neverValid) {
      return {
        settings: { timeoutMinutes: null, neverSince: storedNeverSince },
        neverExpired: false,
        needsRepair: false,
      };
    }
    // Never without a live record falls back to the default. Only an expired
    // record gets the notice: it is the one the reader chose and lost.
    return {
      settings: defaults,
      neverExpired: storedNeverChosen === 'true',
      needsRepair: true,
    };
  }

  // Parse timeout: exactly one of the listed options
  let timeoutMinutes = DEFAULT_TIMEOUT_MINUTES;
  let needsRepair = hasNeverRecord;
  if (storedTimeout !== null) {
    const parsed = Number(storedTimeout);
    if (ALLOWED_FINITE_TIMEOUTS.has(parsed)) {
      timeoutMinutes = parsed;
    } else {
      needsRepair = true;
    }
  }

  return {
    settings: { timeoutMinutes, neverSince: null },
    neverExpired: false,
    needsRepair,
  };
}

/**
 * Write the corrected settings back, so storage matches what the hook enforces.
 * Best effort: the corrected settings apply in memory either way, so a full or
 * blocked localStorage must not throw here. Removals run first to free space.
 */
function repairStorage(userId: string, settings: SessionSettings) {
  try {
    if (settings.timeoutMinutes !== null) {
      localStorage.removeItem(getStorageKey(userId, STORAGE_KEYS.neverChosen));
      localStorage.removeItem(getStorageKey(userId, STORAGE_KEYS.neverSince));
    }
    const timeoutKey = getStorageKey(userId, STORAGE_KEYS.timeout);
    const timeoutValue = settings.timeoutMinutes === null ? 'null' : String(settings.timeoutMinutes);
    if (localStorage.getItem(timeoutKey) !== timeoutValue) {
      localStorage.setItem(timeoutKey, timeoutValue);
    }
  } catch (err) {
    console.warn('[useSessionSettings] Failed to repair stored session settings:', err);
  }
}

/**
 * Hook for the session timeout: how long the app waits, idle, before signing out.
 *
 * Settings are stored per-user in localStorage to prevent cross-account leakage.
 * "Never" lasts 90 days, then falls back to 1 week with a notice.
 *
 * @param userId - Current user's ID (null if not logged in)
 */
export function useSessionSettings(userId: string | null): UseSessionSettingsResult {
  // Load once, on first render. Loading is pure; the effect below writes repairs.
  const [initialResult] = useState(() => loadSettingsFromStorage(userId));

  const [settings, setSettings] = useState<SessionSettings>(initialResult.settings);

  // Track previous userId to detect changes
  const prevUserIdRef = useRef(userId);
  // The first load's repair and expiry toast are still owed to the first effect.
  const initialPendingRef = useRef<LoadSettingsResult | null>(initialResult);

  // Sync settings when userId changes
  // This is intentional: syncing state with an external store (localStorage)
  // The pattern follows React docs for syncing with external systems
  useEffect(() => {
    let result = initialPendingRef.current;
    initialPendingRef.current = null;
    let nextSettings: SessionSettings | null = null;
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      result = loadSettingsFromStorage(userId);
      nextSettings = result.settings;
    }
    if (!result) return;

    if (userId && result.needsRepair) repairStorage(userId, result.settings);

    if (result.neverExpired) {
      toast('“Never sign out” has ended after 90 days. You’ll now be signed out after 1 week idle. You can choose Never again in Settings.', {
        duration: 6000,
        style: {
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--glass-border)',
        },
      });
    }

    if (nextSettings) setSettings(nextSettings);
  }, [userId]);

  const setTimeoutMinutes = useCallback((minutes: number | null): boolean => {
    if (!userId) return false;

    if (minutes !== null && !ALLOWED_FINITE_TIMEOUTS.has(minutes)) {
      console.warn(`Ignoring session timeout that is not an option: ${minutes}`);
      return false;
    }

    const timeoutKey = getStorageKey(userId, STORAGE_KEYS.timeout);
    const neverChosenKey = getStorageKey(userId, STORAGE_KEYS.neverChosen);
    const neverSinceKey = getStorageKey(userId, STORAGE_KEYS.neverSince);
    const neverSince = minutes === null ? new Date().toISOString() : null;

    try {
      if (minutes === null) {
        // The record goes first: a "null" timeout without it reads back as 1 week.
        localStorage.setItem(neverChosenKey, 'true');
        localStorage.setItem(neverSinceKey, neverSince as string);
        localStorage.setItem(timeoutKey, 'null');
      } else {
        // The timeout goes first: a failed write leaves the old choice whole.
        localStorage.setItem(timeoutKey, String(minutes));
        localStorage.removeItem(neverChosenKey);
        localStorage.removeItem(neverSinceKey);
      }
    } catch (err) {
      console.warn('[useSessionSettings] Failed to store session timeout:', err);
      return false;
    }

    setSettings({ timeoutMinutes: minutes, neverSince });
    return true;
  }, [userId]);

  const getEffectiveTimeout = useCallback((): number | null => {
    // Never applies only with its start date; the loader guarantees one.
    if (settings.timeoutMinutes === null && !settings.neverSince) return DEFAULT_TIMEOUT_MINUTES;
    return settings.timeoutMinutes;
  }, [settings.neverSince, settings.timeoutMinutes]);

  return {
    settings,
    setTimeoutMinutes,
    getEffectiveTimeout,
  };
}
