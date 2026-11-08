import { useAuth } from '../contexts/AuthContext';
import { useEncryption } from '../contexts/EncryptionContext';
import { RecoveryKeyKit } from './RecoveryKeyKit';
import { VaultScreenCard } from './VaultScreenCard';

/**
 * Item 26: after a passphrase unlock on an account with no recovery key, offer
 * one before the library. "Not now" goes straight to the library; the offer comes
 * back on the next passphrase unlock.
 */
export function RecoveryKeyOffer() {
  const { prepareRecoveryKit, dismissRecoveryKeyOffer } = useEncryption();
  const { user } = useAuth();
  return (
    <VaultScreenCard>
      <RecoveryKeyKit
        prepare={prepareRecoveryKit}
        onDone={dismissRecoveryKeyOffer}
        onSkip={dismissRecoveryKeyOffer}
        startWithIntro
        titleAs="h1"
        accountEmail={user?.email ?? undefined}
      />
    </VaultScreenCard>
  );
}
