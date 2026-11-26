import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { UseSessionSettingsResult } from '../hooks/useSessionSettings';
import type { UseVaultSettingsResult } from '../hooks/useVaultSettings';

// Copy tests for the Security tab. The recovery key status comes from the
// account's vault metadata; the parsers are mocked so each case sets it directly.
const mockUser: { user_metadata: Record<string, unknown>; app_metadata: Record<string, unknown>; email: string } = {
  user_metadata: { vault: {} },
  app_metadata: { provider: 'email' },
  email: 'writer@example.test',
};
let recoveryStatus: 'valid' | 'absent' = 'absent';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    updateProfile: vi.fn(),
    updatePassword: vi.fn(),
    verifyPassword: vi.fn(),
  }),
}));
vi.mock('../lib/vaultMetadata', () => ({
  readVaultMetadata: () => ({ status: 'valid' }),
  readRecoveryWrap: () => ({ status: recoveryStatus }),
}));
vi.mock('./RecoveryKeySettings', () => ({ RecoveryKeySettings: () => null }));

import { SettingsModal } from './SettingsModal';

const sessionSettings = {
  settings: { timeoutMinutes: 10080, isTrustedDevice: false, trustedAt: null },
  setTimeoutMinutes: vi.fn(),
  enableTrustedDevice: vi.fn(),
  disableTrustedDevice: vi.fn(),
  toggleTrustedDevice: vi.fn(),
  getEffectiveTimeout: () => 10080,
  availableTimeoutOptions: [{ label: '1 week', value: 10080 }],
} as UseSessionSettingsResult;

const vaultSettings = {
  settings: { autoLockMinutes: 15, rememberBrowser: false },
  setAutoLockMinutes: vi.fn(),
  setRememberBrowser: vi.fn(),
} as unknown as UseVaultSettingsResult;

function openSecurityTab() {
  render(
    <SettingsModal
      isOpen
      onClose={vi.fn()}
      theme="dark"
      onThemeToggle={vi.fn()}
      onLetGoClick={vi.fn()}
      sessionSettings={sessionSettings}
      vaultSettings={vaultSettings}
      isVaultUnlocked
      onLockVault={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Security' }));
}

describe('SettingsModal Security tab', () => {
  beforeEach(() => { recoveryStatus = 'absent'; });

  it('does not claim the trusted device extends the session', () => {
    openSecurityTab();

    expect(screen.queryByText(/14 days/)).not.toBeInTheDocument();
    expect(screen.getByText(/Allows a session timeout of Never/)).toBeInTheDocument();
  });

  it('tells an account with a recovery key how to change the passphrase', () => {
    recoveryStatus = 'valid';
    openSecurityTab();

    expect(screen.getByText('Change passphrase')).toBeInTheDocument();
    expect(screen.getByText(/lock your notes and choose ‘Use your recovery key’ on the unlock screen/)).toBeInTheDocument();
    expect(screen.queryByText(/you need a recovery key first/)).not.toBeInTheDocument();
  });

  it('tells an account without a recovery key to make one first', () => {
    openSecurityTab();

    expect(screen.getByText(/you need a recovery key first/)).toBeInTheDocument();
    expect(screen.getByText(/choose ‘Use your recovery key’ on the unlock screen/)).toBeInTheDocument();
  });
});
