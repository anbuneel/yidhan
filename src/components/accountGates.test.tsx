/**
 * Item 26: where the recovery screens sit among the account gates.
 */

import { describe, it, expect } from 'vitest';
import { renderAccountGate } from './accountGates';
import type { AccountGateOptions } from './accountGates';
import { PassphraseUnlock } from './PassphraseUnlock';

const base: AccountGateOptions = {
  schemaCompatibility: { status: 'ok', appliedVersion: 1 },
  isCheckingSchema: false,
  onRecheckSchema: () => {},
  isEncryptionSetup: true,
  isUnlocked: true,
  recoveryScreen: null,
};

/** The lazy screen inside the Suspense boundary, and which of the two it is. */
function lazyChild(element: ReturnType<typeof renderAccountGate>) {
  return (element?.props as { children?: { props?: { reset?: boolean } } } | undefined)?.children?.props;
}

describe('renderAccountGate', () => {
  it('lets an unlocked writer through when nothing is pending', () => {
    expect(renderAccountGate(base)).toBeNull();
  });

  it('requires the new passphrase before the unlock screen once a recovery key opened the vault', () => {
    const gate = renderAccountGate({ ...base, isUnlocked: false, recoveryScreen: 'reset' });
    expect(gate?.type).not.toBe(PassphraseUnlock);
    expect(lazyChild(gate)).toEqual({ reset: true });
  });


  it('never shows a recovery screen before the passphrase is set up', () => {
    const gate = renderAccountGate({ ...base, isEncryptionSetup: false, recoveryScreen: 'reset' });
    // The setup screen, not the recovery screen: no `reset` prop on the lazy child.
    expect(lazyChild(gate)).toEqual({});
  });

  it('shows the offer and the reset as different screens', () => {
    const offer = renderAccountGate({ ...base, recoveryScreen: 'offer' });
    const reset = renderAccountGate({ ...base, isUnlocked: false, recoveryScreen: 'reset' });
    expect(lazyChild(offer)).toEqual({ reset: false });
    expect(lazyChild(reset)).toEqual({ reset: true });
  });
});
