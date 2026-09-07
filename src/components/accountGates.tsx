import type { ReactElement } from 'react';
import { DatabaseUpdatePending } from './DatabaseUpdatePending';
import { PassphraseSetup } from './PassphraseSetup';
import { PassphraseUnlock } from './PassphraseUnlock';
import { blocksWrites, type SchemaCompatibility } from '../services/schemaVersion';

/**
 * What stands between a signed-in reader and their library, in the order it stands.
 *
 * `renderEntryScreen` covers the screens a *visitor* can reach — the landing page, the
 * public pages, a shared letter. These are the ones that only exist once there is an
 * account: the deployment guard and the vault. Returns null when nothing is in the way.
 */

export interface AccountGateOptions {
  schemaCompatibility: SchemaCompatibility;
  isCheckingSchema: boolean;
  onRecheckSchema: () => void;
  isEncryptionSetup: boolean;
  isUnlocked: boolean;
}

export function renderAccountGate({
  schemaCompatibility,
  isCheckingSchema,
  onRecheckSchema,
  isEncryptionSetup,
  isUnlocked,
}: AccountGateOptions): ReactElement | null {
  // Item 36. Migrations are applied by hand, and a client shipped ahead of its
  // migration fails only on writes — silently — while reads keep working. Rather than
  // let the queue fill with writes that cannot land, say so and stop.
  //
  // Before the vault gate, because unlocking is the step that leads to writing.
  if (blocksWrites(schemaCompatibility) && schemaCompatibility.status === 'database-behind') {
    return (
      <DatabaseUpdatePending
        appliedVersion={schemaCompatibility.appliedVersion}
        requiredVersion={schemaCompatibility.requiredVersion}
        onRetry={onRecheckSchema}
        isRetrying={isCheckingSchema}
      />
    );
  }

  // The E2EE passphrase gate.
  if (!isEncryptionSetup) return <PassphraseSetup />;
  if (!isUnlocked) return <PassphraseUnlock />;

  return null;
}
