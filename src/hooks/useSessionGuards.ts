/**
 * The two timers that can close the vault: the session timeout, which signs the reader
 * out, and the auto-lock, which only locks.
 *
 * They are separate on purpose. Auto-lock preserves a remembered device so the reader
 * can unlock silently; a sign-out clears it — see the lock-reason rule in `CLAUDE.md`.
 */

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { hasStoredSessionTimeout, useSessionSettings } from './useSessionSettings';
import { useSessionTimeout } from './useSessionTimeout';
import { hasStoredVaultSettings, useVaultSettings } from './useVaultSettings';
import { useIdleTimer } from './useIdleTimer';
import { applySecurityPreset, DEFAULT_SECURITY_PRESET } from '../lib/securityPresets';

export interface UseSessionGuardsOptions {
  userId: string | undefined;
  isEncryptionSetup: boolean;
  isUnlocked: boolean;
  /** The new-account setup screen is open. A new account starts on the default preset. */
  isAccountSetup?: boolean;
  lockVault: (reason: 'auto-lock' | 'manual' | 'sign-out') => void;
  signOut: () => Promise<void>;
}

export interface SessionGuards {
  sessionSettings: ReturnType<typeof useSessionSettings>;
  vaultSettings: ReturnType<typeof useVaultSettings>;
  showSessionTimeoutModal: boolean;
  sessionMinutesRemaining: number | null;
  handleSessionStay: () => void;
  handleSessionSignOut: () => Promise<void>;
}

export function useSessionGuards({
  userId,
  isEncryptionSetup,
  isUnlocked,
  isAccountSetup = false,
  lockVault,
  signOut,
}: UseSessionGuardsOptions): SessionGuards {
  const [showSessionTimeoutModal, setShowSessionTimeoutModal] = useState(false);

  // Session settings (timeout + trusted device, per-user)
  const sessionSettings = useSessionSettings(userId ?? null);
  const effectiveTimeout = sessionSettings.getEffectiveTimeout();

  // Session timeout monitoring (configurable timeout, 5 min warning)
  const { resetTimeout: resetSessionTimeout, minutesRemaining: sessionMinutesRemaining } = useSessionTimeout({
    timeoutMinutes: effectiveTimeout,
    warningMinutes: effectiveTimeout === null ? 0 : Math.min(5, Math.floor(effectiveTimeout / 6)),
    onWarning: () => setShowSessionTimeoutModal(true),
    onTimeout: async () => {
      setShowSessionTimeoutModal(false);
      lockVault('sign-out');
      await signOut();
      toast('Your session has faded. Please sign in again.', {
        icon: '〇',
        duration: 4000,
        style: {
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--glass-border)',
        },
      });
    },
    enabled: Boolean(userId),
  });

  // Vault settings (auto-lock, per-user)
  const vaultSettings = useVaultSettings(userId ?? null);

  // Vault auto-lock timer (separate from session timeout)
  useIdleTimer({
    minutes: vaultSettings.settings.autoLockMinutes,
    onIdle: () => {
      lockVault('auto-lock');
      toast('Vault locked after inactivity', {
        icon: '🔒',
        duration: 3000,
        style: {
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--glass-border)',
        },
      });
    },
    enabled: Boolean(userId) && isEncryptionSetup && isUnlocked,
  });

  // A new account starts on "My device" (J1). Only when nothing is stored on this
  // browser for the account, so an existing reader's choices never change, and once.
  const defaultAppliedForRef = useRef<string | null>(null);
  const { setAutoLockMinutes, setRememberBrowser } = vaultSettings;
  const { setTimeoutMinutes } = sessionSettings;
  useEffect(() => {
    if (!isAccountSetup || !userId || defaultAppliedForRef.current === userId) return;
    defaultAppliedForRef.current = userId;
    if (hasStoredVaultSettings(userId) || hasStoredSessionTimeout(userId)) return;
    applySecurityPreset(DEFAULT_SECURITY_PRESET, { setAutoLockMinutes, setRememberBrowser, setTimeoutMinutes });
  }, [isAccountSetup, userId, setAutoLockMinutes, setRememberBrowser, setTimeoutMinutes]);

  // Handle session timeout modal actions
  const handleSessionStay = () => {
    resetSessionTimeout();
    setShowSessionTimeoutModal(false);
    toast.success('Session extended', { duration: 2000 });
  };

  const handleSessionSignOut = async () => {
    setShowSessionTimeoutModal(false);
    lockVault('sign-out');
    await signOut();
  };

  return {
    sessionSettings,
    vaultSettings,
    showSessionTimeoutModal,
    sessionMinutesRemaining,
    handleSessionStay,
    handleSessionSignOut,
  };
}
