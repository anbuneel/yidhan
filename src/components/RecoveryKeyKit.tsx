import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PreparedRecoveryKit } from '../contexts/EncryptionContext';
import { recoveryKeysMatch } from '../lib/recoveryKeyFormat';
import {
  vaultInputStyle,
  vaultPrimaryButtonStyle,
  vaultQuietButtonStyle,
  vaultSecondaryButtonStyle,
} from './vaultScreenStyles';
import './RecoveryKeyKit.css';

/**
 * Item 26: make a recovery key, show it once, and save it only after the writer
 * has typed it back.
 *
 * Built to be reused by the three-step setup (item 27): pass no `onSkip` and the
 * writer cannot leave before the key is saved.
 *
 * The key lives in this component's state and in the prepared kit, and nowhere
 * else. Once saved, both are cleared; nothing can show it again.
 */

type Step = 'intro' | 'preparing' | 'show' | 'confirm' | 'saving';

export interface RecoveryKeyKitProps {
  /** Make the key. Called when the writer asks for it, at most once per mount. */
  prepare: () => Promise<PreparedRecoveryKit>;
  /** Called once the key is saved on the server. */
  onDone: () => void;
  /** Leave without saving. Omit to make the key required. */
  onSkip?: () => void;
  skipLabel?: string;
  /** Begin with a short explanation and a button, rather than with the key. */
  startWithIntro?: boolean;
  /** The heading element, so the kit fits a page (h1) or a settings section (h3). */
  titleAs?: 'h1' | 'h2' | 'h3';
  /** Printed on the sheet, so the writer knows which account the key opens. */
  accountEmail?: string;
  /** Copy for a failure, where the caller's wording differs (item 27's setup). Undefined falls back. */
  describeError?: (err: unknown) => string | undefined;
}

function errorMessage(err: unknown): string {
  const code = (err as { code?: string } | null)?.code;
  if (code === 'offline') {
    return 'You’re offline. Saving a recovery key needs a connection. Nothing has changed.';
  }
  if (code === 'not-ready') {
    return 'A recovery key can\u2019t be made just yet. Yidhan will offer one the next time you unlock with your passphrase.';
  }
  if (code === 'exists') {
    return 'You already have a recovery key, made on another device. You can replace it in Settings, under Security.';
  }
  if (code === 'changed') {
    return 'Your vault changed on another device. Unlock again, then make a new recovery key.';
  }
  return 'The recovery key didn’t save. Try again.';
}

