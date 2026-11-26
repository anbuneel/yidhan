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
vi.mock('./RecoveryKeySettings', () => ({
  RecoveryKeySettings: () => <button type="button">Make a recovery key</button>,
}));

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

function openSecurityTab({ unlocked = true } = {}) {
  render(
    <SettingsModal
      isOpen
      onClose={vi.fn()}
      theme="dark"
      onThemeToggle={vi.fn()}
      onLetGoClick={vi.fn()}
      sessionSettings={sessionSettings}
      vaultSettings={vaultSettings}
      isVaultUnlocked={unlocked}
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

  it.each([true, false])('tells an account with a recovery key how to change the passphrase (unlocked: %s)', (unlocked) => {
    recoveryStatus = 'valid';
    openSecurityTab({ unlocked });

    expect(screen.getByText('Change passphrase')).toBeInTheDocument();
    expect(screen.getByText(/lock your notes and choose ‘Use your recovery key’ on the unlock screen/)).toBeInTheDocument();
    // The no-key text and its button never show when a key exists.
    expect(screen.queryByText(/Make a recovery key first/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to Recovery key' })).not.toBeInTheDocument();
  });

  it('tells an account without a recovery key to make one first', () => {
    openSecurityTab();

    expect(screen.getByText('Make a recovery key first. You’ll need it to change your passphrase.')).toBeInTheDocument();
    expect(screen.queryByText(/lock your notes and choose/)).not.toBeInTheDocument();
  });

  it('moves focus to the Recovery key row from the Change passphrase row', () => {
    const original = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      openSecurityTab();

      fireEvent.click(screen.getByRole('button', { name: 'Go to Recovery key' }));

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Make a recovery key' })).toHaveFocus();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('shows no Go to Recovery key button while the notes are locked', () => {
    // The Recovery key row is not rendered while locked, so there is nowhere to go.
    openSecurityTab({ unlocked: false });

    expect(screen.getByText(/Make a recovery key first/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to Recovery key' })).not.toBeInTheDocument();
  });
});
