import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { EncryptionProvider, useEncryption } from './EncryptionContext';

const {
  mockUseAuth,
  mockCreateKeyCheck,
  mockImportSessionKeys,
  mockExportSessionKeys,
  mockGetUser,
  mockUpdateUser,
  mockVerifyKeyCheck,
  mockReportReliabilityIssue,
  mockAddReliabilityBreadcrumb,
  mockDeriveKeys,
  mockBuildMigratedVault,
  mockUnlockVault,
} = vi.hoisted(() => ({
  mockDeriveKeys: vi.fn(),
  mockBuildMigratedVault: vi.fn(),
  mockUnlockVault: vi.fn(),
  mockUseAuth: vi.fn(),
  mockCreateKeyCheck: vi.fn(),
  mockImportSessionKeys: vi.fn(),
  mockExportSessionKeys: vi.fn(),
  mockGetUser: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockVerifyKeyCheck: vi.fn(),
  mockReportReliabilityIssue: vi.fn(),
  mockAddReliabilityBreadcrumb: vi.fn(),
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

vi.mock('../lib/encryption', async (importOriginal) => ({
  parseKeyCheckVersion: (await importOriginal<typeof import('../lib/encryption')>()).parseKeyCheckVersion,
  deriveKeys: mockDeriveKeys,
  createKeyCheck: mockCreateKeyCheck,
  verifyKeyCheck: mockVerifyKeyCheck,
  exportSessionKeys: mockExportSessionKeys,
  importSessionKeys: mockImportSessionKeys,
  toBase64: vi.fn(),
  fromBase64: vi.fn(),
  KEY_CHECK_VERSION: 2,
  ARGON2_PARAMS: { parallelism: 1, iterations: 3, memorySize: 65536, hashLength: 64 },
}));

// The metadata reader and copyMasterKey are pure and run for real; the two
// Argon2id-backed operations are mocked.
vi.mock('../lib/vaultKey', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/vaultKey')>()),
  buildMigratedVault: mockBuildMigratedVault,
  unlockVault: mockUnlockVault,
}));

vi.mock('../utils/reliabilityTelemetry', () => ({
  addReliabilityBreadcrumb: mockAddReliabilityBreadcrumb,
  reportReliabilityIssue: mockReportReliabilityIssue,
}));

function Probe() {
  const { isUnlocked } = useEncryption();
  return <div>{isUnlocked ? 'unlocked' : 'locked'}</div>;
}

function ControlsProbe() {
  const { isUnlocked, lockVault } = useEncryption();

  return (
    <div>
      <div>{isUnlocked ? 'unlocked' : 'locked'}</div>
      <button type="button" onClick={() => lockVault('auto-lock')}>Auto lock</button>
      <button type="button" onClick={() => lockVault('manual')}>Manual lock</button>
      <button type="button" onClick={() => lockVault('sign-out')}>Sign out</button>
    </div>
  );
}

function UnlockProbe() {
  const { unlockWithPassphrase } = useEncryption();
  const [result, setResult] = useState('idle');

  return (
    <div>
      <div>{result}</div>
      <button
        type="button"
        onClick={async () => {
          try {
            const success = await unlockWithPassphrase('correct-passphrase');
            setResult(success ? 'success' : 'incorrect');
          } catch (err) {
            setResult(err instanceof Error ? `error:${err.message}` : 'error');
          }
        }}
      >
        Unlock
      </button>
    </div>
  );
}

function createFakeKeys() {
  return {
    encryptionKey: {} as CryptoKey,
    hashKey: {} as CryptoKey,
    salt: new Uint8Array([1, 2, 3]),
    rawEncryptionKey: new Uint8Array(32),
    rawHashKey: new Uint8Array(32),
  };
}

const b64 = (n: number) => btoa(String.fromCharCode(...new Uint8Array(n).fill(1)));
const validVault = {
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

const baseUser = {
  id: 'vault-user-1',
  user_metadata: {
    encryption_salt: 'c2FsdA==',
    encryption_key_check: 'key-check',
    encryption_key_check_iv: 'key-check-iv',
    encryption_key_check_version: 2,
  },
};

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  mockUseAuth.mockReturnValue({ user: baseUser });
  mockCreateKeyCheck.mockReset();
  mockImportSessionKeys.mockReset();
  mockExportSessionKeys.mockReset();
  mockGetUser.mockReset();
  mockUpdateUser.mockReset();
  mockVerifyKeyCheck.mockReset();
  mockReportReliabilityIssue.mockReset();
  mockAddReliabilityBreadcrumb.mockReset();
  mockDeriveKeys.mockReset();
  mockBuildMigratedVault.mockReset();
  mockUnlockVault.mockReset();
  mockBuildMigratedVault.mockResolvedValue(validVault);
  mockCreateKeyCheck.mockResolvedValue({
    keyCheck: 'key-check-v2',
    keyCheckIv: 'key-check-iv-v2',
    keyCheckVersion: 2,
  });
  mockExportSessionKeys.mockReturnValue({
    version: 2,
    encKey: 'enc',
    hashKey: 'hash',
    salt: 'salt',
    checksum: 'deadbeef',
  });
  mockUpdateUser.mockResolvedValue({ error: null });
  mockGetUser.mockResolvedValue({ data: { user: baseUser } });
});

