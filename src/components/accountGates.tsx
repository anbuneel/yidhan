import { Suspense, type ReactElement } from 'react';
import { DatabaseUpdatePending } from './DatabaseUpdatePending';
import { LoadingFallback } from './LoadingFallback';
import { PassphraseUnlock } from './PassphraseUnlock';
import { blocksWrites, type SchemaCompatibility } from '../services/schemaVersion';
import { lazyWithRetry } from '../utils/lazyWithRetry';

// Item 26. Out of the entry chunk: most unlocks never show either screen. One
// lazy component for both keeps the entry cost to a single loader.
const RecoveryScreen = lazyWithRetry(() => import('./RecoveryScreen'));
// Shown once per account, so it does not belong in the entry chunk either. Moving
// it out is what makes room for the recovery screens under the bundle budget.
const PassphraseSetup = lazyWithRetry(() =>
  import('./PassphraseSetup').then((m) => ({ default: m.PassphraseSetup }))
);

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
  /** Item 26: the recovery screen the vault context asks for, if any. */
  recoveryScreen: 'reset' | 'offer' | null;
  /** Item 27: a setup is open in this tab and has not reached the library yet. */
  setupScreen: boolean;
}

export function renderAccountGate({
  schemaCompatibility,
  isCheckingSchema,
  onRecheckSchema,
  isEncryptionSetup,
  isUnlocked,
  recoveryScreen,
  setupScreen,
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

  // The E2EE passphrase gate. Item 27: the setup stays up after its write lands,
  // so its last step shows before the library. Only this tab's own setup sets
  // `setupScreen`, so an existing account never sees it.
  if (!isEncryptionSetup || setupScreen) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <PassphraseSetup />
      </Suspense>
    );
  }
  // A recovery key opened the vault: a new passphrase comes before anything else.
  // The offer is shown before the library has rendered, so it never unmounts a draft.
  // The context offers only while unlocked.
  if (recoveryScreen) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <RecoveryScreen reset={recoveryScreen === 'reset'} />
      </Suspense>
    );
  }
  if (!isUnlocked) return <PassphraseUnlock />;

  return null;
}
