/**
 * Item 26: where the recovery screens sit among the account gates.
 */

import { describe, it, expect } from 'vitest';
import { renderAccountGate } from './accountGates';
import type { AccountGateOptions } from './accountGates';
import { PassphraseUnlock } from './PassphraseUnlock';
import { DatabaseUpdatePending } from './DatabaseUpdatePending';

const base: AccountGateOptions = {
  schemaCompatibility: { status: 'ok', appliedVersion: 1 },
  isCheckingSchema: false,
  onRecheckSchema: () => {},
  isEncryptionSetup: true,
  isUnlocked: true,
  recoveryScreen: null,
  setupScreen: false,
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

  describe('the three-step setup (item 27)', () => {
    /** The lazy setup screen has no props; the recovery screen always has `reset`. */
    function isSetup(element: ReturnType<typeof renderAccountGate>) {
      return element !== null && element.type !== PassphraseUnlock && lazyChild(element) !== undefined
        && !('reset' in (lazyChild(element) ?? {}));
    }

    it('shows the setup to an account with no vault', () => {
      expect(isSetup(renderAccountGate({ ...base, isEncryptionSetup: false, isUnlocked: false }))).toBe(true);
    });

    it('never shows the setup to an existing account, locked or unlocked', () => {
      expect(renderAccountGate({ ...base, isUnlocked: false })?.type).toBe(PassphraseUnlock);
      expect(renderAccountGate(base)).toBeNull();
      expect(isSetup(renderAccountGate({ ...base, recoveryScreen: 'offer' }))).toBe(false);
      expect(isSetup(renderAccountGate({ ...base, isUnlocked: false, recoveryScreen: 'reset' }))).toBe(false);
    });

    it('keeps the setup up after its write lands, until the writer leaves step 3', () => {
      // Set up and unlocked, but this tab's setup has not finished: step 3, not the library.
      expect(isSetup(renderAccountGate({ ...base, setupScreen: true }))).toBe(true);
      // Not set up as far as the auth context knows yet, still the same screen.
      expect(isSetup(renderAccountGate({ ...base, isEncryptionSetup: false, setupScreen: true }))).toBe(true);
    });

    it('still puts the deployment guard first', () => {
      const gate = renderAccountGate({
        ...base,
        isEncryptionSetup: false,
        setupScreen: true,
        schemaCompatibility: { status: 'database-behind', appliedVersion: 1, requiredVersion: 2 },
      });
      expect(gate?.type).toBe(DatabaseUpdatePending);
    });
  });
});
