import { useEffect, useState, type FormEvent } from 'react';
import { ModalBackdropButton } from './ModalBackdropButton';
import {
  MIN_PASSPHRASE_LENGTH,
  evaluatePassphraseStrength,
  validatePassphrasePolicy,
} from '../utils/passphrasePolicy';

/**
 * The passphrase for a `.yidhan` backup — asked for when one is made, and again when
 * one is opened (item 38).
 *
 * It is deliberately *not* the vault passphrase. A backup sealed under the vault key
 * would stop opening the moment that key changed, which is the opposite of what a
 * backup is for. The copy says so, because a reader offered a second passphrase will
 * otherwise reasonably assume it is the one they already have.
 */
export interface BackupPassphraseModalProps {
  mode: 'create' | 'open';
  isOpen: boolean;
  /** Rejected messages from the caller's attempt — a wrong passphrase, a damaged file. */
  error?: string | null;
  isBusy?: boolean;
  onSubmit: (passphrase: string) => void;
  onCancel: () => void;
}

export function BackupPassphraseModal({
  mode,
  isOpen,
  error,
  isBusy = false,
  onSubmit,
  onCancel,
}: BackupPassphraseModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPassphrase('');
      setConfirmation('');
      setLocalError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isCreating = mode === 'create';
  const strength = isCreating ? evaluatePassphraseStrength(passphrase) : null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (isCreating) {
      const policyError = validatePassphrasePolicy(passphrase);
      if (policyError) {
        setLocalError(policyError);
        return;
      }
      if (passphrase !== confirmation) {
        setLocalError('The two passphrases do not match.');
        return;
      }
    } else if (!passphrase) {
      setLocalError('Enter the passphrase you chose for this backup.');
      return;
    }

    onSubmit(passphrase);
  };

  const shown = localError ?? error ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-passphrase-title"
      data-testid="backup-passphrase-modal"
    >
      <ModalBackdropButton onClick={onCancel} label="Close" disabled={isBusy} />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-2xl p-8"
        style={{
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <h2
          id="backup-passphrase-title"
          className="text-2xl mb-3"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text-primary)',
            fontWeight: 300,
          }}
        >
          {isCreating ? 'Choose a backup passphrase' : 'Open this backup'}
        </h2>

        <p
          className="text-sm mb-6"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
        >
          {isCreating
            ? 'Your backup is encrypted with this passphrase before it leaves the app. It is separate from your vault passphrase on purpose, so the backup keeps opening even if you change or rotate that one. We cannot recover it — if you lose it, the backup cannot be opened.'
            : 'Enter the passphrase you chose when this backup was made. It is not your vault passphrase.'}
        </p>

        <label
          className="block text-sm mb-2"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
          htmlFor="backup-passphrase"
        >
          Backup passphrase
        </label>
        <input
          id="backup-passphrase"
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg mb-2 focus-ring"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--glass-border)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-body)',
          }}
          autoComplete={isCreating ? 'new-password' : 'current-password'}
          disabled={isBusy}
        />

        {isCreating && (
          <>
            <p
              className="text-xs mb-4"
              style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-tertiary)' }}
            >
              {strength
                ? `Strength: ${strength.label}`
                : `At least ${MIN_PASSPHRASE_LENGTH} characters.`}
            </p>

            <label
              className="block text-sm mb-2"
              style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
              htmlFor="backup-passphrase-confirm"
            >
              Type it again
            </label>
            <input
              id="backup-passphrase-confirm"
              type="password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg mb-2 focus-ring"
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--glass-border)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-body)',
              }}
              autoComplete="new-password"
              disabled={isBusy}
            />
          </>
        )}

        {shown && (
          <p
            role="alert"
            className="text-sm mt-3"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--color-error, #C25634)' }}
          >
            {shown}
          </p>
        )}

        <div className="flex justify-end gap-3 mt-8">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="px-4 py-2 rounded-lg focus-ring"
            style={{
              background: 'transparent',
              border: '1px solid var(--glass-border)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isBusy}
            className="px-4 py-2 rounded-lg focus-ring"
            style={{
              background: 'var(--color-cta-bg)',
              color: 'var(--color-cta-text)',
              fontFamily: 'var(--font-body)',
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            {isBusy
              ? isCreating
                ? 'Encrypting…'
                : 'Opening…'
              : isCreating
                ? 'Create backup'
                : 'Open backup'}
          </button>
        </div>
      </form>
    </div>
  );
}
