import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEncryption } from '../contexts/EncryptionContext';
import { readRecoveryWrap, readVaultMetadata } from '../lib/vaultMetadata';
import { RecoveryKeyKit } from './RecoveryKeyKit';

/**
 * Item 26: make or replace the recovery key from Settings, inline, so an open
 * draft is never unmounted. Rendered only while the vault is unlocked.
 */
export function RecoveryKeySettings() {
  const { user } = useAuth();
  const { prepareRecoveryKit } = useEncryption();
  const [isOpen, setIsOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const vault = (user?.user_metadata as Record<string, unknown> | undefined)?.vault;
  const vaultRead = readVaultMetadata(vault);
  const recovery = vaultRead.status === 'valid'
    ? readRecoveryWrap((vault as Record<string, unknown>).recoveryWrap)
    : { status: 'absent' as const };
  const hasKey = recovery.status === 'valid';
  // A vault or a recovery wrap from a newer app: leave it alone.
  const isNewerFormat = vaultRead.status === 'unsupported' || recovery.status === 'unsupported';

  const textStyle = { fontFamily: 'var(--font-body)', color: 'var(--color-text-tertiary)' } as const;

  return (
    <div>
      <span className="block text-sm mb-1" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)' }}>
        Recovery key
      </span>
      {isOpen ? (
        <div className="mt-2 p-4" style={{ border: '1px solid var(--glass-border)', borderRadius: '2px 12px 4px 12px' }}>
          {hasKey && (
            <p className="text-xs mb-3" style={textStyle}>
              The new key replaces your current one once it is saved.
            </p>
          )}
          <RecoveryKeyKit
            prepare={() => prepareRecoveryKit({ replace: true })}
            onDone={() => { setIsOpen(false); setSaved(true); }}
            onSkip={() => setIsOpen(false)}
            skipLabel="Cancel"
            titleAs="h3"
            accountEmail={user?.email ?? undefined}
          />
        </div>
      ) : (
        <>
          <p className="text-xs mb-2" style={textStyle}>
            {saved
              ? 'Recovery key saved.'
              : hasKey
                ? 'You have a recovery key. It opens your notes if you forget your passphrase.'
                : 'A recovery key opens your notes if you forget your passphrase.'}
          </p>
          {!isNewerFormat && (
            <button
              type="button"
              onClick={() => { setSaved(false); setIsOpen(true); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                fontFamily: 'var(--font-body)',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--glass-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {hasKey ? 'Make a new recovery key' : 'Make a recovery key'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
