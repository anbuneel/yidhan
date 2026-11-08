/**
 * Item 24: migration to the wrapped master key, through the real provider with
 * real Web Crypto and real Argon2id. Only Supabase auth and the auth context are
 * faked, by a single in-memory `user_metadata` that plays the server.
 *
 * Test ids refer to §5 of docs/plans/2026-09-07-key-migration-and-rotation-design.md.
 */

import { useEffect } from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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

const { mockUseAuth, mockUpdateUser, mockGetUser, mockReportReliabilityIssue } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockGetUser: vi.fn(),
  mockReportReliabilityIssue: vi.fn(),
}));

vi.mock('./AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../lib/supabase', () => ({
  // Only auth is provided: a migration that touched a table would throw here.
  supabase: {
    auth: {
      updateUser: mockUpdateUser,
      getUser: mockGetUser,
    },
  },
}));

vi.mock('../utils/reliabilityTelemetry', () => ({
  addReliabilityBreadcrumb: vi.fn(),
  reportReliabilityIssue: mockReportReliabilityIssue,
}));

import { EncryptionProvider, useEncryption } from './EncryptionContext';
import {
  createKeyCheck,
  decryptNote,
  deriveKeys,
  encryptNote,
  toBase64,
} from '../lib/encryption';
import type { DerivedKeys, EncryptedNote } from '../lib/encryption';
import { readVaultMetadata } from '../lib/vaultMetadata';

const PASSPHRASE = 'correct horse battery staple 42';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const NOTE_ID = '550e8400-e29b-41d4-a716-446655440000';
const LEGACY_SALT = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6]);

let server: Record<string, unknown>;
let legacyKeys: DerivedKeys;
let legacyMetadata: Record<string, unknown>;
let noteRow: EncryptedNote;
let latestKeys: DerivedKeys | null = null;
/** Bumped per test, so a migration still running from an earlier test cannot write. */
let generation = 0;

function serverUser() {
  return { id: USER_ID, user_metadata: { ...server } };
}

/** The server applies `updateUser` as a shallow merge of `data`, like GoTrue. */
function applyUpdate({ data }: { data: Record<string, unknown> }) {
  server = { ...server, ...data };
}

function Harness() {
  const { keys, isUnlocked, unlockWithPassphrase } = useEncryption();
  useEffect(() => {
    latestKeys = keys;
  }, [keys]);
  return (
    <div>
      <div>{isUnlocked ? 'unlocked' : 'locked'}</div>
      <button type="button" onClick={() => { void unlockWithPassphrase(PASSPHRASE); }}>Unlock</button>
    </div>
  );
}

/**
 * Kill the app: unmount it and drop module state, as a new process would. The
 * provider loads the vault modules with import(), so the next open gets fresh
 * copies, including an empty in-flight migration set.
 */
function killApp(app: { unmount: () => void }) {
  app.unmount();
  vi.resetModules();
}

/** Open the app as a fresh process would: auth hands over the server's current user. */
function openApp() {
  latestKeys = null;
  mockUseAuth.mockReturnValue({ user: serverUser() });
  return render(
    <EncryptionProvider>
      <Harness />
    </EncryptionProvider>
  );
}

async function unlock() {
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
  await waitFor(() => expect(screen.getByText('unlocked')).toBeInTheDocument(), { timeout: 15_000 });
}

function vaultStatus() {
  return readVaultMetadata(server.vault).status;
}

function vaultWrites() {
  return mockUpdateUser.mock.calls.filter(([arg]) => 'vault' in (arg?.data ?? {}));
}

async function expectNoteOpens() {
  // latestKeys is set in an effect, which can flush just after the DOM shows "unlocked".
  await waitFor(() => expect(latestKeys).not.toBeNull());
  const keys = latestKeys;
  expect(await decryptNote(NOTE_ID, USER_ID, noteRow, keys!.encryptionKey)).toEqual({
    title: 'Before',
    content: '<p>migration</p>',
  });
  expect(toBase64(keys!.rawEncryptionKey)).toBe(toBase64(legacyKeys.rawEncryptionKey));
  expect(toBase64(keys!.rawHashKey)).toBe(toBase64(legacyKeys.rawHashKey));
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
  noteRow = await encryptNote(NOTE_ID, USER_ID, 'Before', '<p>migration</p>', legacyKeys);
}, 30_000);

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  latestKeys = null;
  server = { ...legacyMetadata };
  mockUpdateUser.mockReset();
  mockGetUser.mockReset();
  mockReportReliabilityIssue.mockReset();
  const current = ++generation;
  mockUpdateUser.mockImplementation(async (arg: { data: Record<string, unknown> }) => {
    if (current !== generation) {
      return { data: { user: null }, error: { message: 'write from an earlier test' } };
    }
    applyUpdate(arg);
    return { data: { user: serverUser() }, error: null };
  });
  mockGetUser.mockImplementation(async () => ({ data: { user: serverUser() } }));
});

