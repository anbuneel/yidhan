/**
 * Item 26: the recovery kit, through the real provider with real Web Crypto and
 * real Argon2id. Only Supabase auth and the auth context are faked, by a single
 * in-memory `user_metadata` that plays the server. The Supabase mock has no
 * tables, so any note write would throw: that is part of 26-T4.
 *
 * Test ids refer to §5 of docs/plans/2026-09-07-key-migration-and-rotation-design.md.
 */

import { useEffect } from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
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

const { mockUseAuth, mockUpdateUser, mockGetUser, mockReportReliabilityIssue, mockAddBreadcrumb } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockGetUser: vi.fn(),
  mockReportReliabilityIssue: vi.fn(),
  mockAddBreadcrumb: vi.fn(),
}));

vi.mock('./AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: mockUpdateUser,
      getUser: mockGetUser,
    },
  },
}));

vi.mock('../utils/reliabilityTelemetry', () => ({
  addReliabilityBreadcrumb: mockAddBreadcrumb,
  reportReliabilityIssue: mockReportReliabilityIssue,
}));

import { EncryptionProvider, useEncryption } from './EncryptionContext';
import type { PreparedRecoveryKit } from './EncryptionContext';
import { createKeyCheck, decryptNote, deriveKeys, encryptNote, toBase64, verifyKeyCheck } from '../lib/encryption';
import type { DerivedKeys, EncryptedNote } from '../lib/encryption';
import { buildMigratedVault, copyMasterKey } from '../lib/vaultKey';
import { readVaultMetadata } from '../lib/vaultMetadata';
import type { VaultMetadata } from '../lib/vaultMetadata';

const PASSPHRASE = 'correct horse battery staple 42';
const NEW_PASSPHRASE = 'a quiet harbour at dawn 7';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const NOTE_ID = '550e8400-e29b-41d4-a716-446655440000';
const LEGACY_SALT = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6]);

let server: Record<string, unknown>;
let legacyKeys: DerivedKeys;
let legacyMetadata: Record<string, unknown>;
let migratedVault: VaultMetadata;
let noteRow: EncryptedNote;
/** The provider's current value, updated after every render. */
const h = { ctx: null as unknown as ReturnType<typeof useEncryption> };
let generation = 0;

function serverUser() {
  return { id: USER_ID, email: 'writer@example.com', user_metadata: structuredClone(server) };
}

function applyUpdate({ data }: { data: Record<string, unknown> }) {
  server = { ...server, ...structuredClone(data) };
}

function Harness() {
  const value = useEncryption();
  useEffect(() => {
    h.ctx = value;
  });
  return null;
}

function openApp() {
  mockUseAuth.mockReturnValue({ user: serverUser() });
  return render(
    <EncryptionProvider>
      <Harness />
    </EncryptionProvider>
  );
}

/** Hand the provider the server's current user, as AuthContext does on USER_UPDATED. */
function refreshAuth(app: ReturnType<typeof openApp>) {
  mockUseAuth.mockReturnValue({ user: serverUser() });
  app.rerender(
    <EncryptionProvider>
      <Harness />
    </EncryptionProvider>
  );
}

function serverVault(): VaultMetadata {
  const read = readVaultMetadata(server.vault);
  if (read.status !== 'valid') throw new Error(`vault is ${read.status}`);
  return read.vault;
}

async function makeKit(replace = false): Promise<string> {
  let kit!: PreparedRecoveryKit;
  await act(async () => { kit = await h.ctx.prepareRecoveryKit({ replace }); });
  const displayKey = kit.displayKey;
  await act(async () => { await kit.commit(); });
  return displayKey;
}

async function expectKeysOpenNote(keys: DerivedKeys | null) {
  expect(keys).not.toBeNull();
  expect(await decryptNote(NOTE_ID, USER_ID, noteRow, keys!.encryptionKey)).toEqual({
    title: 'Before',
    content: '<p>recovery</p>',
  });
  expect(toBase64(keys!.rawEncryptionKey)).toBe(toBase64(legacyKeys.rawEncryptionKey));
  expect(toBase64(keys!.rawHashKey)).toBe(toBase64(legacyKeys.rawHashKey));
}

