import { Logo } from './Logo';

/**
 * Shown when this build needs a migration the database has not had applied (item 36).
 *
 * The alternative — which is what happened before this screen existed — is that every
 * write fails RLS, blocks in the sync queue, and the reader is told nothing. So this
 * says three things plainly: nothing is lost, nothing new can be written yet, and it
 * is not something they can fix.
 */
export interface DatabaseUpdatePendingProps {
  /** The migration level the database is actually at. */
  appliedVersion: number;
  /** The level this build needs. */
  requiredVersion: number;
  onRetry: () => void;
  isRetrying: boolean;
}

export function DatabaseUpdatePending({
  appliedVersion,
  requiredVersion,
  onRetry,
  isRetrying,
}: DatabaseUpdatePendingProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'var(--color-bg-primary)' }}
      data-testid="database-update-pending"
    >
      <Logo className="mb-12 opacity-40" />

      <h1
        className="text-3xl md:text-4xl mb-4"
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--color-text-primary)',
          fontWeight: 300,
        }}
      >
        A database update is pending.
      </h1>

      <p
        className="mb-3 text-lg max-w-md"
        style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
      >
        This version of Yidhan is newer than the database it syncs with, so it is
        holding off on writing anything until they match.
      </p>

      <p
        className="mb-8 max-w-md"
        style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
      >
        Your notes are safe and unchanged. Nothing has been lost, and nothing you write
        now would reach them — so it is better to wait a few minutes and try again.
      </p>

      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="focus-ring bg-transparent border-none text-base cursor-pointer underline underline-offset-4 disabled:cursor-default"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-accent)',
          opacity: isRetrying ? 0.5 : 1,
        }}
      >
        {isRetrying ? 'Checking…' : 'Check again'}
      </button>

      <p
        className="mt-10 text-xs"
        style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-tertiary)' }}
      >
        Database at version {appliedVersion} · this version needs {requiredVersion}
      </p>
    </div>
  );
}