describe('EncryptionContext telemetry', () => {
  it('verifies session restore before unlocking', async () => {
    const fakeKeys = createFakeKeys();

    sessionStorage.setItem(
      'yidhan-vault-user-1-vault-session',
      JSON.stringify({ encKey: 'enc', hashKey: 'hash', salt: 'salt' })
    );
    mockImportSessionKeys.mockResolvedValue(fakeKeys);
    mockVerifyKeyCheck.mockResolvedValue(true);

    render(
      <EncryptionProvider>
        <Probe />
      </EncryptionProvider>
    );

    await waitFor(() => {
      expect(mockVerifyKeyCheck).toHaveBeenCalledWith(
        fakeKeys.encryptionKey,
        'key-check',
        'key-check-iv',
        'vault-user-1',
        2
      );
    });

    expect(screen.getByText('unlocked')).toBeInTheDocument();
    expect(sessionStorage.getItem('yidhan-vault-user-1-vault-session')).toBe(
      JSON.stringify({ version: 2, encKey: 'enc', hashKey: 'hash', salt: 'salt', checksum: 'deadbeef' })
    );
  });

  it('does not recreate remembered keys from a session-only restore after another tab cleared them', async () => {
    const fakeKeys = createFakeKeys();

    localStorage.setItem('yidhan-vault-user-1-vault-remember-browser', 'true');
    sessionStorage.setItem(
      'yidhan-vault-user-1-vault-session',
      JSON.stringify({ encKey: 'enc', hashKey: 'hash', salt: 'salt' })
    );
    mockImportSessionKeys.mockResolvedValue(fakeKeys);
    mockVerifyKeyCheck.mockResolvedValue(true);

    render(
      <EncryptionProvider>
        <Probe />
      </EncryptionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('unlocked')).toBeInTheDocument();
    });

    expect(sessionStorage.getItem('yidhan-vault-user-1-vault-session')).toBe(
      JSON.stringify({ version: 2, encKey: 'enc', hashKey: 'hash', salt: 'salt', checksum: 'deadbeef' })
    );
    expect(localStorage.getItem('yidhan-vault-user-1-vault-persisted-keys')).toBeNull();
  });

  it('refreshes an existing remembered blob after a successful session restore', async () => {
    const fakeKeys = createFakeKeys();

    localStorage.setItem('yidhan-vault-user-1-vault-remember-browser', 'true');
    localStorage.setItem(
      'yidhan-vault-user-1-vault-persisted-keys',
      JSON.stringify({ version: 1, encKey: 'enc', hashKey: 'hash', salt: 'salt' })
    );
    sessionStorage.setItem(
      'yidhan-vault-user-1-vault-session',
      JSON.stringify({ version: 1, encKey: 'enc', hashKey: 'hash', salt: 'salt' })
    );
    mockImportSessionKeys.mockResolvedValue(fakeKeys);
    mockVerifyKeyCheck.mockResolvedValue(true);

    render(
      <EncryptionProvider>
        <Probe />
      </EncryptionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('unlocked')).toBeInTheDocument();
    });

    expect(localStorage.getItem('yidhan-vault-user-1-vault-persisted-keys')).toBe(
      JSON.stringify({ version: 2, encKey: 'enc', hashKey: 'hash', salt: 'salt', checksum: 'deadbeef' })
    );
  });

  it('upgrades legacy key-check metadata after a successful restore', async () => {
    const fakeKeys = createFakeKeys();

    mockUseAuth.mockReturnValue({
      user: {
        ...baseUser,
        user_metadata: {
          encryption_salt: 'c2FsdA==',
          encryption_key_check: 'key-check',
          encryption_key_check_iv: 'key-check-iv',
        },
      },
    });
    sessionStorage.setItem(
      'yidhan-vault-user-1-vault-session',
      JSON.stringify({ encKey: 'enc', hashKey: 'hash', salt: 'salt' })
    );
    mockImportSessionKeys.mockResolvedValue(fakeKeys);
    mockVerifyKeyCheck.mockResolvedValue(true);

    render(
      <EncryptionProvider>
        <Probe />
      </EncryptionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('unlocked')).toBeInTheDocument();
    });

    expect(mockVerifyKeyCheck).toHaveBeenCalledWith(
      fakeKeys.encryptionKey,
      'key-check',
      'key-check-iv',
      'vault-user-1',
      1
    );
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: {
          encryption_key_check: 'key-check-v2',
          encryption_key_check_iv: 'key-check-iv-v2',
          encryption_key_check_version: 2,
        },
      });
    });
  });

  it('clears session restore blobs that fail key-check and stays locked', async () => {
    const fakeKeys = createFakeKeys();

    sessionStorage.setItem(
      'yidhan-vault-user-1-vault-session',
      JSON.stringify({ encKey: 'enc', hashKey: 'hash', salt: 'salt' })
    );
    mockImportSessionKeys.mockResolvedValue(fakeKeys);
    mockVerifyKeyCheck.mockResolvedValue(false);

    render(
      <EncryptionProvider>
        <Probe />
      </EncryptionProvider>
    );

    await waitFor(() => {
      expect(mockReportReliabilityIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'vault',
          message: 'Vault session keys failed key-check',
        })
      );
    });

    expect(sessionStorage.getItem('yidhan-vault-user-1-vault-session')).toBeNull();
    expect(screen.getByText('locked')).toBeInTheDocument();
  });

  it('fails closed when session restore cannot be verified', async () => {
    const fakeKeys = createFakeKeys();

    mockUseAuth.mockReturnValue({
      user: {
        ...baseUser,
        user_metadata: {
          encryption_salt: 'c2FsdA==',
        },
      },
    });
    sessionStorage.setItem(
      'yidhan-vault-user-1-vault-session',
      JSON.stringify({ encKey: 'enc', hashKey: 'hash', salt: 'salt' })
    );
    mockImportSessionKeys.mockResolvedValue(fakeKeys);

    render(
      <EncryptionProvider>
        <Probe />
      </EncryptionProvider>
    );

    await waitFor(() => {
      expect(mockReportReliabilityIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'vault',
          message: 'Vault session restore missing key-check metadata',
        })
      );
    });

    expect(mockVerifyKeyCheck).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('yidhan-vault-user-1-vault-session')).toBeNull();
    expect(screen.getByText('locked')).toBeInTheDocument();
  });

  it('reports corrupted session restore blobs and clears session storage', async () => {
    sessionStorage.setItem('yidhan-vault-user-1-vault-session', '{bad-json');

    render(
      <EncryptionProvider>
        <Probe />
      </EncryptionProvider>
    );

    await waitFor(() => {
      expect(mockReportReliabilityIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'vault',
          message: 'Vault session restore failed',
        }),
        expect.anything()
      );
    });

    expect(sessionStorage.getItem('yidhan-vault-user-1-vault-session')).toBeNull();
    expect(screen.getByText('locked')).toBeInTheDocument();
  });

  it('reports checksum failures during session restore and clears session storage', async () => {
    sessionStorage.setItem(
      'yidhan-vault-user-1-vault-session',
      JSON.stringify({ version: 2, encKey: 'enc', hashKey: 'hash', salt: 'salt', checksum: 'bad' })
    );
    mockImportSessionKeys.mockRejectedValue(new Error('Session blob integrity check failed'));

    render(
      <EncryptionProvider>
        <Probe />
      </EncryptionProvider>
    );

    await waitFor(() => {
      expect(mockReportReliabilityIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'vault',
          message: 'Vault session restore failed',
        }),
        expect.anything()
      );
    });

    expect(sessionStorage.getItem('yidhan-vault-user-1-vault-session')).toBeNull();
    expect(screen.getByText('locked')).toBeInTheDocument();
  });

  it('reports remembered-browser key-check failures and clears persisted keys', async () => {
    const fakeKeys = createFakeKeys();

    localStorage.setItem('yidhan-vault-user-1-vault-remember-browser', 'true');
    localStorage.setItem(
      'yidhan-vault-user-1-vault-persisted-keys',
      JSON.stringify({ encKey: 'enc', hashKey: 'hash', salt: 'salt' })
    );
    mockImportSessionKeys.mockResolvedValue(fakeKeys);
    mockVerifyKeyCheck.mockResolvedValue(false);

    render(
      <EncryptionProvider>
        <Probe />
      </EncryptionProvider>
    );

    await waitFor(() => {
      expect(mockVerifyKeyCheck).toHaveBeenCalled();
    });

    expect(mockReportReliabilityIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'vault',
        message: 'Persisted vault keys failed key-check',
      })
    );
    expect(localStorage.getItem('yidhan-vault-user-1-vault-persisted-keys')).toBeNull();
    expect(screen.getByText('locked')).toBeInTheDocument();
  });

  it('upgrades remembered-browser blobs to the checksummed format after a successful restore', async () => {
    const fakeKeys = createFakeKeys();

    localStorage.setItem('yidhan-vault-user-1-vault-remember-browser', 'true');
    localStorage.setItem(
      'yidhan-vault-user-1-vault-persisted-keys',
      JSON.stringify({ version: 1, encKey: 'enc', hashKey: 'hash', salt: 'salt' })
    );
    mockImportSessionKeys.mockResolvedValue(fakeKeys);
    mockVerifyKeyCheck.mockResolvedValue(true);

    render(
      <EncryptionProvider>
        <Probe />
      </EncryptionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('unlocked')).toBeInTheDocument();
    });

    expect(localStorage.getItem('yidhan-vault-user-1-vault-persisted-keys')).toBe(
      JSON.stringify({ version: 2, encKey: 'enc', hashKey: 'hash', salt: 'salt', checksum: 'deadbeef' })
    );
  });

  it('reports checksum failures during remembered-browser restore and clears persisted keys', async () => {
    localStorage.setItem('yidhan-vault-user-1-vault-remember-browser', 'true');
    localStorage.setItem(
      'yidhan-vault-user-1-vault-persisted-keys',
      JSON.stringify({ version: 2, encKey: 'enc', hashKey: 'hash', salt: 'salt', checksum: 'bad' })
    );
    mockImportSessionKeys.mockRejectedValue(new Error('Session blob integrity check failed'));

    render(
      <EncryptionProvider>
        <Probe />
      </EncryptionProvider>
    );

    await waitFor(() => {
      expect(mockReportReliabilityIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'vault',
          message: 'Persisted vault restore failed',
        }),
        expect.anything()
      );
    });

    expect(localStorage.getItem('yidhan-vault-user-1-vault-persisted-keys')).toBeNull();
    expect(screen.getByText('locked')).toBeInTheDocument();
  });
});

