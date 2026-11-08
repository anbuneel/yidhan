import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEncryption } from '../contexts/EncryptionContext';
import type { AccountSetup } from '../contexts/EncryptionContext';
import type { DerivedKeys } from '../lib/encryption';
import { GENERATED_PASSPHRASE_BITS, GENERATED_PASSPHRASE_WORDS, generatePassphrase } from '../lib/passphraseGenerator';
import { createEncryptedNote } from '../services/encryptedNotes';
import { createTagOffline } from '../services/offlineTags';
import { addTagToNoteOffline } from '../services/offlineNotes';
import {
  evaluatePassphraseStrength,
  MIN_PASSPHRASE_LENGTH,
  validatePassphrasePolicy,
  type PassphraseStrengthLabel,
} from '../utils/passphrasePolicy';
import { RecoveryKeyKit } from './RecoveryKeyKit';
import { VaultScreenCard } from './VaultScreenCard';
import {
  vaultInputStyle,
  vaultPrimaryButtonStyle,
  vaultQuietButtonStyle,
  vaultSecondaryButtonStyle,
} from './vaultScreenStyles';

/**
 * Item 27: first-time setup in three steps — passphrase, recovery key, done.
 *
 * Nothing reaches the server until the writer has typed the recovery key back.
 * Then one write stores the vault, its key-check and the recovery wrap
 * (`services/accountSetup.ts`), so an account is either set up with a recovery
 * key or not set up at all. Closing the tab before that leaves the account as it
 * was, and the next sign-in opens this screen again at step 1.
 *
 * Lazy-loaded by the account gate, with the word list behind the suggestion.
 */

const STRENGTH_COLORS: Record<PassphraseStrengthLabel, string> = {
  'Too short': 'var(--color-destructive)',
  Weak: 'var(--color-destructive)',
  Fair: 'var(--color-accent)',
  Good: 'var(--color-cta-bg)',
  Strong: 'var(--color-cta-bg)',
};

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

/** Create the starter notes and their tag. Nice to have: a failure never blocks setup. */
async function createStarterNotes(userId: string, keys: DerivedKeys): Promise<void> {
  try {
    const recipesTag = await createTagOffline(userId, 'Recipes', 'sage');
    const tagMap: Record<string, string> = { recipes: recipesTag.id };
    for (const starter of STARTER_NOTES) {
      const note = await createEncryptedNote(userId, starter.title, starter.content, keys, starter.pinned);
      if (starter.tagKey && tagMap[starter.tagKey]) {
        await addTagToNoteOffline(userId, note.id, tagMap[starter.tagKey]);
      }
    }
  } catch {
    console.error('Failed to create starter notes');
  }
}

/** Copy for a failed setup write. The recovery kit's own copy speaks of an existing vault. */
function setupErrorMessage(err: unknown): string | undefined {
  const code = (err as { code?: string } | null)?.code;
  if (code === 'offline') {
    return 'You’re offline. Finishing setup needs a connection. Try again once you’re back online.';
  }
  if (code === 'changed' || code === 'exists') {
    return 'This account was set up in another tab or on another device. Reload this page to unlock it with that passphrase.';
  }
  return 'Setup didn’t finish. Try again.';
}

type Step = 'passphrase' | 'recovery' | 'done';
type Mode = 'suggested' | 'own';