describe('wrapped master key migration (item 24)', () => {
  it('migrates an existing account on unlock without touching the legacy fields or any note', async () => {
    const rowBefore = JSON.stringify(noteRow);
    openApp();
    await unlock();
    await expectNoteOpens();

    await waitFor(() => expect(vaultStatus()).toBe('valid'), { timeout: 15_000 });

    // One write, carrying only the vault object (§3.1 step 3).
    expect(vaultWrites()).toHaveLength(1);
    expect(Object.keys(vaultWrites()[0][0].data)).toEqual(['vault']);
    for (const [field, value] of Object.entries(legacyMetadata)) {
      expect(server[field]).toBe(value);
    }
    // 24-T2: nothing about the note row changed.
    expect(JSON.stringify(noteRow)).toBe(rowBefore);
  }, 30_000);

  it('24-T3: a migration killed mid-write leaves the account usable and completes on the next unlock', async () => {
    // The write never returns: the app is killed while it is in flight.
    mockUpdateUser.mockImplementationOnce(() => new Promise(() => {}));
    const first = openApp();
    await unlock();
    await expectNoteOpens();
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1), { timeout: 15_000 });
    killApp(first);
    // Killing the app closes the tab, which clears sessionStorage.
    sessionStorage.clear();
    expect(vaultStatus()).toBe('absent');

    // Reopen: legacy unlock still works, and this time the migration lands.
    openApp();
    await unlock();
    await expectNoteOpens();
    await waitFor(() => expect(vaultStatus()).toBe('valid'), { timeout: 15_000 });
  }, 60_000);

  it('24-T3: a migration whose write fails leaves the account unlocked and retries on the next unlock', async () => {
    mockUpdateUser.mockImplementationOnce(async () => ({ data: { user: null }, error: { message: 'offline' } }));
    const first = openApp();
    await unlock();
    await expectNoteOpens();
    await waitFor(() => expect(mockReportReliabilityIssue).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Vault migration to wrapped master key failed' }),
      expect.anything()
    ), { timeout: 15_000 });
    expect(vaultStatus()).toBe('absent');
    expect(screen.getByText('unlocked')).toBeInTheDocument();
    killApp(first);
    sessionStorage.clear();

    openApp();
    await unlock();
    await waitFor(() => expect(vaultStatus()).toBe('valid'), { timeout: 15_000 });
    await expectNoteOpens();
  }, 60_000);

  it('24-T4: a write that landed but reported an error is not repeated, and the next unlock unwraps', async () => {
    mockUpdateUser.mockImplementationOnce(async (arg: { data: Record<string, unknown> }) => {
      applyUpdate(arg);
      return { data: { user: null }, error: { message: 'network error after commit' } };
    });
    const first = openApp();
    await unlock();
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1), { timeout: 15_000 });
    expect(vaultStatus()).toBe('valid');
    killApp(first);
    // A fresh tab: no session restore, so "unlocked" below can only come from the passphrase.
    sessionStorage.clear();

    // Break the legacy key-check on the "server": only the vault can open it now.
    // This proves the second unlock used the unwrap path.
    server = { ...server, encryption_key_check: (await createKeyCheck(
      (await deriveKeys('some other passphrase 77', LEGACY_SALT)).encryptionKey,
      USER_ID
    )).keyCheck };

    openApp();
    await unlock();
    await expectNoteOpens();
    // Give a stray migration time to run; there must not be one.
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(vaultWrites()).toHaveLength(1);
  }, 60_000);

  it('24-T5: a refresh on a migrated account restores only after verifying K against the vault key-check', async () => {
    const first = openApp();
    await unlock();
    await waitFor(() => expect(vaultStatus()).toBe('valid'), { timeout: 15_000 });
    killApp(first);

    // Refresh: sessionStorage holds K. It verifies against the vault key-check.
    openApp();
    await waitFor(() => expect(screen.getByText('unlocked')).toBeInTheDocument(), { timeout: 15_000 });
    await expectNoteOpens();
  }, 60_000);

  it('a refresh on a migrated account does not unlock with a key the vault key-check rejects', async () => {
    const first = openApp();
    await unlock();
    await waitFor(() => expect(vaultStatus()).toBe('valid'), { timeout: 15_000 });
    killApp(first);

    // Replace the vault key-check with one under a different key. The legacy
    // key-check still matches the stored session key, but a migrated account
    // must verify against the vault (§1.2), so the restore has to fail closed.
    const vault = server.vault as Record<string, unknown>;
    const other = await createKeyCheck((await deriveKeys('some other passphrase 77', LEGACY_SALT)).encryptionKey, USER_ID);
    server = { ...server, vault: { ...vault, keyCheck: other.keyCheck, keyCheckIv: other.keyCheckIv } };

    openApp();
    await waitFor(() => expect(mockReportReliabilityIssue).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Vault session keys failed key-check' })
    ), { timeout: 15_000 });
    expect(screen.getByText('locked')).toBeInTheDocument();
    expect(sessionStorage.getItem(`yidhan-${USER_ID}-vault-session`)).toBeNull();
  }, 60_000);

  it('a restore never migrates: without the passphrase there is no KEK', async () => {
    const first = openApp();
    // Unlock with the first write failing, so the account stays unmigrated but
    // sessionStorage holds K.
    mockUpdateUser.mockImplementationOnce(async () => ({ data: { user: null }, error: { message: 'offline' } }));
    await unlock();
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1), { timeout: 15_000 });
    killApp(first);
    mockUpdateUser.mockClear();

    openApp();
    await waitFor(() => expect(screen.getByText('unlocked')).toBeInTheDocument(), { timeout: 15_000 });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(vaultWrites()).toHaveLength(0);
    expect(vaultStatus()).toBe('absent');
  }, 60_000);
});
