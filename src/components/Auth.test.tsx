import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Auth } from './Auth';
import { useAuth } from '../contexts/AuthContext';

// Mock the auth context
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('Auth', () => {
  const defaultProps = {
    theme: 'dark' as const,
    onThemeToggle: vi.fn(),
  };

  const mockAuthContext = {
    user: null,
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null }),
    signInWithGoogle: vi.fn().mockResolvedValue({ error: null }),
    signInWithGitHub: vi.fn().mockResolvedValue({ error: null }),
    resetPassword: vi.fn().mockResolvedValue({ error: null }),
    updatePassword: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn(),
    updateProfile: vi.fn(),
    clearPasswordRecovery: vi.fn(),
    initiateOffboarding: vi.fn(),
    cancelOffboarding: vi.fn(),
    isPasswordRecovery: false,
    isDeparting: false,
    daysUntilRelease: null,
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(mockAuthContext);
  });

  describe('rendering', () => {
    it('renders login mode by default', () => {
      render(<Auth {...defaultProps} />);

      expect(screen.getByText('Welcome back')).toBeInTheDocument();
      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });

    it('renders signup mode when specified', () => {
      render(<Auth {...defaultProps} initialMode="signup" />);

      expect(screen.getByText('Create your account')).toBeInTheDocument();
      expect(screen.getByText('Sign Up')).toBeInTheDocument();
    });

    it('renders forgot password mode', () => {
      render(<Auth {...defaultProps} initialMode="forgot" />);

      expect(screen.getByText('Reset your password')).toBeInTheDocument();
      expect(screen.getByText('Send Reset Link')).toBeInTheDocument();
    });

    it('renders reset mode', () => {
      render(<Auth {...defaultProps} initialMode="reset" />);

      expect(screen.getByText('Set new password')).toBeInTheDocument();
      expect(screen.getByText('New Password')).toBeInTheDocument();
      expect(screen.getByText('Confirm Password')).toBeInTheDocument();
    });

    it('renders theme toggle button', () => {
      render(<Auth {...defaultProps} />);
      expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
    });

    it('shows email field for login/signup/forgot modes', () => {
      render(<Auth {...defaultProps} />);
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('shows password field for login/signup modes', () => {
      render(<Auth {...defaultProps} />);
      expect(screen.getByText('Password')).toBeInTheDocument();
    });

    it('does not show full name field in login mode', () => {
      render(<Auth {...defaultProps} />);
      expect(screen.queryByPlaceholderText('John Doe')).not.toBeInTheDocument();
    });

    it('shows full name field in signup mode', () => {
      render(<Auth {...defaultProps} initialMode="signup" />);
      expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();
    });
  });

  describe('mode switching', () => {
    it('switches from login to signup', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} />);

      await user.click(screen.getByText('Sign Up'));

      expect(screen.getByText('Create your account')).toBeInTheDocument();
    });

    it('switches from signup to login', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} initialMode="signup" />);

      await user.click(screen.getByText('Sign In'));

      expect(screen.getByText('Welcome back')).toBeInTheDocument();
    });

    it('switches from login to forgot password', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} />);

      await user.click(screen.getByText('Forgot password?'));

      expect(screen.getByText('Reset your password')).toBeInTheDocument();
    });

    it('switches from forgot to login', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} initialMode="forgot" />);

      await user.click(screen.getByText('Sign In'));

      expect(screen.getByText('Welcome back')).toBeInTheDocument();
    });

    it('clears form when switching modes', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} />);

      const emailInput = screen.getByRole('textbox');
      await user.type(emailInput, 'test@example.com');

      await user.click(screen.getByText('Sign Up'));
      await user.click(screen.getByText('Sign In'));

      // Email should still be there, but password should be cleared
      expect(emailInput).toHaveValue('test@example.com');
    });
  });

  // Helper to get password input (since labels aren't associated with inputs via htmlFor)
  const getPasswordInput = () => {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    return passwordInputs[0] as HTMLInputElement;
  };

  describe('login flow', () => {
    it('submits login form', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} />);

      await user.type(screen.getByRole('textbox'), 'test@example.com');
      await user.type(getPasswordInput(), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(mockAuthContext.signIn).toHaveBeenCalledWith(
          'test@example.com',
          'password123'
        );
      });
    });

    it('shows loading state during login', async () => {
      const user = userEvent.setup();
      mockAuthContext.signIn.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<Auth {...defaultProps} />);

      await user.type(screen.getByRole('textbox'), 'test@example.com');
      await user.type(getPasswordInput(), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows error on login failure', async () => {
      const user = userEvent.setup();
      mockAuthContext.signIn.mockResolvedValue({
        error: { message: 'Invalid login credentials' }
      });

      render(<Auth {...defaultProps} />);

      await user.type(screen.getByRole('textbox'), 'test@example.com');
      await user.type(getPasswordInput(), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
      });
    });
  });

  describe('signup flow', () => {
    it('submits signup form', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} initialMode="signup" />);

      await user.type(screen.getByPlaceholderText('John Doe'), 'Test User');
      // Email is the second textbox in signup mode (after name)
      const textboxes = screen.getAllByRole('textbox');
      await user.type(textboxes[1], 'test@example.com');
      await user.type(getPasswordInput(), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign Up' }));

      await waitFor(() => {
        expect(mockAuthContext.signUp).toHaveBeenCalledWith(
          'test@example.com',
          'password123',
          'Test User'
        );
      });
    });

    it('shows confirmation state after signup', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} initialMode="signup" />);

      const textboxes = screen.getAllByRole('textbox');
      await user.type(textboxes[1], 'test@example.com');
      await user.type(getPasswordInput(), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign Up' }));

      await waitFor(() => {
        expect(screen.getByText('Check your inbox')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByText('Resend email')).toBeInTheDocument();
      });
    });

    it('shows option to change email in confirmation state', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} initialMode="signup" />);

      const textboxes = screen.getAllByRole('textbox');
      await user.type(textboxes[1], 'test@example.com');
      await user.type(getPasswordInput(), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign Up' }));

      await waitFor(() => {
        expect(screen.getByText('Use a different email')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Use a different email'));

      expect(screen.queryByText('Check your inbox')).not.toBeInTheDocument();
    });
  });

  describe('forgot password flow', () => {
    it('submits forgot password form', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} initialMode="forgot" />);

      await user.type(screen.getByRole('textbox'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

      await waitFor(() => {
        expect(mockAuthContext.resetPassword).toHaveBeenCalledWith('test@example.com');
      });
    });

    it('shows success message after reset link sent', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} initialMode="forgot" />);

      await user.type(screen.getByRole('textbox'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

      await waitFor(() => {
        expect(screen.getByText('Check your email for a password reset link!')).toBeInTheDocument();
      });
    });
  });

  // Helper to get password inputs in reset mode (new password is first, confirm is second)
  const getPasswordInputs = () => {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    return {
      newPassword: passwordInputs[0] as HTMLInputElement,
      confirmPassword: passwordInputs[1] as HTMLInputElement,
    };
  };

  describe('password reset flow', () => {
    it('validates password length', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} initialMode="reset" />);

      const { newPassword, confirmPassword } = getPasswordInputs();
      await user.type(newPassword, 'short');
      await user.type(confirmPassword, 'short');
      await user.click(screen.getByRole('button', { name: 'Update Password' }));

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });
      expect(mockAuthContext.updatePassword).not.toHaveBeenCalled();
    });

    it('validates password match', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} initialMode="reset" />);

      const { newPassword, confirmPassword } = getPasswordInputs();
      await user.type(newPassword, 'password123');
      await user.type(confirmPassword, 'password456');
      await user.click(screen.getByRole('button', { name: 'Update Password' }));

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
      expect(mockAuthContext.updatePassword).not.toHaveBeenCalled();
    });

    it('submits password reset form when valid', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} initialMode="reset" />);

      const { newPassword, confirmPassword } = getPasswordInputs();
      await user.type(newPassword, 'newpassword123');
      await user.type(confirmPassword, 'newpassword123');
      await user.click(screen.getByRole('button', { name: 'Update Password' }));

      await waitFor(() => {
        expect(mockAuthContext.updatePassword).toHaveBeenCalledWith('newpassword123');
      });
    });

    it('calls onPasswordResetComplete callback on success', async () => {
      const user = userEvent.setup();
      const onPasswordResetComplete = vi.fn();
      render(
        <Auth
          {...defaultProps}
          initialMode="reset"
          onPasswordResetComplete={onPasswordResetComplete}
        />
      );

      const { newPassword, confirmPassword } = getPasswordInputs();
      await user.type(newPassword, 'newpassword123');
      await user.type(confirmPassword, 'newpassword123');
      await user.click(screen.getByRole('button', { name: 'Update Password' }));

      await waitFor(() => {
        expect(onPasswordResetComplete).toHaveBeenCalled();
      });
    });
  });

  describe('OAuth buttons', () => {
    it('shows Google and GitHub buttons on login', () => {
      render(<Auth {...defaultProps} />);

      expect(screen.getByText('Google')).toBeInTheDocument();
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    });

    it('shows OAuth buttons on signup', () => {
      render(<Auth {...defaultProps} initialMode="signup" />);

      expect(screen.getByText('Google')).toBeInTheDocument();
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    });

    it('does not show OAuth buttons on forgot/reset', () => {
      const { rerender } = render(<Auth {...defaultProps} initialMode="forgot" />);

      expect(screen.queryByText('Google')).not.toBeInTheDocument();
      expect(screen.queryByText('GitHub')).not.toBeInTheDocument();

      rerender(<Auth {...defaultProps} initialMode="reset" />);

      expect(screen.queryByText('Google')).not.toBeInTheDocument();
      expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
    });

    it('calls signInWithGoogle when Google button clicked', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} />);

      await user.click(screen.getByText('Google'));

      expect(mockAuthContext.signInWithGoogle).toHaveBeenCalled();
    });

    it('calls signInWithGitHub when GitHub button clicked', async () => {
      const user = userEvent.setup();
      render(<Auth {...defaultProps} />);

      await user.click(screen.getByText('GitHub'));

      expect(mockAuthContext.signInWithGitHub).toHaveBeenCalled();
    });

    it('shows redirecting state for OAuth', async () => {
      const user = userEvent.setup();
      mockAuthContext.signInWithGoogle.mockImplementation(() => new Promise(() => {}));

      render(<Auth {...defaultProps} />);

      await user.click(screen.getByText('Google'));

      expect(screen.getByText('Redirecting...')).toBeInTheDocument();
    });
  });

  describe('theme toggle', () => {
    it('calls onThemeToggle when clicked', async () => {
      const user = userEvent.setup();
      const onThemeToggle = vi.fn();
      render(<Auth {...defaultProps} onThemeToggle={onThemeToggle} />);

      await user.click(screen.getByLabelText('Toggle theme'));

      expect(onThemeToggle).toHaveBeenCalled();
    });
  });

  describe('modal mode', () => {
    it('renders as modal when isModal is true', () => {
      const { container } = render(<Auth {...defaultProps} isModal />);

      expect(container.querySelector('.auth-modal-overlay')).toBeInTheDocument();
    });

    it('renders close button in modal mode', () => {
      render(<Auth {...defaultProps} isModal />);

      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('calls onClose when close button clicked (no dirty form)', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<Auth {...defaultProps} isModal onClose={onClose} />);

      await user.click(screen.getByLabelText('Close'));

      expect(onClose).toHaveBeenCalled();
    });

    it('shows confirmation when closing with dirty form', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<Auth {...defaultProps} isModal onClose={onClose} />);

      // Type something to make form dirty
      await user.type(screen.getByRole('textbox'), 'test@example.com');
      await user.click(screen.getByLabelText('Close'));

      expect(screen.getByText('Discard changes?')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('closes modal when Discard clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<Auth {...defaultProps} isModal onClose={onClose} />);

      await user.type(screen.getByRole('textbox'), 'test@example.com');
      await user.click(screen.getByLabelText('Close'));
      await user.click(screen.getByText('Discard'));

      expect(onClose).toHaveBeenCalled();
    });

    it('keeps editing when Keep Editing clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<Auth {...defaultProps} isModal onClose={onClose} />);

      await user.type(screen.getByRole('textbox'), 'test@example.com');
      await user.click(screen.getByLabelText('Close'));
      await user.click(screen.getByText('Keep Editing'));

      expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('closes when clicking backdrop without dirty form', async () => {
      const onClose = vi.fn();
      const { container } = render(<Auth {...defaultProps} isModal onClose={onClose} />);

      const overlay = container.querySelector('.auth-modal-overlay');
      if (overlay) {
        fireEvent.click(overlay);
      }

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('error sanitization', () => {
    it('sanitizes rate limit errors', async () => {
      const user = userEvent.setup();
      mockAuthContext.signIn.mockResolvedValue({
        error: { message: 'Rate limit exceeded for this endpoint' }
      });

      render(<Auth {...defaultProps} />);

      await user.type(screen.getByRole('textbox'), 'test@example.com');
      await user.type(getPasswordInput(), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(screen.getByText('Too many attempts. Please try again later')).toBeInTheDocument();
      });
    });

    it('sanitizes network errors', async () => {
      const user = userEvent.setup();
      mockAuthContext.signIn.mockResolvedValue({
        error: { message: 'Network request failed' }
      });

      render(<Auth {...defaultProps} />);

      await user.type(screen.getByRole('textbox'), 'test@example.com');
      await user.type(getPasswordInput(), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(screen.getByText('Network error. Please check your connection')).toBeInTheDocument();
      });
    });

    it('sanitizes user exists errors', async () => {
      const user = userEvent.setup();
      mockAuthContext.signUp.mockResolvedValue({
        error: { message: 'User already registered' }
      });

      render(<Auth {...defaultProps} initialMode="signup" />);

      const textboxes = screen.getAllByRole('textbox');
      await user.type(textboxes[1], 'test@example.com');
      await user.type(getPasswordInput(), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign Up' }));

      await waitFor(() => {
        expect(screen.getByText('An account with this email already exists')).toBeInTheDocument();
      });
    });
  });
});
