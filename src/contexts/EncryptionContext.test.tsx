import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
} = vi.hoisted(() => ({
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

vi.mock('../lib/encryption', () => ({
  deriveKeys: vi.fn(),
  createKeyCheck: mockCreateKeyCheck,
  verifyKeyCheck: mockVerifyKeyCheck,
  exportSessionKeys: mockExportSessionKeys,
  importSessionKeys: mockImportSessionKeys,
  toBase64: vi.fn(),
  fromBase64: vi.fn(),
  KEY_CHECK_VERSION: 2,
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
