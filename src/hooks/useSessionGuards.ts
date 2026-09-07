/**
 * The two timers that can close the vault: the session timeout, which signs the reader
 * out, and the auto-lock, which only locks.
 *
 * They are separate on purpose. Auto-lock preserves a remembered device so the reader
 * can unlock silently; a sign-out clears it — see the lock-reason rule in `CLAUDE.md`.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useSessionSettings } from './useSessionSettings';
import { useSessionTimeout } from './useSessionTimeout';
import { useVaultSettings } from './useVaultSettings';
import { useIdleTimer } from './useIdleTimer';

export interface UseSessionGuardsOptions {
  userId: string | undefined;
  isEncryptionSetup: boolean;
  isUnlocked: boolean;
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