const titleStyle = {
  fontFamily: 'var(--font-display)',
  color: 'var(--color-text-primary)',
  fontWeight: 500,
} as const;
const bodyStyle = { color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' } as const;
const quietStyle = { color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' } as const;

function StepLabel({ step }: { step: 1 | 2 | 3 }) {
  return (
    <p className="text-xs mb-2" style={quietStyle}>
      Step {step} of 3
    </p>
  );
}

export function PassphraseSetup() {
  const { user } = useAuth();
  const { beginAccountSetup, finishAccountSetup, setupDone } = useEncryption();
  // A remount after the write landed comes back to step 3, not step 1.
  const [step, setStep] = useState<Step>(() => (setupDone ? 'done' : 'passphrase'));
  const [mode, setMode] = useState<Mode>('suggested');
  const [suggested, setSuggested] = useState(() => generatePassphrase());
  const [own, setOwn] = useState('');
  const [confirm, setConfirm] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  /** A save sent its write. It may have landed, so Back would abandon a setup the server holds. */
  const [writeSent, setWriteSent] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const setupRef = useRef<AccountSetup | null>(null);
  const starterNotesRef = useRef<Promise<void>>(Promise.resolve());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Before the write this zeroes the key; after it, the keys stay installed.
      setupRef.current?.discard();
      setupRef.current = null;
    };
  }, []);

  const passphrase = mode === 'suggested' ? suggested : own;
  const ownStrength = evaluatePassphraseStrength(own);
  const canContinue = !isPreparing && (
    mode === 'suggested' || (validatePassphrasePolicy(own) === null && own === confirm)
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(suggested);
      setCopied(true);
      window.setTimeout(() => { if (mountedRef.current) setCopied(false); }, 2000);
    } catch {
      setError('Copying didn’t work here. Write the passphrase down instead.');
    }
  };

  const handleAnother = () => {
    setSuggested(generatePassphrase());
    setCopied(false);
    setError('');
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'own') {
      const policyError = validatePassphrasePolicy(own);
      if (policyError) {
        setError(policyError);
        return;
      }
      if (own !== confirm) {
        setError('The two passphrases don’t match.');
        return;
      }
    }
    setIsPreparing(true);
    try {
      const setup = await beginAccountSetup(passphrase);
      if (!mountedRef.current) {
        setup.discard();
        return;
      }
      setupRef.current?.discard();
      setupRef.current = setup;
      setStep('recovery');
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Setup didn’t start. Try again.');
      }
    } finally {
      if (mountedRef.current) setIsPreparing(false);
    }
  };

  // Step 2 to step 1. The recovery key shown so far is put away, and Continue
  // makes a new one: going back never moves past the key.
  const handleBack = () => {
    setupRef.current?.discard();
    setupRef.current = null;
    setError('');
    setStep('passphrase');
  };

  const prepareKit = useCallback(async () => {
    const setup = setupRef.current;
    if (!setup) throw new Error('Choose a passphrase first.');
    const kit = setup.prepareRecoveryKit();
    return {
      displayKey: kit.displayKey,
      discard: kit.discard,
      commit: async () => {
        setIsSavingKey(true);
        try {
          await kit.commit();
        } finally {
          if (mountedRef.current) {
            setIsSavingKey(false);
            setWriteSent(setup.writeAttempted());
          }
        }
      },
    };
  }, []);

  const handleKeySaved = useCallback(() => {
    const keys = setupRef.current?.committedKeys();
    if (user && keys) starterNotesRef.current = createStarterNotes(user.id, keys);
    setStep('done');
  }, [user]);

  // The library loads its notes once the keys are installed, so the starter
  // notes are written first.
  const handleOpen = async () => {
    setIsOpening(true);
    await starterNotesRef.current;
    if (mountedRef.current) finishAccountSetup();
  };

  if (step === 'recovery') {
    return (
      <VaultScreenCard>
        <StepLabel step={2} />
        <RecoveryKeyKit
          prepare={prepareKit}
          onDone={handleKeySaved}
          titleAs="h1"
          accountEmail={user?.email ?? undefined}
          describeError={setupErrorMessage}
        />
        <button
          type="button"
          onClick={handleBack}
          disabled={isSavingKey || writeSent}
          className="w-full py-2 mt-2 text-xs transition-opacity hover:opacity-80"
          style={vaultQuietButtonStyle}
        >
          Back
        </button>
      </VaultScreenCard>
    );
  }

  if (step === 'done') {
    return (
      <VaultScreenCard>
        <StepLabel step={3} />
        <h1 className="text-2xl mb-2" style={titleStyle}>Your notes are ready</h1>
        <p className="mb-6 text-sm" style={bodyStyle}>
          Your passphrase opens your notes on any device. If you ever forget it, your
          recovery key opens them instead. A few starter notes are waiting for you.
        </p>
        <button
          type="button"
          onClick={() => { void handleOpen(); }}
          disabled={isOpening}
          autoFocus
          className="w-full py-2 text-sm"
          style={vaultPrimaryButtonStyle(!isOpening)}
        >
          Open my notes
        </button>
      </VaultScreenCard>
    );
  }

  return (
    <VaultScreenCard>
      <StepLabel step={1} />
      <h1 className="text-2xl mb-2" style={titleStyle}>Choose a passphrase</h1>
      <p className="mb-6 text-sm" style={bodyStyle}>
        Your notes are encrypted on this device with a passphrase only you know. You&rsquo;ll
        use it to open them on any device. Next, you&rsquo;ll get a recovery key in case you
        ever forget it.
      </p>

      <form onSubmit={(e) => { void handleContinue(e); }} className="space-y-4">
        {mode === 'suggested' ? (
          <div>
            <p className="block text-xs mb-1" style={bodyStyle} id="suggested-passphrase-label">
              A passphrase made for you
            </p>
            <p
              data-sensitive
              data-testid="suggested-passphrase"
              aria-labelledby="suggested-passphrase-label"
              className="p-3 text-sm select-all"
              style={{
                ...vaultInputStyle,
                fontFamily: 'ui-monospace, monospace',
                lineHeight: 1.8,
                wordBreak: 'break-word',
              }}
            >
              {suggested}
            </p>
            <p className="mt-1 text-xs" style={quietStyle}>
              Picked at random on this device: {GENERATED_PASSPHRASE_WORDS} words, about{' '}
              {GENERATED_PASSPHRASE_BITS} bits of entropy. Keep it in a password manager or write it down.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => { void handleCopy(); }}
                disabled={isPreparing}
                className="flex-1 py-2 text-sm"
                style={vaultSecondaryButtonStyle}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={handleAnother}
                disabled={isPreparing}
                className="flex-1 py-2 text-sm"
                style={vaultSecondaryButtonStyle}
              >
                Another one
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setMode('own'); setError(''); }}
              disabled={isPreparing}
              className="w-full py-2 mt-2 text-xs transition-opacity hover:opacity-80"
              style={vaultQuietButtonStyle}
            >
              Type my own instead
            </button>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="passphrase" className="block text-xs mb-1" style={bodyStyle}>
                Passphrase
              </label>
              <input
                id="passphrase"
                type="password"
                autoComplete="new-password"
                value={own}
                onChange={(e) => setOwn(e.target.value)}
                placeholder={`At least ${MIN_PASSPHRASE_LENGTH} characters`}
                autoFocus
                disabled={isPreparing}
                className="w-full px-3 py-2 text-sm focus-ring"
                style={vaultInputStyle}
              />
              {ownStrength && (
                <div className="mt-2 space-y-1">
                  <div className="text-xs" style={{ color: STRENGTH_COLORS[ownStrength.label], fontFamily: 'var(--font-body)' }}>
                    Strength: {ownStrength.label}
                  </div>
                  <div aria-hidden="true" className="grid grid-cols-4 gap-1">
                    {Array.from({ length: 4 }, (_, index) => (
                      <div
                        key={index}
                        className="h-1 rounded-full"
                        style={{
                          background: index < ownStrength.score
                            ? STRENGTH_COLORS[ownStrength.label]
                            : 'var(--glass-border)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="confirm" className="block text-xs mb-1" style={bodyStyle}>
                Confirm passphrase
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type it again"
                disabled={isPreparing}
                className="w-full px-3 py-2 text-sm focus-ring"
                style={vaultInputStyle}
              />
              {confirm && own !== confirm && (
                <p className="text-xs mt-1" style={quietStyle}>
                  These don&rsquo;t match yet.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setMode('suggested'); setError(''); }}
              disabled={isPreparing}
              className="w-full py-2 text-xs transition-opacity hover:opacity-80"
              style={vaultQuietButtonStyle}
            >
              Use a passphrase made for me
            </button>
          </>
        )}

        <p className="text-xs" style={quietStyle}>
          Tag names are not encrypted; only note titles and content are.
        </p>

        {error && (
          <p role="alert" className="text-xs" style={{ color: 'var(--color-destructive)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canContinue}
          className="w-full py-2 text-sm transition-opacity"
          style={vaultPrimaryButtonStyle(canContinue)}
        >
          {isPreparing ? 'Preparing…' : 'Continue'}
        </button>
      </form>
    </VaultScreenCard>
  );
}
