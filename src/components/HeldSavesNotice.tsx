import { useState } from 'react';
import type { HeldSave } from '../stores/heldSaves';

export interface HeldSavesNoticeProps {
  entries: readonly HeldSave[];
  onRetry: (key: string) => Promise<void>;
  /** Resolves true when the words reached the clipboard. */
  onCopy: (key: string) => Promise<boolean>;
  /** "Lock now" was held back because of these entries. */
  lockBlocked?: boolean;
  onLockAnyway?: () => void;
}

const buttonBase = 'rounded-[var(--radius-button)] px-3 py-1.5 text-sm font-medium transition-all duration-200';

/**
 * Words from a note the writer has left whose save failed (issue #288). Shown on the
 * library and the editor, above the editor's own "Not saved" banner, until Retry or
 * Copy deals with each one.
 */
export function HeldSavesNotice({ entries, onRetry, onCopy, lockBlocked = false, onLockAnyway }: HeldSavesNoticeProps) {
  const [copyFailedKey, setCopyFailedKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  if (entries.length === 0 && !lockBlocked) return null;

  return (
    <div
      role="alert"
      data-testid="held-saves-notice"
      className="fixed bottom-36 left-4 right-4 z-50 mx-auto flex max-w-md flex-col gap-3 rounded-[var(--radius-plain)] border border-[var(--color-error)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-primary)]"
    >
      {lockBlocked && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="mr-auto basis-full">
            {entries.length > 0
              ? 'Your notes are still unlocked. These words are not saved yet.'
              : 'Your notes are still unlocked. Some words are still being saved.'}
          </span>
          <button type="button" onClick={onLockAnyway} className={buttonBase}
            style={{ fontFamily: 'var(--font-body)', color: 'var(--color-destructive-text)', background: 'var(--color-destructive)' }}>Lock anyway</button>
        </div>
      )}
      {entries.map((entry) => (
        <div key={entry.key} className="flex flex-wrap items-center gap-3">
          <span className="mr-auto basis-full">
            Not saved: {entry.title.trim() || 'Untitled'}
            {entry.detail && <span className="block">{entry.detail}</span>}
            {copyFailedKey === entry.key && <span className="block">Could not copy. Retry keeps them as a note.</span>}
          </span>
          <button type="button" disabled={busyKey !== null}
            onClick={async () => {
              setBusyKey(entry.key);
              try { await onRetry(entry.key); } finally { setBusyKey(null); }
            }}
            className={buttonBase}
            style={{ fontFamily: 'var(--font-body)', background: 'var(--color-cta-bg)', color: 'var(--color-cta-text)' }}>Retry</button>
          <button type="button" disabled={busyKey !== null}
            onClick={async () => {
              setCopyFailedKey((await onCopy(entry.key)) ? null : entry.key);
            }}
            className={`${buttonBase} border`}
            style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)', background: 'transparent', borderColor: 'var(--glass-border)' }}>Copy</button>
        </div>
      ))}
    </div>
  );
}
