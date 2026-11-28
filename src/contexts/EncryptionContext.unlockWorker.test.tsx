/**
 * Shell-size plan C1: Argon2id runs in a worker, so the unlock screen is live while
 * it does, and a lock, sign-out, account switch or second attempt can land in the
 * middle. These tests check that none of them lets a late derivation unlock.
 *
 * Real provider, real Web Crypto, real Argon2id at the real parameters, behind a
 * fake Worker (jsdom has none; src/test/fakeArgon2Worker.ts runs the worker's real
 * handler). Only Supabase auth and the auth context are faked.
 */

import { useEffect } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { webcrypto } from 'node:crypto';

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, writable: true, configurable: true });
  }
});

const { mockUseAuth, mockUpdateUser, mockGetUser, mockReportReliabilityIssue, mockAddBreadcrumb } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockGetUser: vi.fn(),
  mockReportReliabilityIssue: vi.fn(),
  mockAddBreadcrumb: vi.fn(),
}));

vi.mock('./AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { updateUser: mockUpdateUser, getUser: mockGetUser } },
}));
vi.mock('../utils/reliabilityTelemetry', () => ({
  addReliabilityBreadcrumb: mockAddBreadcrumb,
  reportReliabilityIssue: mockReportReliabilityIssue,
}));

import { EncryptionProvider, useEncryption } from './EncryptionContext';
import { createKeyCheck, deriveKeys, toBase64 } from '../lib/encryption';
import { buildMigratedVault, copyMasterKey } from '../lib/vaultKey';
import { KdfCancelledError, cancelArgon2Derivations } from '../lib/argon2';
import type { VaultMetadata } from '../lib/vaultMetadata';
import { FakeArgon2Worker, installFakeArgon2Worker, resetFakeArgon2Worker, usedWorkers } from '../test/fakeArgon2Worker';

const PASSPHRASE = 'correct horse battery staple 42';
const OTHER_PASSPHRASE = 'a quiet harbour at dawn 7';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const OTHER_USER_ID = '660e8400-e29b-41d4-a716-446655440002';
const SALT = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6]);
const OTHER_SALT = new Uint8Array(16).fill(4);

/** Legacy (unmigrated) metadata and a migrated vault for each passphrase. */
let legacy: Record<string, Record<string, unknown>>;
let vaults: Record<string, VaultMetadata>;
let server: Record<string, unknown>;
let userId = USER_ID;
const h = { ctx: null as unknown as ReturnType<typeof useEncryption> };

function serverUser() {
  return { id: userId, email: 'writer@example.com', user_metadata: structuredClone(server) };
}

function Harness() {
  const value = useEncryption();
  useEffect(() => {
    h.ctx = value;
  });
  return null;
}

const tree = () => (
  <EncryptionProvider>
    <Harness />
  </EncryptionProvider>
);

function openApp() {
  mockUseAuth.mockReturnValue({ user: serverUser() });
  return render(tree());
}

function rerenderWithUser(app: ReturnType<typeof openApp>, user: ReturnType<typeof serverUser> | null) {
  mockUseAuth.mockReturnValue({ user });
  app.rerender(tree());
}

async function accountFor(passphrase: string, salt: Uint8Array, forUser: string) {
  const keys = await deriveKeys(passphrase, salt);
  const check = await createKeyCheck(keys.encryptionKey, forUser);
  const metadata = {
    encryption_salt: toBase64(salt),
    encryption_key_check: check.keyCheck,
    encryption_key_check_iv: check.keyCheckIv,
    encryption_key_check_version: check.keyCheckVersion,
    encryption_version: 1,
  };
  const vault = await buildMigratedVault({
    passphrase,
    master: copyMasterKey(keys),
    legacySalt: salt,
    userId: forUser,
    legacyKeyCheck: { keyCheck: check.keyCheck, keyCheckIv: check.keyCheckIv, keyCheckVersion: 2 },
  });
  return { metadata, vault };
}

/** Start an unlock whose derivation is held in its worker until released. */
async function startHeldUnlock(passphrase = PASSPHRASE) {
  FakeArgon2Worker.hold = true;
  const before = usedWorkers().length;
  let settled: { ok: boolean } | { error: unknown } | null = null;
  let promise!: Promise<boolean>;
  act(() => {
    promise = h.ctx.unlockWithPassphrase(passphrase);
  });
  promise.then(
    (ok) => { settled = { ok }; },
    (error: unknown) => { settled = { error }; }
  );
  // `?? null`: before the worker exists the held reply is undefined, which
  // `not.toBeNull()` would accept at once.
  await waitFor(() => expect(usedWorkers()[before]?.held ?? null).not.toBeNull(), { timeout: 20_000 });
  return { worker: usedWorkers()[before], promise, settled: () => settled };
}

