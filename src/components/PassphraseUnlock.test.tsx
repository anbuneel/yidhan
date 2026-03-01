/**
 * PassphraseUnlock.test.tsx — Phase 3
 *
 * Tests the returning user E2EE unlock screen.
 * Validates form behavior, error states, and sign-out flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PassphraseUnlock } from './PassphraseUnlock';

// Mock dependencies
const mockUnlockWithPassphrase = vi.fn();
const mockLockVault = vi.fn();
const mockSignOut = vi.fn();
const mockSetRememberBrowser = vi.fn();

vi.mock('../contexts/EncryptionContext', () => ({
  useEncryption: () => ({
    unlockWithPassphrase: mockUnlockWithPassphrase,
    lockVault: mockLockVault,
  }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-unlock-1' },
    signOut: mockSignOut,
  }),
}));

vi.mock('../hooks/useVaultSettings', () => ({
  useVaultSettings: () => ({
    settings: { autoLockMinutes: 0, rememberBrowser: false },
    setAutoLockMinutes: vi.fn(),
    setRememberBrowser: mockSetRememberBrowser,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PassphraseUnlock', () => {
  it('should render the unlock form', () => {
    render(<PassphraseUnlock />);

    expect(screen.getByText('Unlock Your Notes')).toBeInTheDocument();
    expect(screen.getByLabelText('Passphrase')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('should disable unlock button when passphrase is empty', () => {
    render(<PassphraseUnlock />);

    const button = screen.getByRole('button', { name: 'Unlock' });
    expect(button).toBeDisabled();
  });

  it('should enable unlock button when passphrase is entered', async () => {
    const user = userEvent.setup();
    render(<PassphraseUnlock />);

    await user.type(screen.getByLabelText('Passphrase'), 'mypassphrase');

    const button = screen.getByRole('button', { name: 'Unlock' });
    expect(button).not.toBeDisabled();
  });

  it('should call unlockWithPassphrase on submit', async () => {
    mockUnlockWithPassphrase.mockResolvedValue(true);
    const user = userEvent.setup();

    render(<PassphraseUnlock />);

    await user.type(screen.getByLabelText('Passphrase'), 'correct-passphrase');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => {
      expect(mockUnlockWithPassphrase).toHaveBeenCalledWith('correct-passphrase');
    });
  });

  it('should show error for incorrect passphrase', async () => {
    mockUnlockWithPassphrase.mockResolvedValue(false);
    const user = userEvent.setup();

    render(<PassphraseUnlock />);

    await user.type(screen.getByLabelText('Passphrase'), 'wrong-passphrase');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => {
      expect(screen.getByText('Incorrect passphrase. Please try again.')).toBeInTheDocument();
    });
  });

  it('should clear passphrase field after failed attempt', async () => {
    mockUnlockWithPassphrase.mockResolvedValue(false);
    const user = userEvent.setup();

    render(<PassphraseUnlock />);

    const input = screen.getByLabelText('Passphrase');
    await user.type(input, 'wrong-passphrase');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('should show error when unlock throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUnlockWithPassphrase.mockRejectedValue(new Error('Crypto error'));
    const user = userEvent.setup();

    render(<PassphraseUnlock />);

    await user.type(screen.getByLabelText('Passphrase'), 'some-passphrase');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => {
      expect(screen.getByText('Unlock failed: Crypto error')).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });

  it('should show submitting state during unlock', async () => {
    mockUnlockWithPassphrase.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<PassphraseUnlock />);

    await user.type(screen.getByLabelText('Passphrase'), 'passphrase');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(screen.getByText('Unlocking...')).toBeInTheDocument();
  });

  it('should show empty passphrase error on submit without input', async () => {
    const user = userEvent.setup();
    render(<PassphraseUnlock />);

    // Type then clear to bypass the disabled button, then force-submit
    // the form directly to exercise the handleSubmit validation guard
    const form = screen.getByLabelText('Passphrase').closest('form');
    expect(form).not.toBeNull();
    await user.type(screen.getByLabelText('Passphrase'), 'a');
    await user.clear(screen.getByLabelText('Passphrase'));
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Please enter your passphrase')).toBeInTheDocument();
    });
  });

  it('should lock vault and sign out when sign-out button is clicked', async () => {
    const user = userEvent.setup();
    render(<PassphraseUnlock />);

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(mockLockVault).toHaveBeenCalledWith('sign-out');
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should show the "Remember this browser" checkbox', () => {
    render(<PassphraseUnlock />);

    expect(screen.getByText('Remember this browser')).toBeInTheDocument();
    expect(screen.getByText('Only use on personal devices')).toBeInTheDocument();
  });
});
