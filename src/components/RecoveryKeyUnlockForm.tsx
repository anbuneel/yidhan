import { useState } from 'react';
import { useEncryption } from '../contexts/EncryptionContext';
import { vaultInputStyle, vaultPrimaryButtonStyle, vaultQuietButtonStyle } from './vaultScreenStyles';

/**
 * Item 26: unlock with a recovery key. On success the account gate moves to
 * `RecoveryPassphraseReset`; the library opens only after a new passphrase is saved.
 */
export function RecoveryKeyUnlockForm({ onUsePassphrase }: { onUsePassphrase: () => void }) {
  const { unlockWithRecoveryKey } = useEncryption();
  const [recoveryKey, setRecoveryKey] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!recoveryKey.trim()) return;
    setIsSubmitting(true);
    try {
      const status = await unlockWithRecoveryKey(recoveryKey);
      if (status === 'ok') return; // The gate moves on.
      if (status === 'invalid') {
        setError('That doesn’t look like a recovery key. It has 52 letters and digits, in groups of four.');
      } else if (status === 'wrong') {
        setError('That recovery key doesn’t open these notes. Check it and try again.');
      } else {
        setError('This account doesn’t have a recovery key yet.');
      }
    } catch {
      // Never echo the error: nothing about the key belongs on screen or in logs.
      setError('Unlocking didn’t work just now. Try again.');
    }
    setIsSubmitting(false);
  };

  const canSubmit = recoveryKey.trim().length > 0 && !isSubmitting;

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
      <div>
        <label
          htmlFor="recovery-key"
          className="block text-xs mb-1"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          Recovery key
        </label>
        <input
          id="recovery-key"
          data-sensitive
          type="text"
          value={recoveryKey}
          onChange={(e) => setRecoveryKey(e.target.value)}
          placeholder="XXXX-XXXX-XXXX-…"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
          disabled={isSubmitting}
          className="w-full px-3 py-2 text-sm focus-ring"
          style={{ ...vaultInputStyle, fontFamily: 'ui-monospace, monospace' }}
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
        {isSubmitting ? 'Opening…' : 'Continue'}
      </button>
      <button
        type="button"
        onClick={onUsePassphrase}
        // Not while a lookup runs: its result would land on the passphrase form.
        disabled={isSubmitting}
        className="w-full py-2 text-xs transition-opacity hover:opacity-80"
        style={vaultQuietButtonStyle}
      >
        Use your passphrase instead
      </button>
    </form>
  );
}
