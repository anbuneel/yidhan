import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReAuthModal } from './ReAuthModal';

const {
  mockUserState,
  mockVerifyPassword,
  mockConfirmAccountDeletion,
} = vi.hoisted(() => ({
  mockUserState: {
    value: {
      id: 'user-123',
      email: 'user@example.com',
      app_metadata: { provider: 'email' },
      identities: [{ provider: 'email' }],
    },
  },
  mockVerifyPassword: vi.fn(),
  mockConfirmAccountDeletion: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUserState.value,
    verifyPassword: mockVerifyPassword,
    confirmAccountDeletion: mockConfirmAccountDeletion,
  }),
}));

describe('ReAuthModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserState.value = {
      id: 'user-123',
      email: 'user@example.com',
      app_metadata: { provider: 'email' },
      identities: [{ provider: 'email' }],
    };
    mockVerifyPassword.mockResolvedValue({ success: true });
    mockConfirmAccountDeletion.mockResolvedValue({
      success: true,
      confirmationToken: 'confirmation-token',
    });
  });

  it('mints an account deletion confirmation token for password users', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(
      <ReAuthModal
        isOpen
        onSuccess={onSuccess}
        onCancel={vi.fn()}
        actionDescription="begin your departure"
        sensitiveAction="account_deletion"
      />
    );

    await user.type(screen.getByLabelText('Your password'), 'current-password');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(mockConfirmAccountDeletion).toHaveBeenCalledWith('current-password');
    });

    expect(onSuccess).toHaveBeenCalledWith('confirmation-token');
    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });

  it('blocks OAuth account deletion instead of accepting typed email as proof', async () => {
    mockUserState.value = {
      id: 'user-123',
      email: 'user@example.com',
      app_metadata: { provider: 'google' },
      identities: [{ provider: 'google' }],
    };

    render(
      <ReAuthModal
        isOpen
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
        actionDescription="begin your departure"
        sensitiveAction="account_deletion"
      />
    );

    expect(screen.queryByLabelText('Your email')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Enter your account email')).not.toBeInTheDocument();
    expect(screen.getByText(/needs a stronger/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    expect(mockConfirmAccountDeletion).not.toHaveBeenCalled();
  });
});