describe('EncryptionContext vault state machine', () => {
  function seedRememberedKeys() {
    localStorage.setItem('yidhan-vault-user-1-vault-remember-browser', 'true');
    localStorage.setItem(
      'yidhan-vault-user-1-vault-persisted-keys',
      JSON.stringify({ version: 2, encKey: 'enc', hashKey: 'hash', salt: 'salt', checksum: 'deadbeef' })
    );
  }

  it('keeps remembered keys across auto-lock and restores only after activity', async () => {
    const fakeKeys = createFakeKeys();
    seedRememberedKeys();
    mockImportSessionKeys.mockResolvedValue(fakeKeys);
    mockVerifyKeyCheck.mockResolvedValue(true);

    render(
      <EncryptionProvider>
        <ControlsProbe />
      </EncryptionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('unlocked')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Auto lock' }));

    await waitFor(() => {
      expect(screen.getByText('locked')).toBeInTheDocument();
    });

    expect(sessionStorage.getItem('yidhan-vault-user-1-vault-session')).toBeNull();
    expect(localStorage.getItem('yidhan-vault-user-1-vault-persisted-keys')).not.toBeNull();

    fireEvent.mouseDown(document);

    await waitFor(() => {
      expect(screen.getByText('unlocked')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(sessionStorage.getItem('yidhan-vault-user-1-vault-session')).not.toBeNull();
    });
  });

  it('clears remembered keys on manual lock', async () => {
    const fakeKeys = createFakeKeys();
    seedRememberedKeys();
    mockImportSessionKeys.mockResolvedValue(fakeKeys);
    mockVerifyKeyCheck.mockResolvedValue(true);

    render(
      <EncryptionProvider>
        <ControlsProbe />
      </EncryptionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('unlocked')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Manual lock' }));

    await waitFor(() => {
      expect(screen.getByText('locked')).toBeInTheDocument();
    });

    expect(sessionStorage.getItem('yidhan-vault-user-1-vault-session')).toBeNull();
    expect(localStorage.getItem('yidhan-vault-user-1-vault-persisted-keys')).toBeNull();
  });

  it('clears remembered keys on sign-out even after the vault was auto-locked', async () => {
    const fakeKeys = createFakeKeys();
    seedRememberedKeys();
    mockImportSessionKeys.mockResolvedValue(fakeKeys);
    mockVerifyKeyCheck.mockResolvedValue(true);

    render(
      <EncryptionProvider>
        <ControlsProbe />
      </EncryptionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('unlocked')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Auto lock' }));

    await waitFor(() => {
      expect(screen.getByText('locked')).toBeInTheDocument();
    });
    expect(localStorage.getItem('yidhan-vault-user-1-vault-persisted-keys')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(localStorage.getItem('yidhan-vault-user-1-vault-persisted-keys')).toBeNull();
  });
});

describe('EncryptionContext unlockWithPassphrase', () => {
  it('throws for incomplete vault metadata instead of treating it as an incorrect passphrase', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        ...baseUser,
        user_metadata: {
          encryption_salt: 'c2FsdA==',
          encryption_key_check: undefined,
          encryption_key_check_iv: undefined,
          encryption_key_check_version: 2,
        },
      },
    });

    render(
      <EncryptionProvider>
        <UnlockProbe />
      </EncryptionProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => {
      expect(
        screen.getByText('error:Vault metadata is incomplete. Please sign out and sign back in.')
      ).toBeInTheDocument();
    });

    expect(mockReportReliabilityIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'vault',
        message: 'Passphrase unlock missing key-check metadata',
      })
    );
    expect(mockVerifyKeyCheck).not.toHaveBeenCalled();
  });
});

