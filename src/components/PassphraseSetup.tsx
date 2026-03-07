import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEncryption } from '../contexts/EncryptionContext';
import { createEncryptedNote } from '../services/encryptedNotes';

interface PassphraseSetupProps {
  onComplete?: () => void;
}

const WELCOME_TITLE = 'Welcome to Yidhan';
const WELCOME_CONTENT = `<p>This is your quiet space for writing.</p>
<p>There's nothing to configure, no folders to organize. Just start a new note when a thought arrives.</p>
<h3>A few things to discover as you go</h3>
<ul>
<li>Type <code>/</code> for quick commands</li>
<li>Add tags to organize naturally</li>
<li>Press <code>Ctrl+K</code> (or <code>Cmd+K</code> on Mac) to search</li>
</ul>
<p>Everything else can wait. Start writing.</p>`;

export function PassphraseSetup({ onComplete }: PassphraseSetupProps) {
  const { user } = useAuth();
  const { setupPassphrase } = useEncryption();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = passphrase.length >= 8 &&
                  passphrase === confirm &&
                  acknowledged;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (passphrase !== confirm) {
      setError('Passphrases do not match');
      return;
    }

    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }

    if (!acknowledged) {
      setError('Please acknowledge the recovery warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const derivedKeys = await setupPassphrase(passphrase);

      // Create encrypted welcome note (replaces server-side trigger disabled for E2EE)
      if (user) {
        try {
          await createEncryptedNote(user.id, WELCOME_TITLE, WELCOME_CONTENT, derivedKeys);
        } catch {
          // Non-fatal: welcome note is nice-to-have, don't block passphrase setup
          console.error('Failed to create welcome note');
        }
      }

      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up encryption');
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
          Protect Your Notes
        </h1>
        <p
          className="mb-6 text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Set a passphrase to encrypt your notes end-to-end.
          Only you can read them — not even the server.
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
              autoComplete="new-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="At least 8 characters"
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

          <div>
            <label
              htmlFor="confirm"
              className="block text-xs mb-1"
              style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
            >
              Confirm passphrase
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter passphrase"
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
            {confirm && passphrase !== confirm && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-destructive)' }}>
                Passphrases do not match
              </p>
            )}
          </div>

          <label
            className="flex items-start gap-2 cursor-pointer"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="form-checkbox mt-0.5"
            />
            <span className="text-xs leading-relaxed">
              I understand that if I forget this passphrase, my notes cannot be recovered.
              There are no recovery codes.
            </span>
          </label>

          <p
            className="text-xs"
            style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}
          >
            Note: Tag names are not encrypted — only note titles and content are protected.
          </p>

          {error && (
            <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full py-2 text-sm transition-opacity"
            style={{
              background: 'var(--color-cta-bg)',
              color: 'var(--color-cta-text)',
              borderRadius: '2px 12px 4px 12px',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              opacity: isValid && !isSubmitting ? 1 : 0.5,
              cursor: isValid && !isSubmitting ? 'pointer' : 'not-allowed',
              border: 'none',
            }}
          >
            {isSubmitting ? 'Setting up encryption...' : 'Enable Encryption'}
          </button>
        </form>
      </div>
    </div>
  );
}
