/**
 * PassphraseSetup.test.tsx — Phase 3
 *
 * Tests the first-time E2EE passphrase setup screen.
 * Validates form behavior, validation rules, and submission flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PassphraseSetup } from './PassphraseSetup';

// Mock dependencies
const mockSetupPassphrase = vi.fn();
const mockCreateEncryptedNote = vi.fn();
const mockCreateTagOffline = vi.fn();
const mockAddTagToNoteOffline = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-setup-1' },
  }),
}));

vi.mock('../contexts/EncryptionContext', () => ({
  useEncryption: () => ({
    setupPassphrase: mockSetupPassphrase,
  }),
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PassphraseSetup', () => {
  it('should render the setup form', () => {
    render(<PassphraseSetup />);

    expect(screen.getByText('Protect Your Notes')).toBeInTheDocument();
    expect(screen.getByLabelText('Passphrase')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm passphrase')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable Encryption' })).toBeInTheDocument();
  });

  it('should disable submit button when form is incomplete', () => {
    render(<PassphraseSetup />);

    const button = screen.getByRole('button', { name: 'Enable Encryption' });
    expect(button).toBeDisabled();
  });

  it('should enable submit when all fields are valid', async () => {
    const user = userEvent.setup();
    render(<PassphraseSetup />);

    await user.type(screen.getByLabelText('Passphrase'), 'mypassphrase123');
    await user.type(screen.getByLabelText('Confirm passphrase'), 'mypassphrase123');
    await user.click(screen.getByRole('checkbox'));

    const button = screen.getByRole('button', { name: 'Enable Encryption' });
    expect(button).not.toBeDisabled();
  });

  it('should show mismatch inline hint when confirm differs', async () => {
    const user = userEvent.setup();
    render(<PassphraseSetup />);

    await user.type(screen.getByLabelText('Passphrase'), 'mypassphrase123');
    await user.type(screen.getByLabelText('Confirm passphrase'), 'different');

    expect(screen.getByText('Passphrases do not match')).toBeInTheDocument();
  });

  it('should call setupPassphrase and onComplete on successful submit', async () => {
    const mockKeys = { encryptionKey: {}, hashKey: {}, salt: new Uint8Array(16) };
    mockSetupPassphrase.mockResolvedValue(mockKeys);
    mockCreateTagOffline.mockResolvedValue({ id: 'tag-id', name: 'Recipes', color: 'sage' });
    mockCreateEncryptedNote.mockResolvedValue({ id: 'note-id' });
    mockAddTagToNoteOffline.mockResolvedValue(undefined);
    const onComplete = vi.fn();
    const user = userEvent.setup();

    render(<PassphraseSetup onComplete={onComplete} />);

    await user.type(screen.getByLabelText('Passphrase'), 'mypassphrase123');
    await user.type(screen.getByLabelText('Confirm passphrase'), 'mypassphrase123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Enable Encryption' }));

    await waitFor(() => {
      expect(mockSetupPassphrase).toHaveBeenCalledWith('mypassphrase123');
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it('should create starter notes and tag after setup', async () => {
    const mockKeys = { encryptionKey: {}, hashKey: {}, salt: new Uint8Array(16) };
    mockSetupPassphrase.mockResolvedValue(mockKeys);
    mockCreateTagOffline.mockResolvedValue({ id: 'tag-recipes-id', name: 'Recipes', color: 'sage' });
    mockCreateEncryptedNote.mockResolvedValue({ id: 'note-id' });
    mockAddTagToNoteOffline.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<PassphraseSetup />);

    await user.type(screen.getByLabelText('Passphrase'), 'mypassphrase123');
    await user.type(screen.getByLabelText('Confirm passphrase'), 'mypassphrase123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Enable Encryption' }));

    await waitFor(() => {
      // Should create the Recipes tag
      expect(mockCreateTagOffline).toHaveBeenCalledWith('user-setup-1', 'Recipes', 'sage');
      // Should create 4 starter notes
      expect(mockCreateEncryptedNote).toHaveBeenCalledTimes(4);
      // First note should be pinned welcome
      expect(mockCreateEncryptedNote).toHaveBeenCalledWith(
        'user-setup-1',
        'Welcome to Yidhan',
        expect.stringContaining('calm space for your thoughts'),
        mockKeys,
        true
      );
    });
  });

  it('should still complete if starter note creation fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockKeys = { encryptionKey: {}, hashKey: {}, salt: new Uint8Array(16) };
    mockSetupPassphrase.mockResolvedValue(mockKeys);
    mockCreateTagOffline.mockRejectedValue(new Error('DB error'));
    const onComplete = vi.fn();
    const user = userEvent.setup();

    render(<PassphraseSetup onComplete={onComplete} />);

    await user.type(screen.getByLabelText('Passphrase'), 'mypassphrase123');
    await user.type(screen.getByLabelText('Confirm passphrase'), 'mypassphrase123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Enable Encryption' }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to create starter notes');
    });
    consoleSpy.mockRestore();
  });

  it('should show error if setupPassphrase fails', async () => {
    mockSetupPassphrase.mockRejectedValue(new Error('Key derivation failed'));
    const user = userEvent.setup();

    render(<PassphraseSetup />);

    await user.type(screen.getByLabelText('Passphrase'), 'mypassphrase123');
    await user.type(screen.getByLabelText('Confirm passphrase'), 'mypassphrase123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Enable Encryption' }));

    await waitFor(() => {
      expect(screen.getByText('Key derivation failed')).toBeInTheDocument();
    });
  });

  it('should show submitting state during setup', async () => {
    // Make setupPassphrase hang
    mockSetupPassphrase.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<PassphraseSetup />);

    await user.type(screen.getByLabelText('Passphrase'), 'mypassphrase123');
    await user.type(screen.getByLabelText('Confirm passphrase'), 'mypassphrase123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Enable Encryption' }));

    expect(screen.getByText('Setting up encryption...')).toBeInTheDocument();
  });

  it('should display the no-recovery warning checkbox', () => {
    render(<PassphraseSetup />);

    expect(
      screen.getByText(/if I forget this passphrase, my notes cannot be recovered/i)
    ).toBeInTheDocument();
  });
});
