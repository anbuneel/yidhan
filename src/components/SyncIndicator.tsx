/**
 * Sync Indicator
 *
 * Subtle indicator showing offline/sync status.
 * Follows "invisible when working" philosophy:
 * - Synced: No indicator (zen - absence is peace)
 * - Offline: Cloud icon with X
 * - Stuck pending (30s+): Ink dot with count
 * - Blocked: Manual retry needed
 * - Normal pending (<30s): No indicator (sync is invisible)
 *
 * One honest exception to the quiet: when the browser has declined persistent
 * storage and there is unsynced work, that work exists only in evictable
 * browser storage. The indicator says so, and offers Install — Chrome grants
 * persistence to installed apps without asking.
 */

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useStoragePersistence } from '../hooks/useStoragePersistence';
import { claimAtRiskNotice } from '../utils/storagePersistence';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

interface SyncIndicatorProps {
  onRetryBlockedChanges?: () => Promise<void>;
  isRetryingBlockedChanges?: boolean;
}

// Same phrasing as the caption, toast and accessible label: "on this device".
const AT_RISK_EXPLANATION =
  'These changes are kept only on this device until they sync, and the browser may clear its storage. Installing Yidhan keeps them safe.';

const captionStyle = {
  color: 'var(--color-text-tertiary)',
  fontFamily: 'var(--font-body)',
} as const;

interface AtRiskCaptionProps {
  installable: boolean;
  /** iOS Safari never fires beforeinstallprompt; installing is a manual Share → Add to Home Screen. */
  iosHint: boolean;
  onInstall: () => void;
}

function AtRiskCaption({ installable, iosHint, onInstall }: AtRiskCaptionProps) {
  return (
    <span className="flex items-center gap-1.5" title={AT_RISK_EXPLANATION}>
      <span className="text-[11px]" style={captionStyle}>
        · on this device only
      </span>
      {!installable && iosHint && (
        <span className="text-[11px] font-medium" style={{ ...captionStyle, color: 'var(--color-accent)' }}>
          Add to Home Screen to protect
        </span>
      )}
      {installable && (
        <button
          type="button"
          onClick={onInstall}
          className="text-[11px] font-medium"
          style={{
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-body)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Install to protect
        </button>
      )}
    </span>
  );
}

export function SyncIndicator({
  onRetryBlockedChanges,
  isRetryingBlockedChanges = false,
}: SyncIndicatorProps) {
  const { isOnline, pendingCount, blockedCount, blockedReason, isStuck, refresh } = useSyncStatus();
  const { isDenied: storageDenied } = useStoragePersistence();
  const { isInstallable, canInstallOnIOS, triggerInstall } = useInstallPrompt();
  const [isRetryingLocal, setIsRetryingLocal] = useState(false);
  const isRetrying = isRetryingBlockedChanges || isRetryingLocal;

  // Unsynced work that has been local-only for a while, in storage the
  // browser has said it may clear. Normal sub-30s pending is not flagged —
  // that would flash a warning on every keystroke.
  const hasLingeringWork = blockedCount > 0 || (isStuck && pendingCount > 0);
  const atRisk = storageDenied && hasLingeringWork;

  // Say it once per session on entering the at-risk state, then let the
  // caption in the pill carry it quietly. The claim is session-scoped (see
  // claimAtRiskNotice) because this component unmounts on every view change.
  useEffect(() => {
    if (!atRisk || !claimAtRiskNotice()) return;
    toast('Unsynced notes are kept only on this device. Installing Yidhan keeps them safe if the browser clears storage.', {
      id: 'storage-at-risk',
      icon: '\u26A0\uFE0F',
      duration: 7000,
      style: {
        background: 'var(--color-bg-secondary)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--glass-border)',
      },
    });
  }, [atRisk]);

  const withRisk = (label: string) =>
    atRisk ? `${label}. These changes are kept only on this device` : label;

  const handleRetryBlockedChanges = async () => {
    if (!onRetryBlockedChanges || !isOnline || isRetrying) {
      return;
    }

    setIsRetryingLocal(true);
    try {
      await onRetryBlockedChanges();
      await refresh();
    } finally {
      setIsRetryingLocal(false);
    }
  };

  // Zen philosophy: when all is well, show nothing
  if (pendingCount === 0 && blockedCount === 0 && isOnline) {
    return null;
  }

  if (blockedCount > 0) {
    const label = blockedReason
      ? `${blockedCount} change${blockedCount === 1 ? '' : 's'} blocked: ${blockedReason}`
      : `${blockedCount} change${blockedCount === 1 ? '' : 's'} blocked and awaiting retry`;

    return (
      <output
        className="flex items-center gap-2 px-2 py-1 rounded-md"
        style={{
          background: 'var(--color-bg-tertiary)',
        }}
        aria-live="polite"
        aria-label={withRisk(label)}
        title={blockedReason ?? undefined}
      >
        <span
          className="size-2 rounded-full"
          style={{ background: 'var(--color-destructive)' }}
          aria-hidden="true"
        />
        <span
          className="text-xs font-medium"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          {blockedCount} blocked
        </span>
        {isOnline && onRetryBlockedChanges ? (
          <button
            type="button"
            onClick={handleRetryBlockedChanges}
            disabled={isRetrying}
            className="text-xs font-medium transition-opacity"
            style={{
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-body)',
              background: 'transparent',
              border: 'none',
              cursor: isRetrying ? 'wait' : 'pointer',
              opacity: isRetrying ? 0.6 : 1,
            }}
          >
            {isRetrying ? 'Retrying...' : 'Retry blocked changes'}
          </button>
        ) : (
          <span className="text-[11px]" style={captionStyle}>
            Reconnect to retry
          </span>
        )}
        {atRisk && <AtRiskCaption installable={isInstallable} iosHint={canInstallOnIOS} onInstall={triggerInstall} />}
      </output>
    );
  }

  // Offline state
  if (!isOnline) {
    return (
      <output
        className="flex items-center gap-1.5 px-2 py-1 rounded-md"
        style={{
          background: 'var(--color-bg-tertiary)',
        }}
        aria-live="polite"
        aria-label={withRisk('Offline - changes saved locally')}
      >
        <svg
          className="size-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          {/* Cloud with X */}
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 15a4 4 0 004 4h9a5 5 0 10-5-5 4 4 0 00-8 1z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M18.5 5.5l-3 3m0-3l3 3"
          />
        </svg>
        <span
          className="text-xs font-medium"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          Offline
        </span>
        {atRisk && <AtRiskCaption installable={isInstallable} iosHint={canInstallOnIOS} onInstall={triggerInstall} />}
      </output>
    );
  }

  // Pending changes — only shown when stuck (30s+ without syncing)
  if (isStuck && pendingCount > 0) {
    return (
      <output
        className="flex items-center gap-1.5 px-2 py-1 rounded-md"
        style={{
          background: 'var(--color-bg-tertiary)',
        }}
        aria-live="polite"
        aria-label={withRisk(`${pendingCount} change${pendingCount === 1 ? '' : 's'} pending sync`)}
      >
        {/* Ink dot */}
        <span
          className="size-2 rounded-full animate-pulse"
          style={{ background: 'var(--color-accent)' }}
          aria-hidden="true"
        />
        <span
          className="text-xs font-medium"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          {pendingCount} pending
        </span>
        {atRisk && <AtRiskCaption installable={isInstallable} iosHint={canInstallOnIOS} onInstall={triggerInstall} />}
      </output>
    );
  }

  return null;
}
