/**
 * Wrapped master key (item 24) — real Web Crypto and real Argon2id.
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
  ARGON2_PARAMS,
  computeContentHash,
  createKeyCheck,
  decryptNote,
  deriveKeys,
  encryptNote,
  fromBase64,
  toBase64,
  verifyKeyCheck,
} from '../encryption';
import type { DerivedKeys } from '../encryption';
import {
  INITIAL_WRAP_VERSION,
  KEK_ARGON2_PARAMS,
  VAULT_VERSION,
  buildMigratedVault,
  copyMasterKey,
  deriveKek,
  deriveKekBytes,
  importKek,
  importMasterKey,
  readVaultMetadata,
  selectKeyCheck,
  unlockVault,
  unwrapMasterKey,
  wrapMasterKey,
} from '../vaultKey';
import type { VaultMetadata } from '../vaultKey';

const PASSPHRASE = 'correct horse battery staple 42';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const OTHER_USER_ID = '770e8400-e29b-41d4-a716-446655440002';
const NOTE_ID = '550e8400-e29b-41d4-a716-446655440000';
const LEGACY_SALT = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6]);

interface LegacyAccount {
  keys: DerivedKeys;
  keyCheck: { keyCheck: string; keyCheckIv: string; keyCheckVersion: 2 };
}

async function legacyAccount(): Promise<LegacyAccount> {
  const keys = await deriveKeys(PASSPHRASE, LEGACY_SALT);
  const check = await createKeyCheck(keys.encryptionKey, USER_ID);
  return {
    keys,
    keyCheck: { keyCheck: check.keyCheck, keyCheckIv: check.keyCheckIv, keyCheckVersion: 2 },
  };
}

async function migrate(account: LegacyAccount): Promise<VaultMetadata> {
  return buildMigratedVault({
    passphrase: PASSPHRASE,
    master: copyMasterKey(account.keys),
    legacySalt: LEGACY_SALT,
    userId: USER_ID,
    legacyKeyCheck: account.keyCheck,
  });
}

// One legacy account and one migration shared by the slow tests: each Argon2id
// derivation is 64 MB and hundreds of milliseconds.
let account: LegacyAccount;
let vault: VaultMetadata;

beforeAll(async () => {
  account = await legacyAccount();
  vault = await migrate(account);
}, 60_000);

describe('vaultKey', () => {
  it('24-T1: both halves of K survive the wrap, and a pre-migration note still opens with the same content hash', async () => {
    const before = await encryptNote(NOTE_ID, USER_ID, 'Title', '<p>Body</p>', account.keys);

    const unlocked = await unlockVault(PASSPHRASE, vault, USER_ID, LEGACY_SALT);
    expect(unlocked).not.toBeNull();
    const keys = unlocked!;

    // AES half and HMAC half are byte-identical to the legacy derivation.
    expect(toBase64(keys.rawEncryptionKey)).toBe(toBase64(account.keys.rawEncryptionKey));
    expect(toBase64(keys.rawHashKey)).toBe(toBase64(account.keys.rawHashKey));

    const decrypted = await decryptNote(NOTE_ID, USER_ID, before, keys.encryptionKey);
    expect(decrypted).toEqual({ title: 'Title', content: '<p>Body</p>' });
    expect(await computeContentHash('Title', '<p>Body</p>', keys.hashKey)).toBe(before.contentHash);
  }, 30_000);

  it('24-T2: building the vault leaves note ciphertext untouched', async () => {
    const row = await encryptNote(NOTE_ID, USER_ID, 'Untouched', '<p>Same bytes</p>', account.keys);
    const snapshot = JSON.stringify(row);

    await migrate(account);

    expect(JSON.stringify(row)).toBe(snapshot);
    const unlocked = await unlockVault(PASSPHRASE, vault, USER_ID, LEGACY_SALT);
    expect(await decryptNote(NOTE_ID, USER_ID, row, unlocked!.encryptionKey)).toEqual({
      title: 'Untouched',
      content: '<p>Same bytes</p>',
    });
  }, 30_000);

  it('24-T5: the vault key-check verifies the unwrapped K and fails with 64 other bytes', async () => {
    const unlocked = await unlockVault(PASSPHRASE, vault, USER_ID, LEGACY_SALT);
    expect(await verifyKeyCheck(unlocked!.encryptionKey, vault.keyCheck, vault.keyCheckIv, USER_ID, 2)).toBe(true);

    const other = await importMasterKey(crypto.getRandomValues(new Uint8Array(64)), LEGACY_SALT);
    expect(await verifyKeyCheck(other.encryptionKey, vault.keyCheck, vault.keyCheckIv, USER_ID, 2)).toBe(false);
  }, 30_000);

  it('24-T6: the KEK salt is not the legacy salt, and a KEK from the legacy salt does not unwrap', async () => {
    expect(vault.kekSalt).not.toBe(toBase64(LEGACY_SALT));
    expect(fromBase64(vault.kekSalt)).toHaveLength(16);

    const legacySaltKek = await deriveKek(PASSPHRASE, LEGACY_SALT);
    await expect(unwrapMasterKey(legacySaltKek, vault, USER_ID)).rejects.toThrow('did not unwrap');
  }, 30_000);

  it('24-T7: a migrated account still opens on the legacy path', async () => {
    const legacy = await deriveKeys(PASSPHRASE, LEGACY_SALT);
    expect(await verifyKeyCheck(
      legacy.encryptionKey,
      account.keyCheck.keyCheck,
      account.keyCheck.keyCheckIv,
      USER_ID,
      2
    )).toBe(true);
    const row = await encryptNote(NOTE_ID, USER_ID, 'Old client', 'still works', account.keys);
    expect(await decryptNote(NOTE_ID, USER_ID, row, legacy.encryptionKey)).toEqual({
      title: 'Old client',
      content: 'still works',
    });
  }, 30_000);

  it('24-T8: the KEK is one 32-byte AES-256-GCM key; a 64-byte derivation does not import', async () => {
    expect(KEK_ARGON2_PARAMS.hashLength).toBe(32);
    expect(ARGON2_PARAMS.hashLength).toBe(64);
    expect(KEK_ARGON2_PARAMS).toMatchObject({
      parallelism: ARGON2_PARAMS.parallelism,
      iterations: ARGON2_PARAMS.iterations,
      memorySize: ARGON2_PARAMS.memorySize,
    });

    const kekBytes = await deriveKekBytes(PASSPHRASE, fromBase64(vault.kekSalt));
    expect(kekBytes).toHaveLength(32);
    const kek = await importKek(kekBytes);
    expect(kek.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });

    const sixtyFour = await deriveKeys(PASSPHRASE, fromBase64(vault.kekSalt));
    await expect(importKek(copyMasterKey(sixtyFour))).rejects.toThrow();
  }, 30_000);

  it('rejects a wrong passphrase', async () => {
    expect(await unlockVault('a different passphrase 99', vault, USER_ID, LEGACY_SALT)).toBeNull();
  }, 30_000);

  it('binds the wrap to the user id and the wrap version', async () => {
    const kek = await deriveKek(PASSPHRASE, fromBase64(vault.kekSalt));
    await expect(unwrapMasterKey(kek, vault, OTHER_USER_ID)).rejects.toThrow('did not unwrap');
    await expect(unwrapMasterKey(kek, { ...vault, wrapVersion: vault.wrapVersion + 1 }, USER_ID))
      .rejects.toThrow('did not unwrap');
  }, 30_000);

  it('does not unlock when the wrap opens but the vault key-check does not verify', async () => {
    const otherCheck = await createKeyCheck(
      (await importMasterKey(crypto.getRandomValues(new Uint8Array(64)), LEGACY_SALT)).encryptionKey,
      USER_ID
    );
    const tampered = { ...vault, keyCheck: otherCheck.keyCheck, keyCheckIv: otherCheck.keyCheckIv };
    expect(await unlockVault(PASSPHRASE, tampered, USER_ID, LEGACY_SALT)).toBeNull();
  }, 30_000);

  it('refuses to wrap bytes that do not verify the legacy key-check (for example zeroed memory)', async () => {
    await expect(buildMigratedVault({
      passphrase: PASSPHRASE,
      master: new Uint8Array(64),
      legacySalt: LEGACY_SALT,
      userId: USER_ID,
      legacyKeyCheck: account.keyCheck,
    })).rejects.toThrow('refusing to wrap');
  }, 30_000);

  it('writes a complete version-1 vault that reads back as valid', () => {
    expect(vault).toMatchObject({
      version: VAULT_VERSION,
      wrapVersion: INITIAL_WRAP_VERSION,
      keyCheckVersion: 1,
    });
    expect(Number.isNaN(Date.parse(vault.migratedAt))).toBe(false);
    expect(readVaultMetadata(vault)).toEqual({ status: 'valid', vault });
  });

  it('does not modify the master key it is given', async () => {
    const master = copyMasterKey(account.keys);
    const copy = toBase64(master);
    await buildMigratedVault({
      passphrase: PASSPHRASE,
      master,
      legacySalt: LEGACY_SALT,
      userId: USER_ID,
      legacyKeyCheck: account.keyCheck,
    });
    expect(toBase64(master)).toBe(copy);
  }, 30_000);
});

describe('readVaultMetadata', () => {
  const b64 = (n: number) => toBase64(new Uint8Array(n).fill(1));
  const complete = {
    version: 1,
    wrapVersion: 1,
    kekSalt: b64(16),
    wrappedKey: b64(80),
    wrapIv: b64(12),
    keyCheck: b64(35),
    keyCheckIv: b64(12),
    keyCheckVersion: 1,
    migratedAt: '2026-11-07T00:00:00.000Z',
  };

  it('treats a missing vault as absent', () => {
    expect(readVaultMetadata(undefined)).toEqual({ status: 'absent' });
    expect(readVaultMetadata(null)).toEqual({ status: 'absent' });
  });

  it('accepts a complete vault', () => {
    expect(readVaultMetadata(complete).status).toBe('valid');
  });

  it('reports an unknown version as unsupported, not malformed', () => {
    expect(readVaultMetadata({ ...complete, version: 2 })).toEqual({ status: 'unsupported', version: 2 });
  });

  it.each([
    ['migratedAt missing', { migratedAt: undefined }],
    ['wrappedKey of the wrong length', { wrappedKey: b64(64) }],
    ['kekSalt not base64', { kekSalt: '***' }],
    ['wrapVersion zero', { wrapVersion: 0 }],
    ['keyCheckVersion a string', { keyCheckVersion: '1' }],
    ['keyCheck empty', { keyCheck: '' }],
  ])('reports a vault with %s as malformed', (_label, override) => {
    expect(readVaultMetadata({ ...complete, ...override }).status).toBe('malformed');
  });

  it('reports a non-object as malformed', () => {
    expect(readVaultMetadata('vault').status).toBe('malformed');
    expect(readVaultMetadata([complete]).status).toBe('malformed');
  });
});

describe('selectKeyCheck', () => {
  const legacy = {
    encryption_key_check: 'legacy-check',
    encryption_key_check_iv: 'legacy-iv',
    encryption_key_check_version: 1,
  };

  it('uses the vault key-check on a migrated account', async () => {
    expect(selectKeyCheck({ ...legacy, vault })).toEqual({
      source: 'vault',
      keyCheck: vault.keyCheck,
      keyCheckIv: vault.keyCheckIv,
      keyCheckVersion: 2,
    });
  });

  it('uses the legacy key-check when the vault is absent, unsupported or malformed', () => {
    for (const v of [undefined, { ...vault, version: 2 }, { ...vault, migratedAt: '' }]) {
      expect(selectKeyCheck({ ...legacy, vault: v })).toEqual({
        source: 'legacy',
        keyCheck: 'legacy-check',
        keyCheckIv: 'legacy-iv',
        keyCheckVersion: 1,
      });
    }
  });
});

describe('wrapMasterKey', () => {
  it('uses a fresh IV for every wrap', async () => {
    const kek = await importKek(crypto.getRandomValues(new Uint8Array(32)));
    const master = crypto.getRandomValues(new Uint8Array(64));
    const a = await wrapMasterKey(kek, master, USER_ID, 1);
    const b = await wrapMasterKey(kek, master, USER_ID, 1);
    expect(a.wrapIv).not.toBe(b.wrapIv);
    expect(a.wrappedKey).not.toBe(b.wrappedKey);
    expect(toBase64(await unwrapMasterKey(kek, { ...a, wrapVersion: 1 }, USER_ID))).toBe(toBase64(master));
  });

  it('refuses anything but 64 bytes', async () => {
    const kek = await importKek(crypto.getRandomValues(new Uint8Array(32)));
    await expect(wrapMasterKey(kek, new Uint8Array(32), USER_ID, 1)).rejects.toThrow('Invalid master key length');
  });
});
