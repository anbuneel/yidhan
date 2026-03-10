import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEncryption } from '../contexts/EncryptionContext';
import { createEncryptedNote } from '../services/encryptedNotes';
import { createTagOffline } from '../services/offlineTags';
import { addTagToNoteOffline } from '../services/offlineNotes';

interface PassphraseSetupProps {
  onComplete?: () => void;
}

const STARTER_NOTES = [
  {
    title: 'Welcome to Yidhan',
    content: `<p>A calm space for your thoughts. Pin important notes, organize with tags, and write in focus mode.</p>
<p>Your notes are end-to-end encrypted — only you can read them.</p>`,
    pinned: true,
    tagKey: null as string | null,
  },
  {
    title: 'Book Recommendations',
    content: `<p>Books people keep telling me to read:</p>
<ul>
<li>Atomic Habits</li>
<li>The Almanack of Naval Ravikant</li>
<li>Four Thousand Weeks</li>
</ul>
<p>Started Four Thousand Weeks last night. The bit about how we'll never "get on top of everything" was oddly freeing.</p>`,
    pinned: false,
    tagKey: null,
  },
  {
    title: 'Recipe — Overnight Oats',
    content: `<p>Equal parts oats and milk. Spoon of yogurt, pinch of salt, honey to taste. Mix, fridge overnight. Top with whatever fruit is around.</p>
<p>The trick is the salt — makes everything else pop.</p>`,
    pinned: false,
    tagKey: 'recipes',
  },
  {
    title: 'Weekend Plans',
    content: `<ul>
<li>Farmers market Saturday morning</li>
<li>Fix the kitchen shelf (finally)</li>
<li>Try that new coffee place on 5th</li>
</ul>`,
    pinned: false,
    tagKey: null,
  },
];

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

      // Create encrypted starter notes + tag (replaces server-side trigger disabled for E2EE)
      if (user) {
        try {
          // Create the Recipes tag first so we can link it to the recipe note
          const recipesTag = await createTagOffline(user.id, 'Recipes', 'sage');
          const tagMap: Record<string, string> = { recipes: recipesTag.id };

          for (const starter of STARTER_NOTES) {
            const note = await createEncryptedNote(
              user.id, starter.title, starter.content, derivedKeys, starter.pinned
            );
            if (starter.tagKey && tagMap[starter.tagKey]) {
              await addTagToNoteOffline(user.id, note.id, tagMap[starter.tagKey]);
            }
          }
        } catch {
          // Non-fatal: starter notes are nice-to-have, don't block passphrase setup
          console.error('Failed to create starter notes');
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
          Keep it somewhere safe before continuing.
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
              There are no recovery codes or reset links for encrypted notes.
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
