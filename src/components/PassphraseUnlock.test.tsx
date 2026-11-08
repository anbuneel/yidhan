/**
 * PassphraseUnlock.test.tsx — Phase 3
 *
 * Tests the returning user E2EE unlock screen.
 * Validates form behavior, error states, and sign-out flow.
 *
 * `userEvent.setup({ delay: null })` is deliberate. The lockout test types
 * 80 characters across five attempts, and user-event's default per-keystroke
 * delay pushed that past the 5s timeout whenever the full suite ran in
 * parallel. The timeout left keystrokes in flight that landed in the next
 * test's input, so a second, unrelated test failed with an interleaved
 * passphrase. Keep the delay disabled.
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
const mockUnlockWithRecoveryKey = vi.fn();
const authState = vi.hoisted(() => ({
  user: { id: 'user-unlock-1' } as { id: string; user_metadata?: Record<string, unknown> },
}));

const b64 = (length: number) => btoa(String.fromCharCode(...new Uint8Array(length).fill(1)));
const VALID_VAULT = {
  version: 1,
  wrapVersion: 1,
  kekSalt: b64(16),
  wrappedKey: b64(80),
  wrapIv: b64(12),
  keyCheck: b64(40),
  keyCheckIv: b64(12),
  keyCheckVersion: 1,
  migratedAt: '2026-11-08T00:00:00.000Z',
};
const RECOVERY_WRAP = {
  version: 1,
  recoveryVersion: 1,
  wrappedKey: b64(80),
  wrapIv: b64(12),
  createdAt: '2026-11-08T00:00:00.000Z',
};

vi.mock('../contexts/EncryptionContext', () => ({
  useEncryption: () => ({
    unlockWithPassphrase: mockUnlockWithPassphrase,
    unlockWithRecoveryKey: mockUnlockWithRecoveryKey,
    lockVault: mockLockVault,
  }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
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
  localStorage.clear();
  authState.user = { id: 'user-unlock-1' };
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
    const user = userEvent.setup({ delay: null });
    render(<PassphraseUnlock />);

    await user.type(screen.getByLabelText('Passphrase'), 'mypassphrase');

    const button = screen.getByRole('button', { name: 'Unlock' });
    expect(button).not.toBeDisabled();
  });

  it('should call unlockWithPassphrase on submit', async () => {
    mockUnlockWithPassphrase.mockResolvedValue(true);
    const user = userEvent.setup({ delay: null });

    render(<PassphraseUnlock />);

    await user.type(screen.getByLabelText('Passphrase'), 'correct-passphrase');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => {
      expect(mockUnlockWithPassphrase).toHaveBeenCalledWith('correct-passphrase');
    });
  });

  it('should show error for incorrect passphrase', async () => {
    mockUnlockWithPassphrase.mockResolvedValue(false);
    const user = userEvent.setup({ delay: null });

    render(<PassphraseUnlock />);

    await user.type(screen.getByLabelText('Passphrase'), 'wrong-passphrase');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => {
      expect(screen.getByText('Incorrect passphrase. 4 attempts remaining before a short lockout.')).toBeInTheDocument();
    });
  });

  it('should clear passphrase field after failed attempt', async () => {
    mockUnlockWithPassphrase.mockResolvedValue(false);
    const user = userEvent.setup({ delay: null });

    render(<PassphraseUnlock />);

    const input = screen.getByLabelText('Passphrase');
    await user.type(input, 'wrong-passphrase');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('locks the form after repeated incorrect attempts', async () => {
    mockUnlockWithPassphrase.mockResolvedValue(false);
    const user = userEvent.setup({ delay: null });

    render(<PassphraseUnlock />);

    for (let attempt = 0; attempt < 5; attempt++) {
      await user.type(screen.getByLabelText('Passphrase'), 'wrong-passphrase');
      await user.click(screen.getByRole('button', { name: /Unlock|Locked for/ }));
    }

    await waitFor(() => {
      expect(screen.getByText(/Too many incorrect attempts/)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Locked for/ })).toBeDisabled();
  });

  it('does not call unlock while a stored lockout is active', async () => {
    localStorage.setItem(
      'yidhan-user-unlock-1-vault-unlock-lockout',
      JSON.stringify({ failedAttempts: 5, lockedUntil: Date.now() + 60_000 })
    );
    const user = userEvent.setup({ delay: null });

    render(<PassphraseUnlock />);

    const input = screen.getByLabelText('Passphrase');
    await user.type(input, 'correct-passphrase');
    fireEvent.submit(input.closest('form')!);

    expect(mockUnlockWithPassphrase).not.toHaveBeenCalled();
    expect(screen.getByText(/Too many incorrect attempts/)).toBeInTheDocument();
  });

  it('clears stored lockout state after a successful unlock', async () => {
    localStorage.setItem(
      'yidhan-user-unlock-1-vault-unlock-lockout',
      JSON.stringify({ failedAttempts: 2, lockedUntil: null })
    );
    mockUnlockWithPassphrase.mockResolvedValue(true);
    const user = userEvent.setup({ delay: null });

    render(<PassphraseUnlock />);

    await user.type(screen.getByLabelText('Passphrase'), 'correct-passphrase');
    await user.click(screen.getByRole('button', { name: /Unlock|Locked for/ }));

    await waitFor(() => {
      expect(mockUnlockWithPassphrase).toHaveBeenCalledWith('correct-passphrase');
    });
    expect(localStorage.getItem('yidhan-user-unlock-1-vault-unlock-lockout')).toBeNull();
  });

  it('should show error when unlock throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUnlockWithPassphrase.mockRejectedValue(new Error('Crypto error'));
    const user = userEvent.setup({ delay: null });

    render(<PassphraseUnlock />);

    await user.type(screen.getByLabelText('Passphrase'), 'some-passphrase');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => {
      expect(screen.getByText('Unlock failed: Crypto error')).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });

  it('does not record a failed attempt when unlock fails due to vault metadata', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUnlockWithPassphrase.mockRejectedValue(
      new Error('Vault metadata is incomplete. Please sign out and sign back in.')
    );
    const user = userEvent.setup({ delay: null });

    render(<PassphraseUnlock />);

    await user.type(screen.getByLabelText('Passphrase'), 'correct-passphrase');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => {
      expect(
        screen.getByText('Unlock failed: Vault metadata is incomplete. Please sign out and sign back in.')
      ).toBeInTheDocument();
    });
    expect(localStorage.getItem('yidhan-user-unlock-1-vault-unlock-lockout')).toBeNull();
    consoleSpy.mockRestore();
  });

  it('should show submitting state during unlock', async () => {
    mockUnlockWithPassphrase.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup({ delay: null });

    render(<PassphraseUnlock />);

    await user.type(screen.getByLabelText('Passphrase'), 'passphrase');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(screen.getByText('Unlocking...')).toBeInTheDocument();
  });

  it('should show empty passphrase error on submit without input', async () => {
    const user = userEvent.setup({ delay: null });
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
    const user = userEvent.setup({ delay: null });
    render(<PassphraseUnlock />);

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(mockLockVault).toHaveBeenCalledWith('sign-out');
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should show the "Remember this browser" checkbox', () => {
    render(<PassphraseUnlock />);

    expect(screen.getByText('Remember this browser')).toBeInTheDocument();
    expect(
      screen.getByText(/Only use on personal devices\./)
    ).toBeInTheDocument();
  });

  it('should call setRememberBrowser when checkbox is toggled', async () => {
    const user = userEvent.setup({ delay: null });
    render(<PassphraseUnlock />);

    await user.click(screen.getByRole('checkbox'));
    expect(mockSetRememberBrowser).toHaveBeenCalledWith(true);
  });

  describe('recovery key (item 26)', () => {
    it('still offers the recovery key when this tab knows of none: it may have been made on another device', async () => {
      authState.user = { id: 'user-unlock-1', user_metadata: { vault: VALID_VAULT } };
      mockUnlockWithRecoveryKey.mockResolvedValueOnce('unavailable');
      render(<PassphraseUnlock />);
      expect(screen.getByText(/Without a recovery key, a forgotten passphrase cannot be recovered/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Use your recovery key' }));
      fireEvent.change(await screen.findByLabelText('Recovery key'), { target: { value: 'ABCD' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('doesn’t have a recovery key yet');
    });

    it('switches to the recovery key form and back', async () => {
      authState.user = { id: 'user-unlock-1', user_metadata: { vault: { ...VALID_VAULT, recoveryWrap: RECOVERY_WRAP } } };
      render(<PassphraseUnlock />);
      expect(screen.getByText(/or your recovery key if you’ve forgotten it/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Use your recovery key' }));

      expect(await screen.findByLabelText('Recovery key')).toBeInTheDocument();
      expect(screen.queryByLabelText('Passphrase')).toBeNull();
      expect(screen.getByText(/choose a new passphrase next/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Use your passphrase instead' }));
      expect(screen.getByLabelText('Passphrase')).toBeInTheDocument();
    });

    it('says plainly when a recovery key does not open the notes, and never echoes it', async () => {
      authState.user = { id: 'user-unlock-1', user_metadata: { vault: { ...VALID_VAULT, recoveryWrap: RECOVERY_WRAP } } };
      mockUnlockWithRecoveryKey.mockResolvedValueOnce('wrong').mockResolvedValueOnce('invalid');
      render(<PassphraseUnlock />);
      fireEvent.click(screen.getByRole('button', { name: 'Use your recovery key' }));
      const input = await screen.findByLabelText('Recovery key');

      fireEvent.change(input, { target: { value: 'ABCD-EFGH' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('doesn’t open these notes');
      expect(mockUnlockWithRecoveryKey).toHaveBeenCalledWith('ABCD-EFGH');
      // A wrong key does not count toward the passphrase lockout.
      expect(localStorage.getItem('yidhan-user-unlock-1-vault-unlock-lockout')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('52 letters and digits'));
      expect(screen.getByRole('alert').textContent).not.toContain('ABCD-EFGH');
    });
  });
});