/** Every string telemetry was handed, for the "never logged" check. */
function telemetryText(): string {
  return JSON.stringify([
    mockReportReliabilityIssue.mock.calls.map(([event, err]) => [event, err instanceof Error ? err.message : err]),
    mockAddBreadcrumb.mock.calls,
  ]);
}

/** A passphrase unlock as a fresh tab would do it: no session to restore. */
async function freshPassphraseUnlock(passphrase: string): Promise<boolean> {
  sessionStorage.clear();
  const app = openApp();
  let ok = false;
  await act(async () => { ok = await h.ctx.unlockWithPassphrase(passphrase); });
  app.unmount();
  return ok;
}

beforeAll(async () => {
  legacyKeys = await deriveKeys(PASSPHRASE, LEGACY_SALT);
  const check = await createKeyCheck(legacyKeys.encryptionKey, USER_ID);
  legacyMetadata = {
    encryption_salt: toBase64(LEGACY_SALT),
    encryption_key_check: check.keyCheck,
    encryption_key_check_iv: check.keyCheckIv,
    encryption_key_check_version: check.keyCheckVersion,
    encryption_version: 1,
  };
  migratedVault = await buildMigratedVault({
    passphrase: PASSPHRASE,
    master: copyMasterKey(legacyKeys),
    legacySalt: LEGACY_SALT,
    userId: USER_ID,
    legacyKeyCheck: { keyCheck: check.keyCheck, keyCheckIv: check.keyCheckIv, keyCheckVersion: 2 },
  });
  noteRow = await encryptNote(NOTE_ID, USER_ID, 'Before', '<p>recovery</p>', legacyKeys);
}, 30_000);

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  server = { ...legacyMetadata, vault: structuredClone(migratedVault) };
  mockUpdateUser.mockReset();
  mockGetUser.mockReset();
  mockReportReliabilityIssue.mockReset();
  mockAddBreadcrumb.mockReset();
  const current = ++generation;
  mockUpdateUser.mockImplementation(async (arg: { data: Record<string, unknown> }) => {
    if (current !== generation) {
      return { data: { user: null }, error: { message: 'write from an earlier test' } };
    }
    applyUpdate(arg);
    return { data: { user: serverUser() }, error: null };
  });
  mockGetUser.mockImplementation(async () => ({ data: { user: serverUser() }, error: null }));
});

