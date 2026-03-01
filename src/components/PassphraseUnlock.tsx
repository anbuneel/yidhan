import { useState } from 'react';
import { useEncryption } from '../contexts/EncryptionContext';
import { useAuth } from '../contexts/AuthContext';
import { useVaultSettings } from '../hooks/useVaultSettings';

export function PassphraseUnlock() {
  const { unlockWithPassphrase, lockVault } = useEncryption();
  const { user, signOut } = useAuth();
  const vaultSettings = useVaultSettings(user?.id ?? null);
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passphrase) {
      setError('Please enter your passphrase');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await unlockWithPassphrase(passphrase);
      if (!success) {
        setError('Incorrect passphrase. Please try again.');
        setPassphrase('');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      console.error('Passphrase unlock failed:', err);
      setError(`Unlock failed: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <div
        className="w-full max-w-md p-8"
        style={{
          background: 'var(--color-bg-secondary)',
          borderRadius: '2px 24px 4px 24px',
          border: '1px solid var(--glass-border)',
        }}
      >
        <h1
          className="text-2xl mb-2"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text-primary)',
            fontWeight: 500,
          }}
        >
          Unlock Your Notes
        </h1>
        <p
          className="mb-6 text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Enter your passphrase to decrypt and access your notes.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="passphrase"
              className="block text-xs mb-1"
              style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
            >
              Passphrase
            </label>
            <input
              id="passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter your passphrase"
              autoFocus
              className="w-full px-3 py-2 text-sm"
              style={{
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--glass-border)',
                borderRadius: '2px 12px 4px 12px',
                fontFamily: 'var(--font-body)',
                outline: 'none',
              }}
            />
          </div>

          {/* Remember this browser checkbox.
              Setting is written to localStorage synchronously so that unlockWithPassphrase()
              (which reads isRememberBrowserEnabled() from localStorage) sees the updated value. */}
          <label
            className="flex items-center gap-2 cursor-pointer select-none"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <input
              type="checkbox"
              checked={vaultSettings.settings.rememberBrowser}
              onChange={(e) => vaultSettings.setRememberBrowser(e.target.checked)}
              style={{ accentColor: 'var(--color-accent)' }}
            />
            <span
              className="text-xs leading-relaxed"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Remember this browser
              <span
                className="block text-xs mt-0.5"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Only use on personal devices
              </span>
            </span>
          </label>

          {error && (
            <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!passphrase || isSubmitting}
            className="w-full py-2 text-sm transition-opacity"
            style={{
              background: 'var(--color-cta-bg)',
              color: 'var(--color-cta-text)',
              borderRadius: '2px 12px 4px 12px',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              opacity: passphrase && !isSubmitting ? 1 : 0.5,
              cursor: passphrase && !isSubmitting ? 'pointer' : 'not-allowed',
              border: 'none',
            }}
          >
            {isSubmitting ? 'Unlocking...' : 'Unlock'}
          </button>

          <button
            type="button"
            onClick={() => { lockVault('sign-out'); signOut(); }}
            className="w-full py-2 text-xs transition-opacity hover:opacity-80"
            style={{
              background: 'transparent',
              color: 'var(--color-text-tertiary)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
