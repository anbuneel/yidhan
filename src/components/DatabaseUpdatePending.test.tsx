import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatabaseUpdatePending } from './DatabaseUpdatePending';

describe('DatabaseUpdatePending', () => {
  const props = {
    appliedVersion: 1,
    requiredVersion: 2,
    onRetry: () => undefined,
    isRetrying: false,
  };

  it('says a database update is pending', () => {
    render(<DatabaseUpdatePending {...props} />);
    expect(screen.getByRole('heading', { name: /database update is pending/i })).toBeInTheDocument();
  });

  it('tells the reader their notes are safe', () => {
    // The failure this replaces was silent: writes blocked in the queue and nothing
    // said why. The one thing the reader needs to know is that nothing is lost.
    render(<DatabaseUpdatePending {...props} />);
    expect(screen.getByText(/notes are safe and unchanged/i)).toBeInTheDocument();
  });

  it('names both versions, so a maintainer can act on it', () => {
    render(<DatabaseUpdatePending {...props} />);
    expect(screen.getByText(/version 1 · this version needs 2/i)).toBeInTheDocument();
  });

  it('offers a retry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<DatabaseUpdatePending {...props} onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /check again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables the retry while a check is running', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<DatabaseUpdatePending {...props} onRetry={onRetry} isRetrying />);

    const button = screen.getByRole('button', { name: /checking/i });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