beforeAll(async () => {
  const mine = await accountFor(PASSPHRASE, SALT, USER_ID);
  const changed = await accountFor(OTHER_PASSPHRASE, OTHER_SALT, USER_ID);
  legacy = { mine: mine.metadata, changed: changed.metadata };
  vaults = { mine: mine.vault, changed: changed.vault };
}, 60_000);

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  userId = USER_ID;
  server = { ...legacy.mine, vault: structuredClone(vaults.mine) };
  mockUpdateUser.mockReset();
  mockGetUser.mockReset();
  mockReportReliabilityIssue.mockReset();
  mockAddBreadcrumb.mockReset();
  mockUpdateUser.mockResolvedValue({ data: { user: serverUser() }, error: null });
  mockGetUser.mockImplementation(async () => ({ data: { user: serverUser() }, error: null }));
  installFakeArgon2Worker();
});

afterEach(() => {
  // A test that failed mid-derivation must not leave a pending unlock or a
  // mounted provider for the next one.
  cancelArgon2Derivations();
  cleanup();
  resetFakeArgon2Worker();
});

describe('passphrase unlock through the worker', () => {
  it('unlocks, and the worker that derived the key is terminated', async () => {
    const app = openApp();
    let ok = false;
    await act(async () => { ok = await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    expect(ok).toBe(true);
    expect(h.ctx.isUnlocked).toBe(true);
    expect(usedWorkers().length).toBeGreaterThan(0);
    expect(usedWorkers().every((w) => w.terminated)).toBe(true);
    app.unmount();
  }, 30_000);

  it('a wrong passphrase still fails the key check', async () => {
    const app = openApp();
    let ok = true;
    await act(async () => { ok = await h.ctx.unlockWithPassphrase('not the passphrase at all'); });
    expect(ok).toBe(false);
    expect(h.ctx.isUnlocked).toBe(false);
    expect(sessionStorage.length).toBe(0);
    app.unmount();
  }, 30_000);

  it('a legacy account (no vault) unlocks through the worker too', async () => {
    server = { ...legacy.mine };
    const app = openApp();
    let ok = false;
    await act(async () => { ok = await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    expect(ok).toBe(true);
    expect(h.ctx.isUnlocked).toBe(true);
    app.unmount();
  }, 30_000);
});

describe('nothing unlocks after the derivation was overtaken', () => {
  for (const reason of ['manual', 'sign-out', 'auto-lock'] as const) {
    it(`lockVault('${reason}') during the derivation: terminated, no unlock, no late state`, async () => {
      const app = openApp();
      const { worker, settled } = await startHeldUnlock();

      act(() => h.ctx.lockVault(reason));
      expect(worker.terminated).toBe(true);
      await waitFor(() => expect(settled()).not.toBeNull());
      expect(settled()).toEqual({ error: expect.any(KdfCancelledError) });

      // The real answer arriving now changes nothing.
      worker.release();
      await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
      expect(h.ctx.isUnlocked).toBe(false);
      expect(h.ctx.keys).toBeNull();
      expect(h.ctx.recoveryScreen).toBeNull();
      expect(sessionStorage.length).toBe(0);
      expect(mockReportReliabilityIssue).not.toHaveBeenCalled();
      app.unmount();
    }, 30_000);
  }

  it('signing out (user becomes null) during the derivation', async () => {
    const app = openApp();
    const { worker, settled } = await startHeldUnlock();
    rerenderWithUser(app, null);
    await waitFor(() => expect(worker.terminated).toBe(true));
    await waitFor(() => expect(settled()).toEqual({ error: expect.any(KdfCancelledError) }));
    worker.release();
    expect(h.ctx.isUnlocked).toBe(false);
    expect(sessionStorage.length).toBe(0);
    app.unmount();
  }, 30_000);

  it('switching account during the derivation installs nothing into the new one', async () => {
    const app = openApp();
    const { worker, settled } = await startHeldUnlock();
    userId = OTHER_USER_ID;
    rerenderWithUser(app, serverUser());
    await waitFor(() => expect(worker.terminated).toBe(true));
    await waitFor(() => expect(settled()).toEqual({ error: expect.any(KdfCancelledError) }));
    worker.release();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(h.ctx.isUnlocked).toBe(false);
    expect(h.ctx.keys).toBeNull();
    expect(sessionStorage.length).toBe(0);
    app.unmount();
  }, 30_000);

  it('a second attempt while one runs: only the newer one unlocks, once', async () => {
    const app = openApp();
    const first = await startHeldUnlock();
    const second = await startHeldUnlock();
    expect(second.worker).not.toBe(first.worker);

    // The older one answers last, after the newer one has unlocked.
    await act(async () => { second.worker.release(); await second.promise; });
    expect(second.settled()).toEqual({ ok: true });
    const installed = h.ctx.keys;
    expect(installed).not.toBeNull();

    await act(async () => { first.worker.release(); await first.promise.catch(() => undefined); });
    expect(first.settled()).toEqual({ error: expect.any(KdfCancelledError) });
    expect(h.ctx.keys).toBe(installed);
    expect(h.ctx.isUnlocked).toBe(true);
    app.unmount();
  }, 60_000);

  it('a second attempt that answers first does not let the older wrong one count', async () => {
    const app = openApp();
    const first = await startHeldUnlock('not the passphrase at all');
    const second = await startHeldUnlock();
    // A wrong passphrase on a vault account also tries the legacy derivation, so
    // let any derivation started from here answer at once.
    FakeArgon2Worker.hold = false;
    await act(async () => { first.worker.release(); await first.promise.catch(() => undefined); });
    // Superseded: neither a wrong passphrase nor an unlock.
    expect(first.settled()).toEqual({ error: expect.any(KdfCancelledError) });
    expect(h.ctx.isUnlocked).toBe(false);
    await act(async () => { second.worker.release(); await second.promise; });
    expect(h.ctx.isUnlocked).toBe(true);
    app.unmount();
  }, 60_000);
});

describe('a cancellation before or around the derivation', () => {
  it('a lock during the vault chunk load starts no derivation with that passphrase', async () => {
    const app = openApp();
    let outcome: unknown = null;
    act(() => {
      h.ctx.unlockWithPassphrase(PASSPHRASE).then(
        (ok) => { outcome = ok; },
        (err: unknown) => { outcome = err; }
      );
      // Same tick: the vault chunk has not loaded yet.
      h.ctx.lockVault('manual');
    });
    await waitFor(() => expect(outcome).toBeInstanceOf(KdfCancelledError));
    expect(usedWorkers()).toHaveLength(0);
    expect(h.ctx.isUnlocked).toBe(false);
    app.unmount();
  }, 30_000);

  it('a lock during account setup cancels its derivation and reports nothing', async () => {
    server = {};
    const app = openApp();
    FakeArgon2Worker.hold = true;
    let outcome: unknown = null;
    act(() => {
      h.ctx.beginAccountSetup(PASSPHRASE).then(
        () => { outcome = 'resolved'; },
        (err: unknown) => { outcome = err; }
      );
    });
    await waitFor(() => expect(usedWorkers()[0]?.held ?? null).not.toBeNull(), { timeout: 20_000 });
    act(() => h.ctx.lockVault('sign-out'));
    await waitFor(() => expect(outcome).toBeInstanceOf(KdfCancelledError));
    expect(usedWorkers()[0].terminated).toBe(true);
    expect(mockReportReliabilityIssue).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
    app.unmount();
  }, 30_000);
});

describe('restore still verifies the key check', () => {
  async function unlockOnce() {
    const app = openApp();
    await act(async () => { await h.ctx.unlockWithPassphrase(PASSPHRASE); });
    expect(h.ctx.isUnlocked).toBe(true);
    app.unmount();
  }

  it('a stale key in sessionStorage after a passphrase change elsewhere stays locked', async () => {
    await unlockOnce();
    expect(sessionStorage.length).toBeGreaterThan(0);
    // Another device changed the passphrase and the account now holds another key.
    server = { ...legacy.changed, vault: structuredClone(vaults.changed) };
    const app = openApp();
    await waitFor(() => expect(sessionStorage.length).toBe(0));
    expect(h.ctx.isUnlocked).toBe(false);
    expect(h.ctx.keys).toBeNull();
    app.unmount();
  }, 30_000);

  it('a stale remembered key in localStorage stays locked', async () => {
    localStorage.setItem(`yidhan-${USER_ID}-vault-remember-browser`, 'true');
    await unlockOnce();
    const remembered = `yidhan-${USER_ID}-vault-persisted-keys`;
    expect(localStorage.getItem(remembered)).not.toBeNull();
    sessionStorage.clear();
    server = { ...legacy.changed, vault: structuredClone(vaults.changed) };
    const app = openApp();
    await waitFor(() => expect(localStorage.getItem(remembered)).toBeNull());
    expect(h.ctx.isUnlocked).toBe(false);
    expect(h.ctx.keys).toBeNull();
    app.unmount();
  }, 30_000);
});