describe('EncryptionContext wrapped-key migration (item 24)', () => {
  function MigrationProbe() {
    const { isUnlocked, unlockWithPassphrase, lockVault } = useEncryption();
    const [result, setResult] = useState('idle');
    return (
      <div>
        <div>{isUnlocked ? 'unlocked' : 'locked'}</div>
        <div>{result}</div>
        <button
          type="button"
          onClick={async () => {
            const success = await unlockWithPassphrase('correct-passphrase');
            setResult(success ? 'success' : 'incorrect');
          }}
        >
          Unlock
        </button>
        <button type="button" onClick={() => lockVault('manual')}>Manual lock</button>
      </div>
    );
  }

  function filledKeys(fill: number) {
    const keys = createFakeKeys();
    keys.rawEncryptionKey.fill(fill);
    keys.rawHashKey.fill(fill + 1);
    return keys;
  }

  function vaultWrites() {
    return mockUpdateUser.mock.calls.filter(([arg]) => 'vault' in (arg?.data ?? {}));
  }

  function renderProbe() {
    render(
      <EncryptionProvider>
        <MigrationProbe />
      </EncryptionProvider>
    );
  }

  async function settle() {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }

  it('unlocks a migrated account through the vault without deriving legacy keys or migrating again', async () => {
    mockUseAuth.mockReturnValue({ user: { ...baseUser, user_metadata: { ...baseUser.user_metadata, vault: validVault } } });
    mockUnlockVault.mockResolvedValue(filledKeys(3));

    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.getByText('unlocked')).toBeInTheDocument());
    await settle();

    expect(mockUnlockVault).toHaveBeenCalledWith('correct-passphrase', validVault, 'vault-user-1', undefined);
    expect(mockDeriveKeys).not.toHaveBeenCalled();
    expect(mockBuildMigratedVault).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('reports a wrong passphrase on a migrated account and does not migrate', async () => {
    mockUseAuth.mockReturnValue({ user: { ...baseUser, user_metadata: { ...baseUser.user_metadata, vault: validVault } } });
    mockUnlockVault.mockResolvedValue(null);
    mockDeriveKeys.mockResolvedValue(filledKeys(3));
    mockVerifyKeyCheck.mockResolvedValue(false);

    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.getByText('incorrect')).toBeInTheDocument());
    await settle();

    expect(screen.getByText('locked')).toBeInTheDocument();
    expect(mockBuildMigratedVault).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('falls back to the legacy path when the vault does not open, and never overwrites the vault', async () => {
    mockUseAuth.mockReturnValue({ user: { ...baseUser, user_metadata: { ...baseUser.user_metadata, vault: validVault } } });
    mockUnlockVault.mockResolvedValue(null);
    mockDeriveKeys.mockResolvedValue(filledKeys(3));
    mockVerifyKeyCheck.mockResolvedValue(true);

    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.getByText('unlocked')).toBeInTheDocument());
    await settle();

    expect(mockReportReliabilityIssue).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Wrapped vault key did not open; unlocked through the legacy key path',
    }));
    expect(mockBuildMigratedVault).not.toHaveBeenCalled();
    expect(vaultWrites()).toHaveLength(0);
  });

  it('does not migrate over a vault version this client does not understand', async () => {
    mockUseAuth.mockReturnValue({
      user: { ...baseUser, user_metadata: { ...baseUser.user_metadata, vault: { ...validVault, version: 2 } } },
    });
    mockDeriveKeys.mockResolvedValue(filledKeys(3));
    mockVerifyKeyCheck.mockResolvedValue(true);

    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.getByText('unlocked')).toBeInTheDocument());
    await settle();

    expect(mockUnlockVault).not.toHaveBeenCalled();
    expect(mockBuildMigratedVault).not.toHaveBeenCalled();
    expect(vaultWrites()).toHaveLength(0);
  });

  it('does not migrate after a failed legacy unlock', async () => {
    mockDeriveKeys.mockResolvedValue(filledKeys(3));
    mockVerifyKeyCheck.mockResolvedValue(false);

    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.getByText('incorrect')).toBeInTheDocument());
    await settle();

    expect(mockBuildMigratedVault).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('wraps a copy of K, so locking during the migration cannot make it wrap zeroed bytes', async () => {
    const keys = filledKeys(7);
    mockDeriveKeys.mockResolvedValue(keys);
    mockVerifyKeyCheck.mockResolvedValue(true);
    let release: () => void = () => {};
    let masterAtWrapTime: number[] = [];
    mockBuildMigratedVault.mockImplementation(async ({ master }: { master: Uint8Array }) => {
      await new Promise<void>((r) => { release = r; });
      masterAtWrapTime = Array.from(master);
      return validVault;
    });

    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.getByText('unlocked')).toBeInTheDocument());
    await waitFor(() => expect(mockBuildMigratedVault).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Manual lock' }));
    expect(screen.getByText('locked')).toBeInTheDocument();
    expect(keys.rawEncryptionKey.every((b) => b === 0)).toBe(true);

    await act(async () => { release(); await new Promise((r) => setTimeout(r, 0)); });
    expect(masterAtWrapTime.slice(0, 32).every((b) => b === 7)).toBe(true);
    expect(masterAtWrapTime.slice(32).every((b) => b === 8)).toBe(true);
  });

  it('does not write the vault into a different account if the session changed during the migration', async () => {
    mockDeriveKeys.mockResolvedValue(filledKeys(3));
    mockVerifyKeyCheck.mockResolvedValue(true);
    mockGetUser.mockResolvedValue({ data: { user: { ...baseUser, id: 'someone-else' } } });

    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.getByText('unlocked')).toBeInTheDocument());
    await waitFor(() => expect(mockGetUser).toHaveBeenCalled());
    await settle();

    expect(vaultWrites()).toHaveLength(0);
  });

  it('does not overwrite a vault another device wrote while this one was migrating', async () => {
    mockDeriveKeys.mockResolvedValue(filledKeys(3));
    mockVerifyKeyCheck.mockResolvedValue(true);
    mockGetUser.mockResolvedValue({
      data: { user: { ...baseUser, user_metadata: { ...baseUser.user_metadata, vault: validVault } } },
    });

    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.getByText('unlocked')).toBeInTheDocument());
    await waitFor(() => expect(mockGetUser).toHaveBeenCalled());
    await settle();

    expect(vaultWrites()).toHaveLength(0);
  });

  it('reports a migration whose write did not read back, and stays unlocked', async () => {
    mockDeriveKeys.mockResolvedValue(filledKeys(3));
    mockVerifyKeyCheck.mockResolvedValue(true);
    // getUser never shows the vault: the first call (pre-write) and the read-back.
    mockGetUser.mockResolvedValue({ data: { user: baseUser } });

    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(mockReportReliabilityIssue).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Vault migration to wrapped master key failed' }),
      expect.any(Error)
    ));
    expect(vaultWrites()).toHaveLength(1);
    expect(screen.getByText('unlocked')).toBeInTheDocument();
  });

  it('reports a migration as failed, not skipped, when the current user cannot be read', async () => {
    mockDeriveKeys.mockResolvedValue(filledKeys(3));
    mockVerifyKeyCheck.mockResolvedValue(true);
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'offline' } });

    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(mockReportReliabilityIssue).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Vault migration to wrapped master key failed' }),
      expect.any(Error)
    ));
    expect(vaultWrites()).toHaveLength(0);
    expect(screen.getByText('unlocked')).toBeInTheDocument();
  });

  it('clears any stale vault in the same write that sets up a new passphrase', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'vault-user-1', user_metadata: { vault: validVault } } });
    mockDeriveKeys.mockResolvedValue(filledKeys(3));
    mockGetUser.mockResolvedValue({ data: { user: { ...baseUser } } });

    function SetupProbe() {
      const { setupPassphrase } = useEncryption();
      return (
        <button type="button" onClick={() => { void setupPassphrase('Correct-Horse-Battery-9!'); }}>
          Setup
        </button>
      );
    }
    render(
      <EncryptionProvider>
        <SetupProbe />
      </EncryptionProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Setup' }));

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1));
    expect(mockUpdateUser.mock.calls[0][0].data).toMatchObject({ vault: null });
    expect(mockBuildMigratedVault).not.toHaveBeenCalled();
  });

  it('restores a migrated account against the vault key-check, not the legacy one', async () => {
    mockUseAuth.mockReturnValue({ user: { ...baseUser, user_metadata: { ...baseUser.user_metadata, vault: validVault } } });
    sessionStorage.setItem(
      'yidhan-vault-user-1-vault-session',
      JSON.stringify({ encKey: 'enc', hashKey: 'hash', salt: 'salt' })
    );
    const fakeKeys = createFakeKeys();
    mockImportSessionKeys.mockResolvedValue(fakeKeys);
    mockVerifyKeyCheck.mockResolvedValue(true);

    renderProbe();
    await waitFor(() => expect(screen.getByText('unlocked')).toBeInTheDocument());

    expect(mockVerifyKeyCheck).toHaveBeenCalledTimes(1);
    expect(mockVerifyKeyCheck).toHaveBeenCalledWith(
      fakeKeys.encryptionKey,
      validVault.keyCheck,
      validVault.keyCheckIv,
      'vault-user-1',
      2
    );
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});