describe('recovery kit (item 26)', () => {
  it('26-T2 + 26-T4: kit, forgotten passphrase, recovery key, new passphrase; the old wrap is gone and no note changed', async () => {
    const rowBefore = JSON.stringify(noteRow);
    const app = openApp();
    await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    expect(h.ctx.recoveryScreen).toBe('offer');

    const recoveryKey = await makeKit();
    expect(serverVault().recoveryWrap?.recoveryVersion).toBe(1);
    const oldVault = serverVault();

    // Forget the passphrase: lock, then unlock with the recovery key.
    act(() => h.ctx.lockVault('manual'));
    refreshAuth(app);
    let status = '';
    await act(async () => { status = await h.ctx.unlockWithRecoveryKey(recoveryKey); });
    expect(status).toBe('ok');
    // Verified, but held back until the new passphrase is saved.
    expect(h.ctx.recoveryScreen).toBe('reset');
    expect(h.ctx.isUnlocked).toBe(false);
    expect(h.ctx.keys).toBeNull();
    expect(sessionStorage.length).toBe(0);

    await act(async () => { await h.ctx.setPassphraseAfterRecovery(NEW_PASSPHRASE); });
    expect(h.ctx.recoveryScreen).not.toBe('reset');
    expect(h.ctx.isUnlocked).toBe(true);
    await expectKeysOpenNote(h.ctx.keys);

    // §2.1: one write, both versions advanced, the recovery wrap carried over.
    const newVault = serverVault();
    expect(newVault.wrapVersion).toBe(oldVault.wrapVersion + 1);
    expect(newVault.keyCheckVersion).toBe(oldVault.keyCheckVersion + 1);
    expect(newVault.wrappedKey).not.toBe(oldVault.wrappedKey);
    expect(newVault.recoveryWrap).toEqual(oldVault.recoveryWrap);
    const resetWrite = mockUpdateUser.mock.calls.at(-1)![0].data;
    expect(Object.keys(resetWrite).sort()).toEqual([
      'encryption_key_check', 'encryption_key_check_iv', 'encryption_key_check_version', 'vault',
    ]);
    app.unmount();

    // The old passphrase no longer opens, on the vault or on the legacy fallback.
    expect(await freshPassphraseUnlock(PASSPHRASE)).toBe(false);
    // An old client derives from encryption_salt: the retired key-check rejects it.
    const derivedOld = await deriveKeys(PASSPHRASE, LEGACY_SALT);
    expect(await verifyKeyCheck(
      derivedOld.encryptionKey,
      server.encryption_key_check as string,
      server.encryption_key_check_iv as string,
      USER_ID,
      2
    )).toBe(false);
    // The new passphrase opens.
    expect(await freshPassphraseUnlock(NEW_PASSPHRASE)).toBe(true);

    // The recovery key still opens.
    sessionStorage.clear();
    openApp();
    await act(async () => { status = await h.ctx.unlockWithRecoveryKey(recoveryKey); });
    expect(status).toBe('ok');

    // 26-T4: nothing about the note row changed.
    expect(JSON.stringify(noteRow)).toBe(rowBefore);
    // The key never reached telemetry.
    expect(telemetryText()).not.toContain(recoveryKey);
    expect(telemetryText()).not.toContain(recoveryKey.replace(/-/g, ''));
  }, 90_000);

  it('26-T3: the key is shown once; after saving, nothing can show it again', async () => {
    openApp();
    await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    let kit!: PreparedRecoveryKit;
    await act(async () => { kit = await h.ctx.prepareRecoveryKit(); });
    const recoveryKey = kit.displayKey;
    await act(async () => { await kit.commit(); });

    // A second save of the same kit is refused: it was put away.
    await expect(kit.commit()).rejects.toThrow();
    // Not stored anywhere on the device, nor on the server.
    const stored = JSON.stringify({ ...sessionStorage, ...localStorage }) + JSON.stringify(server);
    expect(stored).not.toContain(recoveryKey);
    expect(stored).not.toContain(recoveryKey.replace(/-/g, ''));
    // The context holds no copy of it.
    expect(JSON.stringify(h.ctx)).not.toContain(recoveryKey);
    expect(Object.keys(h.ctx).some((name) => /displayKey|getRecoveryKey/.test(name))).toBe(false);
  }, 30_000);

  it('a kit that is never confirmed writes nothing', async () => {
    openApp();
    await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    let kit!: PreparedRecoveryKit;
    await act(async () => { kit = await h.ctx.prepareRecoveryKit(); });
    kit.discard();
    await expect(kit.commit()).rejects.toThrow();
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(serverVault().recoveryWrap).toBeUndefined();
  }, 30_000);

  it('a new kit replaces the old one, and the old key stops opening', async () => {
    const app = openApp();
    await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    const first = await makeKit();
    const second = await makeKit(true);
    expect(serverVault().recoveryWrap?.recoveryVersion).toBe(2);
    act(() => h.ctx.lockVault('manual'));
    refreshAuth(app);
    let status = '';
    await act(async () => { status = await h.ctx.unlockWithRecoveryKey(first); });
    expect(status).toBe('wrong');
    await act(async () => { status = await h.ctx.unlockWithRecoveryKey(second); });
    expect(status).toBe('ok');
  }, 30_000);

  it('does not offer a recovery key after a restore, after a recovery unlock, or when one exists', async () => {
    let app = openApp();
    await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    expect(h.ctx.recoveryScreen).toBe('offer');
    // A lock clears the offer: it never shows over the unlock screen.
    act(() => h.ctx.lockVault('auto-lock'));
    expect(h.ctx.recoveryScreen).toBeNull();
    await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    expect(h.ctx.recoveryScreen).toBe('offer');
    act(() => h.ctx.dismissRecoveryKeyOffer());
    expect(h.ctx.recoveryScreen).not.toBe('offer');
    const recoveryKey = await makeKit();
    app.unmount();

    // A refresh restores from sessionStorage: no passphrase, no offer.
    app = openApp();
    await waitFor(() => expect(h.ctx.isUnlocked).toBe(true));
    expect(h.ctx.recoveryScreen).not.toBe('offer');
    app.unmount();

    // A passphrase unlock on an account that already has one: no offer.
    sessionStorage.clear();
    app = openApp();
    await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    expect(h.ctx.recoveryScreen).not.toBe('offer');

    // A recovery unlock: no offer.
    act(() => h.ctx.lockVault('manual'));
    await act(async () => { await h.ctx.unlockWithRecoveryKey(recoveryKey); });
    await act(async () => { await h.ctx.setPassphraseAfterRecovery(PASSPHRASE); });
    expect(h.ctx.isUnlocked).toBe(true);
    expect(h.ctx.recoveryScreen).not.toBe('offer');
  }, 90_000);

  it('an account that has not migrated migrates first, then saves the recovery key', async () => {
    server = { ...legacyMetadata };
    openApp();
    await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    expect(h.ctx.recoveryScreen).toBe('offer');
    // prepareRecoveryKit waits for the migration this unlock started.
    const recoveryKey = await makeKit();
    const vault = serverVault();
    expect(vault.recoveryWrap).toBeDefined();
    const writes = mockUpdateUser.mock.calls.map(([arg]) => arg.data.vault);
    expect(writes[0].recoveryWrap).toBeUndefined();
    expect(writes[1].recoveryWrap).toBeDefined();
    expect(recoveryKey).toMatch(/^([A-Z2-7]{4}-){12}[A-Z2-7]{4}$/);
  }, 60_000);

  it('refuses a wrong, malformed or absent recovery key without unlocking', async () => {
    const app = openApp();
    let status = '';
    // No recovery wrap on the account yet.
    await act(async () => { status = await h.ctx.unlockWithRecoveryKey('AAAA-'.repeat(12) + 'AAAA'); });
    expect(status).toBe('unavailable');

    await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    await makeKit();
    act(() => h.ctx.lockVault('manual'));
    refreshAuth(app);

    await act(async () => { status = await h.ctx.unlockWithRecoveryKey('not a key'); });
    expect(status).toBe('invalid');
    await act(async () => { status = await h.ctx.unlockWithRecoveryKey('AAAA-'.repeat(12) + 'AAAA'); });
    expect(status).toBe('wrong');
    expect(h.ctx.recoveryScreen).not.toBe('reset');
    expect(h.ctx.isUnlocked).toBe(false);
  }, 30_000);

  it('a failed reset write changes nothing: the old passphrase and the recovery key both still open', async () => {
    const app = openApp();
    await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    const recoveryKey = await makeKit();
    const before = JSON.stringify(server);
    act(() => h.ctx.lockVault('manual'));
    refreshAuth(app);
    await act(async () => { await h.ctx.unlockWithRecoveryKey(recoveryKey); });

    mockUpdateUser.mockImplementationOnce(async () => ({ data: { user: null }, error: { message: 'offline' } }));
    await act(async () => {
      await expect(h.ctx.setPassphraseAfterRecovery(NEW_PASSPHRASE)).rejects.toMatchObject({ code: 'failed' });
    });
    // Still pending, still locked, nothing on the server moved.
    expect(h.ctx.recoveryScreen).toBe('reset');
    expect(h.ctx.isUnlocked).toBe(false);
    expect(JSON.stringify(server)).toBe(before);
    app.unmount();

    expect(await freshPassphraseUnlock(PASSPHRASE)).toBe(true);
    sessionStorage.clear();
    openApp();
    let status = '';
    await act(async () => { status = await h.ctx.unlockWithRecoveryKey(recoveryKey); });
    expect(status).toBe('ok');
  }, 60_000);

  it('a reset write that landed but reported an error is recognised on retry', async () => {
    const app = openApp();
    await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    const recoveryKey = await makeKit();
    const wrapVersion = serverVault().wrapVersion;
    act(() => h.ctx.lockVault('manual'));
    refreshAuth(app);
    await act(async () => { await h.ctx.unlockWithRecoveryKey(recoveryKey); });

    mockUpdateUser.mockImplementationOnce(async (arg: { data: Record<string, unknown> }) => {
      applyUpdate(arg);
      return { data: { user: null }, error: { message: 'network error after commit' } };
    });
    await act(async () => {
      await expect(h.ctx.setPassphraseAfterRecovery(NEW_PASSPHRASE)).rejects.toMatchObject({ code: 'failed' });
    });
    expect(serverVault().wrapVersion).toBe(wrapVersion + 1);
    // The retry finds its own write and builds on it rather than calling it a conflict.
    await act(async () => { await h.ctx.setPassphraseAfterRecovery(NEW_PASSPHRASE); });
    expect(h.ctx.isUnlocked).toBe(true);
    expect(serverVault().wrapVersion).toBe(wrapVersion + 2);
    app.unmount();
    expect(await freshPassphraseUnlock(NEW_PASSPHRASE)).toBe(true);
    expect(await freshPassphraseUnlock(PASSPHRASE)).toBe(false);
  }, 90_000);

  it('a passphrase changed on another device in the meantime is not overwritten', async () => {
    const app = openApp();
    await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    const recoveryKey = await makeKit();
    act(() => h.ctx.lockVault('manual'));
    refreshAuth(app);
    await act(async () => { await h.ctx.unlockWithRecoveryKey(recoveryKey); });

    // Another device re-wraps: a different wrappedKey at the next version.
    const other = structuredClone(server.vault) as Record<string, unknown>;
    other.wrapVersion = (other.wrapVersion as number) + 1;
    other.wrappedKey = btoa(String.fromCharCode(...new Uint8Array(80).fill(3)));
    server = { ...server, vault: other };
    const before = JSON.stringify(server);

    await act(async () => {
      await expect(h.ctx.setPassphraseAfterRecovery(NEW_PASSPHRASE)).rejects.toMatchObject({ code: 'changed' });
    });
    expect(JSON.stringify(server)).toBe(before);
    // Still pending, so the screen can say why; trying again does not overwrite either.
    expect(h.ctx.recoveryScreen).toBe('reset');
    expect(h.ctx.isUnlocked).toBe(false);
    await act(async () => {
      await expect(h.ctx.setPassphraseAfterRecovery(NEW_PASSPHRASE)).rejects.toMatchObject({ code: 'changed' });
    });
    expect(JSON.stringify(server)).toBe(before);
    // Cancel leaves the recovery and drops the held keys.
    act(() => h.ctx.cancelRecovery());
    expect(h.ctx.recoveryScreen).not.toBe('reset');
    expect(h.ctx.isUnlocked).toBe(false);
  }, 60_000);

  it('a lock while the reset is pending drops the held keys', async () => {
    const app = openApp();
    await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    const recoveryKey = await makeKit();
    act(() => h.ctx.lockVault('manual'));
    refreshAuth(app);
    await act(async () => { await h.ctx.unlockWithRecoveryKey(recoveryKey); });
    expect(h.ctx.recoveryScreen).toBe('reset');
    act(() => h.ctx.lockVault('manual'));
    expect(h.ctx.recoveryScreen).not.toBe('reset');
    await act(async () => {
      await expect(h.ctx.setPassphraseAfterRecovery(NEW_PASSPHRASE)).rejects.toThrow();
    });
    expect(h.ctx.isUnlocked).toBe(false);
  }, 30_000);

  it('the new passphrase must meet the passphrase policy', async () => {
    const app = openApp();
    await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    const recoveryKey = await makeKit();
    act(() => h.ctx.lockVault('manual'));
    refreshAuth(app);
    await act(async () => { await h.ctx.unlockWithRecoveryKey(recoveryKey); });
    const writes = mockUpdateUser.mock.calls.length;
    await act(async () => {
      await expect(h.ctx.setPassphraseAfterRecovery('short')).rejects.toThrow();
    });
    expect(mockUpdateUser.mock.calls.length).toBe(writes);
    expect(h.ctx.recoveryScreen).toBe('reset');
  }, 30_000);

  describe('review findings', () => {
    it('a lock while the new passphrase is being saved never writes a vault of zeroed key bytes', async () => {
      const app = openApp();
      await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
      const recoveryKey = await makeKit();
      act(() => h.ctx.lockVault('manual'));
      refreshAuth(app);
      await act(async () => { await h.ctx.unlockWithRecoveryKey(recoveryKey); });
      const before = JSON.stringify(server);

      let saving!: Promise<void>;
      act(() => { saving = h.ctx.setPassphraseAfterRecovery(NEW_PASSPHRASE); });
      // Locked while Argon2id runs: the held K is zeroed in place.
      act(() => h.ctx.lockVault('sign-out'));
      await act(async () => { await expect(saving).rejects.toThrow(); });

      expect(JSON.stringify(server)).toBe(before);
      app.unmount();
      expect(await freshPassphraseUnlock(PASSPHRASE)).toBe(true);
    }, 60_000);

    it('a kit put away while saving never writes a wrap of zeroed bytes', async () => {
      openApp();
      await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
      let kit!: PreparedRecoveryKit;
      await act(async () => { kit = await h.ctx.prepareRecoveryKit(); });
      const saving = kit.commit();
      kit.discard();
      await act(async () => { await expect(saving).rejects.toThrow(); });
      expect(serverVault().recoveryWrap).toBeUndefined();
    }, 30_000);

    it('does not silently replace a recovery key made on another device', async () => {
      const app = openApp();
      await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
      const first = await makeKit();
      // This tab's offer was decided before the other key existed.
      await act(async () => {
        await expect(h.ctx.prepareRecoveryKit()).rejects.toMatchObject({ code: 'exists' });
      });
      // Settings asks to replace, and that works.
      let kit!: PreparedRecoveryKit;
      await act(async () => { kit = await h.ctx.prepareRecoveryKit({ replace: true }); });
      await act(async () => { await kit.commit(); });
      act(() => h.ctx.lockVault('manual'));
      refreshAuth(app);
      let status = '';
      await act(async () => { status = await h.ctx.unlockWithRecoveryKey(first); });
      expect(status).toBe('wrong');
    }, 30_000);

    it('a kit whose stored wrap changed after it was shown is not saved over it', async () => {
      openApp();
      await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
      let kit!: PreparedRecoveryKit;
      await act(async () => { kit = await h.ctx.prepareRecoveryKit(); });
      // Another device saves a key meanwhile.
      const other = await makeKit(true);
      await act(async () => {
        await expect(kit.commit()).rejects.toMatchObject({ code: 'changed' });
      });
      act(() => h.ctx.lockVault('manual'));
      let status = '';
      await act(async () => { status = await h.ctx.unlockWithRecoveryKey(other); });
      expect(status).toBe('ok');
    }, 30_000);

    it('a failed migration shows no recovery key that could never be saved', async () => {
      server = { ...legacyMetadata };
      mockUpdateUser.mockImplementationOnce(async () => ({ data: { user: null }, error: { message: 'offline' } }));
      openApp();
      await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
      expect(h.ctx.recoveryScreen).toBe('offer');
      await act(async () => {
        await expect(h.ctx.prepareRecoveryKit()).rejects.toMatchObject({ code: 'not-ready' });
      });
    }, 30_000);

    it('a kit write that landed but reported an error is recognised on retry', async () => {
      openApp();
      await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
      let kit!: PreparedRecoveryKit;
      await act(async () => { kit = await h.ctx.prepareRecoveryKit(); });
      mockUpdateUser.mockImplementationOnce(async (arg: { data: Record<string, unknown> }) => {
        applyUpdate(arg);
        return { data: { user: null }, error: { message: 'network error after commit' } };
      });
      await act(async () => { await expect(kit.commit()).rejects.toMatchObject({ code: 'failed' }); });
      const stored = serverVault().recoveryWrap;
      await act(async () => { await kit.commit(); });
      // Not written twice: the retry saw its own wrap.
      expect(serverVault().recoveryWrap).toEqual(stored);
    }, 30_000);
  });
});
