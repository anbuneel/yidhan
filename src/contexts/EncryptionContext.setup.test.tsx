/**
 * Item 27: the three-step setup, through the real provider with real Web Crypto
 * and real Argon2id. Only Supabase auth and the auth context are faked, by a
 * single in-memory `user_metadata` that plays the server, as in
 * `EncryptionContext.recovery.test.tsx`.
 *
 * The last test drives the real `PassphraseSetup` screen through all three
 * steps against the same fake server.
 */

import { useEffect } from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
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

const {
  mockUseAuth,
  mockUpdateUser,
  mockGetUser,
  mockReportReliabilityIssue,
  mockAddBreadcrumb,
  mockCreateEncryptedNote,
  mockCreateTagOffline,
  mockAddTagToNoteOffline,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockGetUser: vi.fn(),
  mockReportReliabilityIssue: vi.fn(),
  mockAddBreadcrumb: vi.fn(),
  mockCreateEncryptedNote: vi.fn(),
  mockCreateTagOffline: vi.fn(),
  mockAddTagToNoteOffline: vi.fn(),
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

vi.mock('../services/encryptedNotes', () => ({
  createEncryptedNote: (...args: unknown[]) => mockCreateEncryptedNote(...args),
}));
vi.mock('../services/offlineTags', () => ({
  createTagOffline: (...args: unknown[]) => mockCreateTagOffline(...args),
}));
vi.mock('../services/offlineNotes', () => ({
  addTagToNoteOffline: (...args: unknown[]) => mockAddTagToNoteOffline(...args),
}));

import { EncryptionProvider, useEncryption } from './EncryptionContext';
import type { AccountSetup, PreparedRecoveryKit } from './EncryptionContext';
import { PassphraseSetup } from '../components/PassphraseSetup';
import { createKeyCheck, deriveKeys, fromBase64, toBase64, verifyKeyCheck } from '../lib/encryption';
import { parseKeyCheckVersion, readVaultMetadata } from '../lib/vaultMetadata';
import type { VaultMetadata } from '../lib/vaultMetadata';
import { generatePassphrase } from '../lib/passphraseGenerator';

const USER_ID = '770e8400-e29b-41d4-a716-446655440002';
const OTHER_USER_ID = '880e8400-e29b-41d4-a716-446655440003';

let server: Record<string, unknown>;
let passphrase: string;
const h = { ctx: null as unknown as ReturnType<typeof useEncryption> };
let generation = 0;
let signedInAs = USER_ID;

function serverUser(id = signedInAs) {
  return { id, email: 'new-writer@example.com', user_metadata: structuredClone(server) };
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

function tree(withScreen = false) {
  return (
    <EncryptionProvider>
      <Harness />
      {withScreen && <PassphraseSetup />}
    </EncryptionProvider>
  );
}

function openApp(withScreen = false) {
  mockUseAuth.mockReturnValue({ user: serverUser() });
  return render(tree(withScreen));
}

/** Hand the provider the server's current user, as AuthContext does on USER_UPDATED. */
function refreshAuth(app: ReturnType<typeof openApp>, withScreen = false) {
  mockUseAuth.mockReturnValue({ user: serverUser() });
  app.rerender(tree(withScreen));
}

function serverVault(): VaultMetadata {
  const read = readVaultMetadata(server.vault);
  if (read.status !== 'valid') throw new Error(`vault is ${read.status}`);
  return read.vault;
}

function telemetryText(): string {
  return JSON.stringify([
    mockReportReliabilityIssue.mock.calls.map(([event, err]) => [event, err instanceof Error ? err.message : err]),
    mockAddBreadcrumb.mock.calls,
  ]);
}

async function begin(): Promise<AccountSetup> {
  let setup!: AccountSetup;
  await act(async () => { setup = await h.ctx.beginAccountSetup(passphrase); });
  return setup;
}

async function commit(kit: PreparedRecoveryKit) {
  await act(async () => { await kit.commit(); });
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  server = {};
  signedInAs = USER_ID;
  passphrase = generatePassphrase();
  mockUpdateUser.mockReset();
  mockGetUser.mockReset();
  mockReportReliabilityIssue.mockReset();
  mockAddBreadcrumb.mockReset();
  mockCreateEncryptedNote.mockReset();
  mockCreateTagOffline.mockReset();
  mockAddTagToNoteOffline.mockReset();
  mockCreateTagOffline.mockResolvedValue({ id: 'tag-recipes' });
  let noteCount = 0;
  mockCreateEncryptedNote.mockImplementation(async () => ({ id: `starter-${++noteCount}` }));
  mockAddTagToNoteOffline.mockResolvedValue(undefined);
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

describe('three-step setup (item 27)', () => {
  it('writes nothing until the recovery key is confirmed, then sets the account up in one write', async () => {
    const app = openApp();
    expect(h.ctx.isEncryptionSetup).toBe(false);
    expect(h.ctx.setupScreen).toBe(false);

    const setup = await begin();
    expect(h.ctx.setupScreen).toBe(true);
    const kit = setup.prepareRecoveryKit();
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(server).toEqual({});
    expect(setup.committedKeys()).toBeNull();
    expect(h.ctx.isUnlocked).toBe(false);

    await commit(kit);
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);

    // Every field in the one write: salt, retired legacy key-check, vault with
    // its key-check and recovery wrap.
    const written = mockUpdateUser.mock.calls[0][0].data as Record<string, unknown>;
    expect(Object.keys(written).sort()).toEqual([
      'encryption_key_check',
      'encryption_key_check_iv',
      'encryption_key_check_version',
      'encryption_salt',
      'encryption_version',
      'vault',
    ]);
    const vault = serverVault();
    expect(vault.wrapVersion).toBe(1);
    expect(vault.keyCheckVersion).toBe(1);
    expect(vault.recoveryWrap?.recoveryVersion).toBe(1);

    // Set up, even before the auth context sees the new metadata, and the setup
    // screen stays up for step 3. The keys wait for the writer to leave it, so
    // the library first loads after the starter notes are written.
    expect(h.ctx.isEncryptionSetup).toBe(true);
    expect(h.ctx.setupScreen).toBe(true);
    expect(h.ctx.setupDone).toBe(true);
    expect(h.ctx.isUnlocked).toBe(false);
    const keys = setup.committedKeys()!;
    expect(await verifyKeyCheck(keys.encryptionKey, vault.keyCheck, vault.keyCheckIv, USER_ID, 2)).toBe(true);

    refreshAuth(app);
    expect(h.ctx.setupScreen).toBe(true);
    expect(h.ctx.isUnlocked).toBe(false);
    act(() => { h.ctx.finishAccountSetup(); });
    expect(h.ctx.setupScreen).toBe(false);
    expect(h.ctx.isUnlocked).toBe(true);
    expect(h.ctx.keys).toBe(keys);
    expect(h.ctx.recoveryScreen).toBeNull();
    app.unmount();

    // Neither secret left the device, in the write or in telemetry.
    const sent = JSON.stringify(mockUpdateUser.mock.calls);
    expect(sent).not.toContain(passphrase);
    expect(sent).not.toContain(kit.displayKey);
    expect(sent.replace(/-/g, '')).not.toContain(kit.displayKey.replace(/-/g, ''));
    expect(telemetryText()).not.toContain(passphrase);
    expect(telemetryText()).not.toContain(kit.displayKey);
  }, 60_000);

  it('opens on the next sign-in with the passphrase, and with the recovery key, and with nothing else', async () => {
    const first = openApp();
    const setup = await begin();
    const kit = setup.prepareRecoveryKit();
    const recoveryKey = kit.displayKey;
    await commit(kit);
    act(() => { h.ctx.finishAccountSetup(); });
    const keysAtSetup = toBase64(h.ctx.keys!.rawEncryptionKey) + toBase64(h.ctx.keys!.rawHashKey);
    first.unmount();

    // A fresh tab: no session to restore. The passphrase opens it, and since a
    // recovery key exists, no offer and no setup follow.
    sessionStorage.clear();
    const second = openApp();
    expect(h.ctx.isEncryptionSetup).toBe(true);
    expect(h.ctx.setupScreen).toBe(false);
    let ok = false;
    await act(async () => { ok = await h.ctx.unlockWithPassphrase(passphrase); });
    expect(ok).toBe(true);
    expect(toBase64(h.ctx.keys!.rawEncryptionKey) + toBase64(h.ctx.keys!.rawHashKey)).toBe(keysAtSetup);
    expect(h.ctx.recoveryScreen).toBeNull();
    expect(h.ctx.setupScreen).toBe(false);
    second.unmount();

    sessionStorage.clear();
    const third = openApp();
    let status = '';
    await act(async () => { status = await h.ctx.unlockWithRecoveryKey(recoveryKey); });
    expect(status).toBe('ok');
    expect(h.ctx.recoveryScreen).toBe('reset');
    expect(h.ctx.setupScreen).toBe(false);
    third.unmount();

    // The legacy derivation never produces a random K, and the legacy key-check
    // is a retired one: an old client answers "wrong passphrase", never opens.
    const legacy = await deriveKeys(passphrase, fromBase64(server.encryption_salt as string));
    expect(await verifyKeyCheck(
      legacy.encryptionKey,
      server.encryption_key_check as string,
      server.encryption_key_check_iv as string,
      USER_ID,
      parseKeyCheckVersion(server.encryption_key_check_version)!
    )).toBe(false);
    sessionStorage.clear();
    const fourth = openApp();
    await act(async () => { ok = await h.ctx.unlockWithPassphrase('not the passphrase at all 9'); });
    expect(ok).toBe(false);
    fourth.unmount();
  }, 90_000);

  it('leaves the account untouched when the tab closes before the recovery key is saved', async () => {
    const app = openApp();
    const setup = await begin();
    const kit = setup.prepareRecoveryKit();
    expect(kit.displayKey).toBeTruthy();
    app.unmount();
    setup.discard();

    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(server).toEqual({});
    await expect(kit.commit()).rejects.toMatchObject({ code: 'failed' });
    expect(mockUpdateUser).not.toHaveBeenCalled();

    // The next sign-in starts setup again from step 1, and it can finish.
    const next = openApp();
    expect(h.ctx.isEncryptionSetup).toBe(false);
    expect(h.ctx.setupScreen).toBe(false);
    const again = await begin();
    await commit(again.prepareRecoveryKit());
    expect(serverVault().recoveryWrap).toBeDefined();
    next.unmount();
  }, 60_000);

  it('a discarded setup zeroes its key; one discarded after its write keeps the installed keys', async () => {
    const app = openApp();
    const dropped = await begin();
    const droppedKeys = dropped.committedKeys();
    expect(droppedKeys).toBeNull();
    dropped.discard();
    expect(() => dropped.prepareRecoveryKit()).toThrow();

    const kept = await begin();
    await commit(kept.prepareRecoveryKit());
    const held = kept.committedKeys()!;
    kept.discard();
    expect(held.rawEncryptionKey.some((b) => b !== 0)).toBe(true);
    act(() => { h.ctx.finishAccountSetup(); });
    expect(h.ctx.keys).toBe(held);
    expect(h.ctx.isUnlocked).toBe(true);
    app.unmount();
  }, 60_000);

  it('never overwrites an account set up in another tab meanwhile', async () => {
    const app = openApp();
    const setup = await begin();
    const kit = setup.prepareRecoveryKit();

    // Another tab finished first.
    const elsewhere = await deriveKeys('another tab passphrase 7');
    const check = await createKeyCheck(elsewhere.encryptionKey, USER_ID);
    server = {
      encryption_salt: toBase64(elsewhere.salt),
      encryption_key_check: check.keyCheck,
      encryption_key_check_iv: check.keyCheckIv,
      encryption_key_check_version: check.keyCheckVersion,
    };
    const before = structuredClone(server);

    let caught: unknown;
    await act(async () => { await kit.commit().catch((err: unknown) => { caught = err; }); });
    expect(caught).toMatchObject({ code: 'changed' });
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(server).toEqual(before);
    expect(h.ctx.isUnlocked).toBe(false);
    app.unmount();
  }, 60_000);

  it('a write that landed but reported an error is recognised on retry, not written twice', async () => {
    const app = openApp();
    const setup = await begin();
    const kit = setup.prepareRecoveryKit();
    mockUpdateUser.mockImplementationOnce(async (arg: { data: Record<string, unknown> }) => {
      applyUpdate(arg);
      return { data: { user: null }, error: { message: 'gateway timeout' } };
    });

    let caught: unknown;
    await act(async () => { await kit.commit().catch((err: unknown) => { caught = err; }); });
    expect(caught).toMatchObject({ code: 'failed' });
    expect(setup.committedKeys()).toBeNull();

    await commit(kit);
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(setup.committedKeys()).not.toBeNull();
    expect(h.ctx.setupScreen).toBe(true);
    app.unmount();
  }, 60_000);

  it('replaces a stale vault that was left without a salt', async () => {
    server = { vault: { version: 1, wrapVersion: 4, leftover: true } };
    const app = openApp();
    const setup = await begin();
    await commit(setup.prepareRecoveryKit());
    expect(serverVault().wrapVersion).toBe(1);
    expect((server.vault as Record<string, unknown>).leftover).toBeUndefined();
    app.unmount();
  }, 60_000);

  it('enforces the strength policy in the context, not only on the screen', async () => {
    const app = openApp();
    await expect(h.ctx.beginAccountSetup('short')).rejects.toThrow(/at least 12/);
    await expect(h.ctx.beginAccountSetup('alllowercaseletters')).rejects.toThrow(/stronger/);
    expect(h.ctx.setupScreen).toBe(false);
    app.unmount();
  });

  it('an existing account never enters the setup, whether it unlocks or restores', async () => {
    const existingKeys = await deriveKeys('an existing writer passphrase 5');
    const check = await createKeyCheck(existingKeys.encryptionKey, USER_ID);
    server = {
      encryption_salt: toBase64(existingKeys.salt),
      encryption_key_check: check.keyCheck,
      encryption_key_check_iv: check.keyCheckIv,
      encryption_key_check_version: check.keyCheckVersion,
    };
    const app = openApp();
    expect(h.ctx.isEncryptionSetup).toBe(true);
    expect(h.ctx.setupScreen).toBe(false);
    await expect(h.ctx.beginAccountSetup(passphrase)).rejects.toThrow(/already set up/);
    expect(h.ctx.setupScreen).toBe(false);

    await act(async () => { await h.ctx.unlockWithPassphrase('an existing writer passphrase 5'); });
    expect(h.ctx.isUnlocked).toBe(true);
    expect(h.ctx.setupScreen).toBe(false);
    app.unmount();

    // A refresh restores from sessionStorage: still no setup.
    const restored = openApp();
    await waitFor(() => expect(h.ctx.isUnlocked).toBe(true));
    expect(h.ctx.setupScreen).toBe(false);
    restored.unmount();
  }, 60_000);

  it('still counts as set up after step 3 when the auth context has not caught up', async () => {
    const app = openApp();
    const setup = await begin();
    await commit(setup.prepareRecoveryKit());
    // No refreshAuth: the provider still holds the metadata from before the write.
    act(() => { h.ctx.finishAccountSetup(); });
    expect(h.ctx.setupScreen).toBe(false);
    expect(h.ctx.isEncryptionSetup).toBe(true);
    expect(h.ctx.isUnlocked).toBe(true);
    await expect(h.ctx.beginAccountSetup(generatePassphrase())).rejects.toThrow(/already set up/);
    app.unmount();
  }, 60_000);

  it('a lock while the write is in flight holds nothing afterwards', async () => {
    const app = openApp();
    const setup = await begin();
    const kit = setup.prepareRecoveryKit();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    mockUpdateUser.mockImplementationOnce(async (arg: { data: Record<string, unknown> }) => {
      await gate;
      applyUpdate(arg);
      return { data: { user: serverUser() }, error: null };
    });

    let pending!: Promise<void>;
    act(() => { pending = kit.commit(); });
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1));
    act(() => { h.ctx.lockVault('sign-out'); });
    await act(async () => { release(); await pending; });

    // The write landed, so the account is set up on the server, but this tab
    // keeps nothing: no session copy, no keys for the starter notes, no step 3.
    expect(serverVault().recoveryWrap).toBeDefined();
    expect(sessionStorage.length).toBe(0);
    expect(setup.committedKeys()).toBeNull();
    expect(h.ctx.setupScreen).toBe(false);
    expect(h.ctx.setupDone).toBe(false);
    expect(h.ctx.isUnlocked).toBe(false);
    app.unmount();
  }, 60_000);

  it('a setup that sent its write cannot make a second recovery key', async () => {
    const app = openApp();
    const setup = await begin();
    const kit = setup.prepareRecoveryKit();
    mockUpdateUser.mockImplementationOnce(async () => ({ data: { user: null }, error: { message: 'gateway timeout' } }));
    await act(async () => { await kit.commit().catch(() => undefined); });
    expect(setup.writeAttempted()).toBe(true);
    expect(() => setup.prepareRecoveryKit()).toThrow();
    app.unmount();
  }, 60_000);

  it('a sign-out between the write and step 3 ends the setup screen', async () => {
    const app = openApp();
    const setup = await begin();
    await commit(setup.prepareRecoveryKit());
    const held = setup.committedKeys()!;
    expect(sessionStorage.length).toBe(1);
    expect(h.ctx.setupScreen).toBe(true);
    act(() => { h.ctx.lockVault('sign-out'); });
    expect(h.ctx.setupScreen).toBe(false);
    expect(h.ctx.isUnlocked).toBe(false);
    // The held keys are zeroed and the session copy cleared.
    expect(held.rawEncryptionKey.every((b) => b === 0)).toBe(true);
    expect(sessionStorage.length).toBe(0);
    // Leaving step 3 afterwards installs nothing.
    act(() => { h.ctx.finishAccountSetup(); });
    expect(h.ctx.isUnlocked).toBe(false);
    app.unmount();
  }, 60_000);

  it('a different account signing in before the write never receives the keys', async () => {
    const app = openApp();
    const setup = await begin();
    const kit = setup.prepareRecoveryKit();
    signedInAs = OTHER_USER_ID;
    refreshAuth(app);
    expect(h.ctx.setupScreen).toBe(false);

    let caught: unknown;
    await act(async () => { await kit.commit().catch((err: unknown) => { caught = err; }); });
    expect(caught).toMatchObject({ code: 'changed' });
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(h.ctx.isUnlocked).toBe(false);
    app.unmount();
  }, 60_000);

  describe('leaving the setup screen and coming back (the account gate, simplified)', () => {
    /** What the gate shows: the setup while it is open or the account is unset, else the unlock screen. */
    function Gate({ show }: { show: boolean }) {
      const { isEncryptionSetup, setupScreen } = useEncryption();
      if (!show) return <p>public page</p>;
      return !isEncryptionSetup || setupScreen ? <PassphraseSetup /> : <p>unlock screen</p>;
    }
    function gateTree(show: boolean) {
      return (
        <EncryptionProvider>
          <Harness />
          <Gate show={show} />
        </EncryptionProvider>
      );
    }
    function renderGate(show: boolean, app?: ReturnType<typeof render>) {
      mockUseAuth.mockReturnValue({ user: serverUser() });
      if (app) {
        app.rerender(gateTree(show));
        return app;
      }
      return render(gateTree(show));
    }

    async function reachSave() {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      const key = (await screen.findByTestId('recovery-key', {}, { timeout: 20_000 })).textContent!;
      fireEvent.click(screen.getByRole('button', { name: /saved it/ }));
      fireEvent.change(screen.getByLabelText('Recovery key'), { target: { value: key } });
      fireEvent.click(screen.getByRole('button', { name: 'Save recovery key' }));
    }

    it('a write that lands after the screen was left leads to the unlock screen, not a dead step 1', async () => {
      const app = renderGate(true);
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      mockUpdateUser.mockImplementationOnce(async (arg: { data: Record<string, unknown> }) => {
        await held;
        applyUpdate(arg);
        return { data: { user: serverUser() }, error: null };
      });
      await reachSave();
      await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1));

      // The writer goes to a public page while the write is in flight.
      renderGate(false, app);
      await act(async () => { release(); await Promise.resolve(); });
      await waitFor(() => expect(serverVault().recoveryWrap).toBeDefined());
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      // Back to the app, with the metadata the auth context now holds.
      renderGate(true, app);
      expect(await screen.findByText('unlock screen')).toBeInTheDocument();
      expect(screen.queryByText('Step 1 of 3')).toBeNull();
      app.unmount();
    }, 60_000);

    it('a remount after the write landed still comes back to step 3', async () => {
      const app = renderGate(true);
      await reachSave();
      expect(await screen.findByText('Step 3 of 3', {}, { timeout: 20_000 })).toBeInTheDocument();
      renderGate(false, app);
      renderGate(true, app);
      expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Open my notes' }));
      await waitFor(() => expect(h.ctx.isUnlocked).toBe(true));
      expect(screen.getByText('unlock screen')).toBeInTheDocument();
      app.unmount();
    }, 60_000);

    it('leaving before Save, then coming back, starts again at step 1 and can finish', async () => {
      const app = renderGate(true);
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await screen.findByTestId('recovery-key', {}, { timeout: 20_000 });
      renderGate(false, app);
      renderGate(true, app);
      expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
      expect(mockUpdateUser).not.toHaveBeenCalled();
      await reachSave();
      expect(await screen.findByText('Step 3 of 3', {}, { timeout: 20_000 })).toBeInTheDocument();
      app.unmount();
    }, 60_000);
  });

  it('the screen: suggested passphrase, Back, a new key, the key typed back, done, and the starter notes', async () => {
    const app = openApp(true);
    const suggested = screen.getByTestId('suggested-passphrase').textContent!;
    expect(suggested.split('-')).toHaveLength(6);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const firstKey = (await screen.findByTestId('recovery-key', {}, { timeout: 20_000 })).textContent!;
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
    expect(mockUpdateUser).not.toHaveBeenCalled();

    // Back returns to step 1 with the same suggestion; the key is put away.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('suggested-passphrase')).toHaveTextContent(suggested);
    expect(screen.queryByTestId('recovery-key')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const secondKey = (await screen.findByTestId('recovery-key', {}, { timeout: 20_000 })).textContent!;
    expect(secondKey).not.toBe(firstKey);

    fireEvent.click(screen.getByRole('button', { name: /saved it/ }));
    fireEvent.change(screen.getByLabelText('Recovery key'), { target: { value: firstKey } });
    expect(screen.getByRole('button', { name: 'Save recovery key' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Recovery key'), { target: { value: secondKey } });
    fireEvent.click(screen.getByRole('button', { name: 'Save recovery key' }));

    expect(await screen.findByRole('heading', { name: 'Your notes are ready' }, { timeout: 20_000 })).toBeInTheDocument();
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockCreateEncryptedNote).toHaveBeenCalledTimes(4));
    expect(mockAddTagToNoteOffline).toHaveBeenCalledWith(USER_ID, 'starter-3', 'tag-recipes');
    expect(h.ctx.isUnlocked).toBe(false);

    refreshAuth(app, true);
    fireEvent.click(screen.getByRole('button', { name: 'Open my notes' }));
    await waitFor(() => expect(h.ctx.setupScreen).toBe(false));
    // The starter notes were written with the keys the library now holds.
    expect(mockCreateEncryptedNote.mock.calls[0][3]).toBe(h.ctx.keys);

    // The suggested passphrase is what the vault opens with.
    app.unmount();
    sessionStorage.clear();
    const next = openApp();
    let ok = false;
    await act(async () => { ok = await h.ctx.unlockWithPassphrase(suggested); });
    expect(ok).toBe(true);
    next.unmount();
    expect(telemetryText()).not.toContain(suggested);
    expect(telemetryText()).not.toContain(secondKey);
  }, 120_000);
});
