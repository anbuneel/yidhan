import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { EncryptionProvider, useEncryption } from './EncryptionContext';

const {
  mockUseAuth,
  mockImportSessionKeys,
  mockVerifyKeyCheck,
  mockReportReliabilityIssue,
  mockAddReliabilityBreadcrumb,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockImportSessionKeys: vi.fn(),
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
      updateUser: vi.fn(),
      getUser: vi.fn(),
    },
  },
}));

vi.mock('../lib/encryption', () => ({
  deriveKeys: vi.fn(),
  createKeyCheck: vi.fn(),
  verifyKeyCheck: mockVerifyKeyCheck,
  exportSessionKeys: vi.fn(),
  importSessionKeys: mockImportSessionKeys,
}));

vi.mock('../utils/reliabilityTelemetry', () => ({
  addReliabilityBreadcrumb: mockAddReliabilityBreadcrumb,
  reportReliabilityIssue: mockReportReliabilityIssue,
}));

function Probe() {
  const { isUnlocked } = useEncryption();
  return <div>{isUnlocked ? 'unlocked' : 'locked'}</div>;
}

const baseUser = {
  id: 'vault-user-1',
  user_metadata: {
    encryption_salt: 'c2FsdA==',
    encryption_key_check: 'key-check',
    encryption_key_check_iv: 'key-check-iv',
  },
};

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  mockUseAuth.mockReturnValue({ user: baseUser });
  mockImportSessionKeys.mockReset();
  mockVerifyKeyCheck.mockReset();
  mockReportReliabilityIssue.mockReset();
  mockAddReliabilityBreadcrumb.mockReset();
});

describe('EncryptionContext telemetry', () => {
  it('verifies session restore before unlocking', async () => {
    const fakeKeys = {
      encryptionKey: {} as CryptoKey,
      hashKey: {} as CryptoKey,
      salt: new Uint8Array([1, 2, 3]),
      rawEncryptionKey: new Uint8Array(32),
      rawHashKey: new Uint8Array(32),
    };

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
        'key-check-iv'
      );
    });

    expect(screen.getByText('unlocked')).toBeInTheDocument();
  });

  it('clears session restore blobs that fail key-check and stays locked', async () => {
    const fakeKeys = {
      encryptionKey: {} as CryptoKey,
      hashKey: {} as CryptoKey,
      salt: new Uint8Array([1, 2, 3]),
      rawEncryptionKey: new Uint8Array(32),
      rawHashKey: new Uint8Array(32),
    };

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
    const fakeKeys = {
      encryptionKey: {} as CryptoKey,
      hashKey: {} as CryptoKey,
      salt: new Uint8Array([1, 2, 3]),
      rawEncryptionKey: new Uint8Array(32),
      rawHashKey: new Uint8Array(32),
    };

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

  it('reports remembered-browser key-check failures and clears persisted keys', async () => {
    const fakeKeys = {
      encryptionKey: {} as CryptoKey,
      hashKey: {} as CryptoKey,
      salt: new Uint8Array([1, 2, 3]),
      rawEncryptionKey: new Uint8Array(32),
      rawHashKey: new Uint8Array(32),
    };

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
});
