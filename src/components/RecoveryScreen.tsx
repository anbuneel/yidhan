import { RecoveryKeyOffer } from './RecoveryKeyOffer';
import { RecoveryPassphraseReset } from './RecoveryPassphraseReset';

/**
 * Item 26: the two full-screen recovery gates, behind one lazy import.
 * `reset`: a recovery key opened the vault and a new passphrase is required.
 * Otherwise: the recovery-key offer after a passphrase unlock.
 */
export default function RecoveryScreen({ reset }: { reset: boolean }) {
  return reset ? <RecoveryPassphraseReset /> : <RecoveryKeyOffer />;
}
