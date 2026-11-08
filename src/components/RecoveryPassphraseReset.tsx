import { useState } from 'react';
import { useEncryption } from '../contexts/EncryptionContext';
import { MIN_PASSPHRASE_LENGTH, validatePassphrasePolicy } from '../utils/passphrasePolicy';
import { VaultScreenCard } from './VaultScreenCard';
import { vaultInputStyle, vaultPrimaryButtonStyle, vaultQuietButtonStyle } from './vaultScreenStyles';

/**
 * Item 26: after a recovery-key unlock, a new passphrase is required before the
 * library opens. The keys are held in memory until the server has the new wrap.
 */

function resetErrorMessage(err: unknown): string {
  const code = (err as { code?: string } | null)?.code;
  if (code === 'offline') {
    return 'You’re offline. Setting a new passphrase needs a connection. Nothing has changed yet.';
  }
  if (code === 'changed') {
    return 'Your passphrase was changed on another device. Choose Cancel, then unlock with it or use your recovery key again.';
  }
  if (code === 'failed' || code === 'not-ready') {
    return 'The new passphrase may not have saved. Try again. Your recovery key still works either way.';
  }
  return err instanceof Error ? err.message : 'The new passphrase didn’t save. Try again.';
}

export function RecoveryPassphraseReset() {
  const { setPassphraseAfterRecovery, cancelRecovery } = useEncryption();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const canSubmit = passphrase.length > 0 && confirm.length > 0 && !isSaving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const policyError = validatePassphrasePolicy(passphrase);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (passphrase !== confirm) {
      setError('The two passphrases don’t match.');
      return;
    }
    setIsSaving(true);
    try {
      await setPassphraseAfterRecovery(passphrase);
      // Unlocked: the account gate moves on to the library.
    } catch (err) {
      setError(resetErrorMessage(err));
      setIsSaving(false);
    }
  };

  const labelStyle = { color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' } as const;

  return (
    <VaultScreenCard>
      <h1
        className="text-2xl mb-2"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)', fontWeight: 500 }}
      >
        Choose a new passphrase
      </h1>
      <p className="mb-6 text-sm" style={labelStyle}>
        Your recovery key opened your notes. Choose a new passphrase to finish. Your old
        passphrase stops working, and your recovery key keeps working.
      </p>

      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        <div>
          <label htmlFor="new-passphrase" className="block text-xs mb-1" style={labelStyle}>
            New passphrase
          </label>
          <input
            id="new-passphrase"
            type="password"
            autoComplete="new-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder={`At least ${MIN_PASSPHRASE_LENGTH} characters`}
            autoFocus
            disabled={isSaving}
            className="w-full px-3 py-2 text-sm focus-ring"
            style={vaultInputStyle}
          />
        </div>
        <div>
          <label htmlFor="confirm-new-passphrase" className="block text-xs mb-1" style={labelStyle}>
            Confirm new passphrase
          </label>
          <input
            id="confirm-new-passphrase"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={isSaving}
            className="w-full px-3 py-2 text-sm focus-ring"
            style={vaultInputStyle}
          />
        </div>

        {error && (
          <p role="alert" className="text-xs" style={{ color: 'var(--color-destructive)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-2 text-sm transition-opacity"
          style={vaultPrimaryButtonStyle(canSubmit)}
        >
          {isSaving ? 'Saving…' : 'Save passphrase'}
        </button>
        <button
          type="button"
          onClick={() => cancelRecovery()}
          disabled={isSaving}
          className="w-full py-2 text-xs transition-opacity hover:opacity-80"
          style={vaultQuietButtonStyle}
        >
          Cancel
        </button>
      </form>
    </VaultScreenCard>
  );
}
