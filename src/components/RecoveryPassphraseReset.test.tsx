/**
 * Item 26: the new-passphrase screen after a recovery-key unlock.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecoveryPassphraseReset } from './RecoveryPassphraseReset';

const mockSetPassphraseAfterRecovery = vi.fn();
const mockCancelRecovery = vi.fn();

vi.mock('../contexts/EncryptionContext', () => ({
  useEncryption: () => ({
    setPassphraseAfterRecovery: mockSetPassphraseAfterRecovery,
    cancelRecovery: mockCancelRecovery,
  }),
}));

const GOOD = 'a quiet harbour at dawn 7';

function fill(passphrase: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('New passphrase'), { target: { value: passphrase } });
  fireEvent.change(screen.getByLabelText('Confirm new passphrase'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Save passphrase' }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RecoveryPassphraseReset', () => {
  it('saves a new passphrase that meets the policy and matches its confirmation', async () => {
    mockSetPassphraseAfterRecovery.mockResolvedValueOnce(undefined);
    render(<RecoveryPassphraseReset />);
    fill(GOOD, GOOD);
    await waitFor(() => expect(mockSetPassphraseAfterRecovery).toHaveBeenCalledWith(GOOD));
  });

  it('does not save a passphrase that is too short or does not match', () => {
    render(<RecoveryPassphraseReset />);
    fill('short', 'short');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fill(GOOD, `${GOOD}!`);
    expect(screen.getByRole('alert')).toHaveTextContent('don’t match');
    expect(mockSetPassphraseAfterRecovery).not.toHaveBeenCalled();
  });

  it('says what happened when the save does not land, and lets the writer try again', async () => {
    mockSetPassphraseAfterRecovery
      .mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'offline' }))
      .mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'failed' }))
      .mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'changed' }));
    render(<RecoveryPassphraseReset />);
    fill(GOOD, GOOD);
    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing has changed yet');
    fireEvent.click(screen.getByRole('button', { name: 'Save passphrase' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('recovery key still works'));
    fireEvent.click(screen.getByRole('button', { name: 'Save passphrase' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('another device'));
  });

  it('cancels back to the unlock screen', () => {
    render(<RecoveryPassphraseReset />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockCancelRecovery).toHaveBeenCalled();
  });
});