export function RecoveryKeyKit({
  prepare,
  onDone,
  onSkip,
  skipLabel = 'Not now',
  startWithIntro = false,
  titleAs: Title = 'h2',
  accountEmail,
  describeError,
}: RecoveryKeyKitProps) {
  const messageFor = useCallback(
    (err: unknown) => describeError?.(err) ?? errorMessage(err),
    [describeError]
  );
  const [step, setStep] = useState<Step>(startWithIntro ? 'intro' : 'preparing');
  const [displayKey, setDisplayKey] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const kitRef = useRef<PreparedRecoveryKit | null>(null);
  const mountedRef = useRef(true);
  const startedRef = useRef(false);
  const inputId = useId();

  const begin = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setError('');
    setStep('preparing');
    try {
      const kit = await prepare();
      if (!mountedRef.current) {
        kit.discard();
        return;
      }
      kitRef.current = kit;
      setDisplayKey(kit.displayKey);
      setStep('show');
    } catch (err) {
      startedRef.current = false;
      if (!mountedRef.current) return;
      setError(messageFor(err));
      setStep('intro');
    }
  }, [prepare, messageFor]);

  useEffect(() => {
    mountedRef.current = true;
    if (!startWithIntro) void begin();
    return () => {
      mountedRef.current = false;
      kitRef.current?.discard();
      kitRef.current = null;
      document.body.classList.remove('printing-recovery-key');
    };
    // Run once per mount: `begin` guards itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async () => {
    if (!displayKey) return;
    try {
      await navigator.clipboard.writeText(displayKey);
      setCopied(true);
      window.setTimeout(() => { if (mountedRef.current) setCopied(false); }, 2000);
    } catch {
      setError('Copying didn’t work here. Write the key down or print it instead.');
    }
  };

  const handlePrint = () => {
    document.body.classList.add('printing-recovery-key');
    const done = () => {
      document.body.classList.remove('printing-recovery-key');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  };

  const confirmed = displayKey !== null && recoveryKeysMatch(typed, displayKey);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const kit = kitRef.current;
    if (!kit || !confirmed) return;
    setError('');
    setStep('saving');
    try {
      await kit.commit();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(messageFor(err));
      setStep('confirm');
      return;
    }
    // Saved. The key is not kept anywhere from here on.
    kitRef.current = null;
    if (!mountedRef.current) return;
    setDisplayKey(null);
    setTyped('');
    onDone();
  };

  const handleSkip = () => {
    kitRef.current?.discard();
    kitRef.current = null;
    setDisplayKey(null);
    setTyped('');
    onSkip?.();
  };

  const titleStyle = {
    fontFamily: 'var(--font-display)',
    color: 'var(--color-text-primary)',
    fontWeight: 500,
  } as const;
  const bodyStyle = { color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' } as const;

  let body: ReactNode;
  if (step === 'intro') {
    body = (
      <>
        <Title className="text-2xl mb-2" style={titleStyle}>Make a recovery key</Title>
        <p className="mb-6 text-sm" style={bodyStyle}>
          If you forget your passphrase, a recovery key opens your notes. You see it once,
          so keep it somewhere safe, away from this device.
        </p>
        {error && <p role="alert" className="mb-4 text-xs" style={{ color: 'var(--color-destructive)' }}>{error}</p>}
        <button
          type="button"
          onClick={() => { void begin(); }}
          className="w-full py-2 text-sm"
          style={vaultPrimaryButtonStyle(true)}
        >
          Make a recovery key
        </button>
      </>
    );
  } else if (step === 'preparing') {
    body = (
      <>
        <Title className="text-2xl mb-2" style={titleStyle}>Make a recovery key</Title>
        <p role="status" className="text-sm" style={bodyStyle}>Making your recovery key…</p>
      </>
    );
  } else if (step === 'show') {
    body = (
      <>
        <Title className="text-2xl mb-2" style={titleStyle}>Your recovery key</Title>
        <p className="mb-4 text-sm" style={bodyStyle}>
          Write it down, print it, or keep it in a password manager. Yidhan can&rsquo;t show it
          again. With it, you can open your notes if you forget your passphrase.
        </p>
        <p
          data-sensitive
          data-testid="recovery-key"
          className="mb-4 p-3 text-sm select-all"
          style={{
            fontFamily: 'ui-monospace, monospace',
            letterSpacing: '0.06em',
            lineHeight: 1.8,
            wordBreak: 'break-word',
            background: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--glass-border)',
            borderRadius: '2px 12px 4px 12px',
          }}
        >
          {displayKey}
        </p>
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => { void handleCopy(); }} className="flex-1 py-2 text-sm" style={vaultSecondaryButtonStyle}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" onClick={handlePrint} className="flex-1 py-2 text-sm" style={vaultSecondaryButtonStyle}>
            Print
          </button>
        </div>
        {error && <p role="alert" className="mb-4 text-xs" style={{ color: 'var(--color-destructive)' }}>{error}</p>}
        <button
          type="button"
          onClick={() => { setError(''); setStep('confirm'); }}
          className="w-full py-2 text-sm"
          style={vaultPrimaryButtonStyle(true)}
        >
          I&rsquo;ve saved it
        </button>
        <div data-sensitive className="recovery-kit-sheet" aria-hidden="true">
          <h1>Yidhan recovery key</h1>
          {accountEmail && <p>For {accountEmail}</p>}
          <p className="recovery-kit-sheet-key">{displayKey}</p>
          <p>
            If you forget your passphrase, choose &ldquo;Use your recovery key&rdquo; on the unlock
            screen and enter this key. Keep this page somewhere safe. Anyone with it can open your notes.
          </p>
        </div>
      </>
    );
  } else {
    const saving = step === 'saving';
    body = (
      <form onSubmit={(e) => { void handleSave(e); }}>
        <Title className="text-2xl mb-2" style={titleStyle}>Confirm your recovery key</Title>
        <p className="mb-4 text-sm" style={bodyStyle}>
          Enter the key you saved. This checks that you have it before it starts working.
        </p>
        <label htmlFor={inputId} className="block text-xs mb-1" style={bodyStyle}>
          Recovery key
        </label>
        <input
          id={inputId}
          data-sensitive
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
          disabled={saving}
          className="w-full px-3 py-2 text-sm focus-ring mb-2"
          style={{ ...vaultInputStyle, fontFamily: 'ui-monospace, monospace' }}
        />
        {typed.length > 0 && !confirmed && (
          <p className="mb-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            This doesn&rsquo;t match yet.
          </p>
        )}
        {error && <p role="alert" className="mb-2 text-xs" style={{ color: 'var(--color-destructive)' }}>{error}</p>}
        <button
          type="submit"
          disabled={!confirmed || saving}
          className="w-full py-2 mt-2 text-sm"
          style={vaultPrimaryButtonStyle(confirmed && !saving)}
        >
          {saving ? 'Saving…' : 'Save recovery key'}
        </button>
        <button
          type="button"
          onClick={() => { setError(''); setStep('show'); }}
          disabled={saving}
          className="w-full py-2 mt-2 text-xs"
          style={vaultQuietButtonStyle}
        >
          Show the key again
        </button>
      </form>
    );
  }

  return (
    <div>
      {body}
      {onSkip && step !== 'saving' && (
        <button
          type="button"
          onClick={handleSkip}
          className="w-full py-2 mt-2 text-xs hover:underline"
          style={vaultQuietButtonStyle}
        >
          {skipLabel}
        </button>
      )}
    </div>
  );
}
