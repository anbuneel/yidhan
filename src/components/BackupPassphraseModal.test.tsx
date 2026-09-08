import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackupPassphraseModal } from './BackupPassphraseModal';

const base = {
  isOpen: true,
  onSubmit: () => undefined,
  onCancel: () => undefined,
};

describe('BackupPassphraseModal — creating a backup', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <BackupPassphraseModal {...base} mode="create" isOpen={false} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('says the backup passphrase is not the vault passphrase', async () => {
    // A reader offered a second passphrase will otherwise reasonably assume it is the
    // one they already have — and then be unable to open the file later.
    render(<BackupPassphraseModal {...base} mode="create" />);
    expect(screen.getByText(/separate from your vault passphrase/i)).toBeInTheDocument();
  });

  it('warns that a lost passphrase cannot be recovered', () => {
    render(<BackupPassphraseModal {...base} mode="create" />);
    expect(screen.getByText(/cannot recover it/i)).toBeInTheDocument();
  });

  it('enforces the passphrase policy', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<BackupPassphraseModal {...base} mode="create" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^backup passphrase$/i), 'short');
    await user.click(screen.getByRole('button', { name: /create backup/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('requires the confirmation to match', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<BackupPassphraseModal {...base} mode="create" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^backup passphrase$/i), 'Correct-Horse-99');
    await user.type(screen.getByLabelText(/type it again/i), 'Correct-Horse-98');
    await user.click(screen.getByRole('button', { name: /create backup/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i);
  });

  it('submits a passphrase that passes both checks', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<BackupPassphraseModal {...base} mode="create" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^backup passphrase$/i), 'Correct-Horse-99');
    await user.type(screen.getByLabelText(/type it again/i), 'Correct-Horse-99');
    await user.click(screen.getByRole('button', { name: /create backup/i }));

    expect(onSubmit).toHaveBeenCalledWith('Correct-Horse-99');
  });
});

describe('BackupPassphraseModal — opening a backup', () => {
  it('asks for one passphrase, not two', () => {
    render(<BackupPassphraseModal {...base} mode="open" />);

    expect(screen.getByLabelText(/^backup passphrase$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/type it again/i)).not.toBeInTheDocument();
  });

  it('refuses an empty passphrase without calling back', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<BackupPassphraseModal {...base} mode="open" onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /open backup/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the caller’s error, so a damaged file and a wrong passphrase read differently', () => {
    render(
      <BackupPassphraseModal
        {...base}
        mode="open"
        error="This backup file looks incomplete or damaged."
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/incomplete or damaged/i);
  });

  it('does not apply the vault policy to an existing backup’s passphrase', async () => {
    // The file was sealed with whatever the reader chose; refusing to try a short one
    // would lock them out of their own backup.
    const onSubmit = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<BackupPassphraseModal {...base} mode="open" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^backup passphrase$/i), 'short');
    await user.click(screen.getByRole('button', { name: /open backup/i }));

    expect(onSubmit).toHaveBeenCalledWith('short');
  });

  it('locks the controls while a check is running', () => {
    render(<BackupPassphraseModal {...base} mode="open" isBusy />);

    expect(screen.getByLabelText(/^backup passphrase$/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /opening/i })).toBeDisabled();
  });

  it('cancels', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<BackupPassphraseModal {...base} mode="open" onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
