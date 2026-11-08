/**
 * Recovery key (item 26) and the passphrase re-wrap it runs (§2.1), with real Web
 * Crypto and real Argon2id.
 *
 * Test ids refer to §5 of docs/plans/2026-09-07-key-migration-and-rotation-design.md.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      writable: true,
      configurable: true,
    });
  }
});

import {
  createKeyCheck,
  decryptNote,
  deriveKeys,
  encryptNote,
  toBase64,
  verifyKeyCheck,
} from '../encryption';
import type { DerivedKeys } from '../encryption';
import { buildMigratedVault, copyMasterKey, deriveKek, rewrapVault, unlockVault, unwrapMasterKey } from '../vaultKey';
import { openVaultWithRecoveryKey, unwrapWithRecoveryKey, wrapWithRecoveryKey } from '../recoveryKey';
import { formatRecoveryKey, generateRecoveryKey, parseRecoveryKey, recoveryKeysMatch } from '../recoveryKeyFormat';
import { readRecoveryWrap, readVaultMetadata } from '../vaultMetadata';
import type { VaultMetadata } from '../vaultMetadata';

const PASSPHRASE = 'correct horse battery staple 42';
const NEW_PASSPHRASE = 'a quiet harbour at dawn 7';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const OTHER_USER_ID = '770e8400-e29b-41d4-a716-446655440002';
const NOTE_ID = '550e8400-e29b-41d4-a716-446655440000';
const LEGACY_SALT = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6]);

let legacyKeys: DerivedKeys;
let vault: VaultMetadata;

beforeAll(async () => {
  legacyKeys = await deriveKeys(PASSPHRASE, LEGACY_SALT);
  const check = await createKeyCheck(legacyKeys.encryptionKey, USER_ID);
  vault = await buildMigratedVault({
    passphrase: PASSPHRASE,
    master: copyMasterKey(legacyKeys),
    legacySalt: LEGACY_SALT,
    userId: USER_ID,
    legacyKeyCheck: { keyCheck: check.keyCheck, keyCheckIv: check.keyCheckIv, keyCheckVersion: 2 },
  });
}, 30_000);

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

describe('recovery key format', () => {
  it('is 52 base32 characters in thirteen groups of four, and round-trips', () => {
    for (let i = 0; i < 50; i++) {
      const rk = generateRecoveryKey();
      const text = formatRecoveryKey(rk);
      expect(text).toMatch(/^([A-Z2-7]{4}-){12}[A-Z2-7]{4}$/);
      expect(bytesEqual(parseRecoveryKey(text)!, rk)).toBe(true);
    }
  });

  it('reads a key typed with spaces, lower case and misread digits', () => {
    const rk = new Uint8Array(32).fill(0);
    rk[0] = 0b0111_0000; // the first character is O
    const text = formatRecoveryKey(rk);
    expect(text.startsWith('O')).toBe(true);
    const sloppy = `  ${text.replace(/-/g, ' ').toLowerCase().replace(/^o/, '0')}  `;
    expect(bytesEqual(parseRecoveryKey(sloppy)!, rk)).toBe(true);
  });

  it('rejects anything that is not exactly one key', () => {
    const text = formatRecoveryKey(generateRecoveryKey());
    expect(parseRecoveryKey('')).toBeNull();
    expect(parseRecoveryKey(text.slice(0, -1))).toBeNull();
    expect(parseRecoveryKey(`${text}A`)).toBeNull();
    expect(parseRecoveryKey(text.replace(/^./, '!'))).toBeNull();
    expect(parseRecoveryKey(PASSPHRASE)).toBeNull();
  });

  it('rejects a last character whose spare bits are not zero', () => {
    const text = formatRecoveryKey(new Uint8Array(32));
    // The last character carries one key bit and four zero bits: 'A' or 'Q' only.
    expect(text.endsWith('A')).toBe(true);
    expect(parseRecoveryKey(`${text.slice(0, -1)}Q`)).not.toBeNull();
    expect(parseRecoveryKey(`${text.slice(0, -1)}B`)).toBeNull();
  });

  it('compares keys by bytes, not by spelling', () => {
    const text = formatRecoveryKey(generateRecoveryKey());
    expect(recoveryKeysMatch(text.toLowerCase().replace(/-/g, ' '), text)).toBe(true);
    expect(recoveryKeysMatch(formatRecoveryKey(generateRecoveryKey()), text)).toBe(false);
    expect(recoveryKeysMatch('', text)).toBe(false);
  });
});

describe('recovery wrap', () => {
  it('26-T1: RK unwraps the same K the passphrase wrap holds', async () => {
    const rk = generateRecoveryKey();
    const master = copyMasterKey(legacyKeys);
    const recoveryWrap = await wrapWithRecoveryKey(rk, master, USER_ID, 1);

    const viaRecovery = await unwrapWithRecoveryKey(rk, recoveryWrap, USER_ID);
    const viaPassphrase = await unwrapMasterKey(await deriveKek(PASSPHRASE, Uint8Array.from(atob(vault.kekSalt), (c) => c.charCodeAt(0))), vault, USER_ID);
    expect(viaRecovery).not.toBeNull();
    expect(toBase64(viaRecovery!)).toBe(toBase64(viaPassphrase));
    expect(toBase64(viaRecovery!)).toBe(toBase64(master));
  });

  it('opens the vault only after the vault key-check verifies, and the keys decrypt a note', async () => {
    const rk = generateRecoveryKey();
    const recoveryWrap = await wrapWithRecoveryKey(rk, copyMasterKey(legacyKeys), USER_ID, 1);
    const note = await encryptNote(NOTE_ID, USER_ID, 'Kept', '<p>words</p>', legacyKeys);

    const keys = await openVaultWithRecoveryKey(rk, { ...vault, recoveryWrap }, USER_ID, LEGACY_SALT);
    expect(keys).not.toBeNull();
    expect(await decryptNote(NOTE_ID, USER_ID, note, keys!.encryptionKey)).toEqual({ title: 'Kept', content: '<p>words</p>' });

    // A wrap that opens to bytes the key-check rejects does not unlock.
    const other = await wrapWithRecoveryKey(rk, new Uint8Array(64).fill(7), USER_ID, 1);
    expect(await openVaultWithRecoveryKey(rk, { ...vault, recoveryWrap: other }, USER_ID, LEGACY_SALT)).toBeNull();
  });

  it('does not open with another key, for another user, or at another recovery version', async () => {
    const rk = generateRecoveryKey();
    const recoveryWrap = await wrapWithRecoveryKey(rk, copyMasterKey(legacyKeys), USER_ID, 2);
    expect(await unwrapWithRecoveryKey(generateRecoveryKey(), recoveryWrap, USER_ID)).toBeNull();
    expect(await unwrapWithRecoveryKey(rk, recoveryWrap, OTHER_USER_ID)).toBeNull();
    expect(await unwrapWithRecoveryKey(rk, { ...recoveryWrap, recoveryVersion: 1 }, USER_ID)).toBeNull();
    expect(await openVaultWithRecoveryKey(rk, vault, USER_ID, LEGACY_SALT)).toBeNull();
  });

  it('is not interchangeable with the passphrase wrap', async () => {
    // Same key bytes used as a KEK on the passphrase wrap's AAD: does not open.
    const rk = generateRecoveryKey();
    const recoveryWrap = await wrapWithRecoveryKey(rk, copyMasterKey(legacyKeys), USER_ID, 1);
    const asKek = await crypto.subtle.importKey('raw', rk as BufferSource, { name: 'AES-GCM' }, false, ['decrypt']);
    await expect(unwrapMasterKey(asKek, {
      wrappedKey: recoveryWrap.wrappedKey,
      wrapIv: recoveryWrap.wrapIv,
      wrapVersion: recoveryWrap.recoveryVersion,
    }, USER_ID)).rejects.toThrow();
  });

  it('reads back as a valid recovery wrap inside a valid vault', async () => {
    const recoveryWrap = await wrapWithRecoveryKey(generateRecoveryKey(), copyMasterKey(legacyKeys), USER_ID, 1);
    const read = readVaultMetadata({ ...vault, recoveryWrap });
    expect(read.status).toBe('valid');
    expect(read.status === 'valid' && read.vault.recoveryWrap).toEqual(recoveryWrap);
  });

  it('classifies a newer or broken recovery wrap without dropping the vault', async () => {
    const recoveryWrap = await wrapWithRecoveryKey(generateRecoveryKey(), copyMasterKey(legacyKeys), USER_ID, 1);
    expect(readRecoveryWrap(undefined).status).toBe('absent');
    expect(readRecoveryWrap({ ...recoveryWrap, version: 2 }).status).toBe('unsupported');
    expect(readRecoveryWrap({ ...recoveryWrap, wrapIv: 'x' }).status).toBe('malformed');
    expect(readRecoveryWrap('nope').status).toBe('malformed');
    // The passphrase vault still reads as valid; it just has no usable recovery wrap.
    const read = readVaultMetadata({ ...vault, recoveryWrap: { ...recoveryWrap, version: 2 } });
    expect(read.status).toBe('valid');
    expect(read.status === 'valid' && read.vault.recoveryWrap).toBeUndefined();
  });
});

describe('rewrapVault (§2.1, run by the recovery path)', () => {
  let rewrapped: Awaited<ReturnType<typeof rewrapVault>>;

  beforeAll(async () => {
    rewrapped = await rewrapVault({
      passphrase: NEW_PASSPHRASE,
      master: copyMasterKey(legacyKeys),
      vault,
      legacySalt: LEGACY_SALT,
      userId: USER_ID,
    });
  }, 30_000);

  it('changes the wrap, not K, and advances both versions by one', async () => {
    const next = { ...rewrapped.vault } as VaultMetadata;
    expect(next.wrapVersion).toBe(vault.wrapVersion + 1);
    expect(next.keyCheckVersion).toBe(vault.keyCheckVersion + 1);
    expect(next.kekSalt).not.toBe(vault.kekSalt);
    expect(next.wrappedKey).not.toBe(vault.wrappedKey);
    expect(next.migratedAt).toBe(vault.migratedAt);

    const keys = await unlockVault(NEW_PASSPHRASE, next, USER_ID, LEGACY_SALT);
    expect(keys).not.toBeNull();
    expect(toBase64(keys!.rawEncryptionKey)).toBe(toBase64(legacyKeys.rawEncryptionKey));
    expect(toBase64(keys!.rawHashKey)).toBe(toBase64(legacyKeys.rawHashKey));
  }, 30_000);

  it('the old passphrase no longer opens the new vault', async () => {
    expect(await unlockVault(PASSPHRASE, rewrapped.vault as VaultMetadata, USER_ID, LEGACY_SALT)).toBeNull();
  }, 30_000);

  it('retires the legacy key-check: neither the old nor the new passphrase verifies it', async () => {
    const retired = rewrapped.retiredLegacyKeyCheck;
    expect(retired.encryption_key_check_version).toBe(2);
    for (const passphrase of [PASSPHRASE, NEW_PASSPHRASE]) {
      const derived = await deriveKeys(passphrase, LEGACY_SALT);
      expect(await verifyKeyCheck(
        derived.encryptionKey,
        retired.encryption_key_check,
        retired.encryption_key_check_iv,
        USER_ID,
        2
      )).toBe(false);
    }
  }, 30_000);

  it('refuses to re-wrap bytes that do not verify the vault key-check', async () => {
    await expect(rewrapVault({
      passphrase: NEW_PASSPHRASE,
      master: new Uint8Array(64),
      vault,
      legacySalt: LEGACY_SALT,
      userId: USER_ID,
    })).rejects.toThrow(/refusing/);
  });
});
