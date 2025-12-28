import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeaderShell } from './HeaderShell';
import { useAuth } from '../contexts/AuthContext';

// Mock the auth context
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('HeaderShell', () => {
  const defaultProps = {
    theme: 'dark' as const,
    onThemeToggle: vi.fn(),
  };

  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: unauthenticated
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      signOut: mockSignOut,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signInWithGitHub: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
      updateProfile: vi.fn(),
      clearPasswordRecovery: vi.fn(),
      initiateOffboarding: vi.fn(),
      cancelOffboarding: vi.fn(),
      isPasswordRecovery: false,
      isDeparting: false,
      daysUntilRelease: null,
      loading: false,
    });
  });

  describe('rendering', () => {
    it('renders the logo by default', () => {
      render(<HeaderShell {...defaultProps} />);
      expect(screen.getByText('Zenote')).toBeInTheDocument();
    });

    it('renders clickable logo when onLogoClick is provided', async () => {
      const user = userEvent.setup();
      const onLogoClick = vi.fn();
      render(<HeaderShell {...defaultProps} onLogoClick={onLogoClick} />);

      await user.click(screen.getByText('Zenote'));
      expect(onLogoClick).toHaveBeenCalled();
    });

    it('renders custom left content instead of logo', () => {
      render(
        <HeaderShell
          {...defaultProps}
          leftContent={<div data-testid="custom-left">Custom</div>}
        />
      );

      expect(screen.getByTestId('custom-left')).toBeInTheDocument();
      expect(screen.queryByText('Zenote')).not.toBeInTheDocument();
    });

    it('renders center content (in both desktop and mobile slots)', () => {
      render(
        <HeaderShell
          {...defaultProps}
          center={<input placeholder="Search..." />}
        />
      );

      // Center content is rendered twice: desktop (hidden sm:flex) and mobile (sm:hidden)
      const inputs = screen.getAllByPlaceholderText('Search...');
      expect(inputs).toHaveLength(2);
    });

    it('renders right actions with separator', () => {
      render(
        <HeaderShell
          {...defaultProps}
          rightActions={<button>Delete</button>}
        />
      );

      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  describe('theme toggle', () => {
    it('shows moon icon for light theme', () => {
      render(<HeaderShell {...defaultProps} theme="light" />);
      expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
    });

    it('shows sun icon for dark theme', () => {
      render(<HeaderShell {...defaultProps} theme="dark" />);
      expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
    });

    it('calls onThemeToggle when clicked', async () => {
      const user = userEvent.setup();
      const onThemeToggle = vi.fn();
      render(<HeaderShell {...defaultProps} onThemeToggle={onThemeToggle} />);

      await user.click(screen.getByLabelText('Toggle theme'));
      expect(onThemeToggle).toHaveBeenCalled();
    });
  });

  describe('unauthenticated state', () => {
    it('shows Sign In button when onSignIn provided', () => {
      const onSignIn = vi.fn();
      render(<HeaderShell {...defaultProps} onSignIn={onSignIn} />);

      expect(screen.getByText('Sign In')).toBeInTheDocument();
    });

    it('calls onSignIn when Sign In clicked', async () => {
      const user = userEvent.setup();
      const onSignIn = vi.fn();
      render(<HeaderShell {...defaultProps} onSignIn={onSignIn} />);

      await user.click(screen.getByText('Sign In'));
      expect(onSignIn).toHaveBeenCalled();
    });

    it('does not show avatar button', () => {
      render(<HeaderShell {...defaultProps} />);
      expect(screen.queryByLabelText('Profile menu')).not.toBeInTheDocument();
    });
  });

  describe('authenticated state', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'user-123',
          email: 'john@example.com',
          user_metadata: { full_name: 'John Doe' },
          app_metadata: {},
          aud: 'authenticated',
          created_at: '2024-01-01',
        },
        signOut: mockSignOut,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGitHub: vi.fn(),
        resetPassword: vi.fn(),
        updatePassword: vi.fn(),
        updateProfile: vi.fn(),
        clearPasswordRecovery: vi.fn(),
        initiateOffboarding: vi.fn(),
        cancelOffboarding: vi.fn(),
        isPasswordRecovery: false,
        isDeparting: false,
        daysUntilRelease: null,
        loading: false,
      });
    });

    it('shows avatar with initials', () => {
      render(<HeaderShell {...defaultProps} />);
      expect(screen.getByLabelText('Profile menu')).toBeInTheDocument();
      expect(screen.getByText('JD')).toBeInTheDocument(); // John Doe initials
    });

    it('shows first letter of email if no name', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'user-123',
          email: 'alice@example.com',
          user_metadata: {},
          app_metadata: {},
          aud: 'authenticated',
          created_at: '2024-01-01',
        },
        signOut: mockSignOut,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGitHub: vi.fn(),
        resetPassword: vi.fn(),
        updatePassword: vi.fn(),
        updateProfile: vi.fn(),
        clearPasswordRecovery: vi.fn(),
        initiateOffboarding: vi.fn(),
        cancelOffboarding: vi.fn(),
        isPasswordRecovery: false,
        isDeparting: false,
        daysUntilRelease: null,
        loading: false,
      });

      render(<HeaderShell {...defaultProps} />);
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('opens profile menu when avatar clicked', async () => {
      const user = userEvent.setup();
      render(<HeaderShell {...defaultProps} />);

      await user.click(screen.getByLabelText('Profile menu'));

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('Sign out')).toBeInTheDocument();
    });

    it('closes profile menu when clicking outside', async () => {
      const user = userEvent.setup();
      render(<HeaderShell {...defaultProps} />);

      await user.click(screen.getByLabelText('Profile menu'));
      expect(screen.getByText('Sign out')).toBeInTheDocument();

      // Simulate click outside using fireEvent (mousedown is what the handler listens for)
      fireEvent.mouseDown(document.body);

      expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
    });

    it('calls signOut when Sign out clicked', async () => {
      const user = userEvent.setup();
      render(<HeaderShell {...defaultProps} />);

      await user.click(screen.getByLabelText('Profile menu'));
      await user.click(screen.getByText('Sign out'));

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('shows Settings when onSettingsClick provided', async () => {
      const user = userEvent.setup();
      const onSettingsClick = vi.fn();
      render(<HeaderShell {...defaultProps} onSettingsClick={onSettingsClick} />);

      await user.click(screen.getByLabelText('Profile menu'));
      expect(screen.getByText('Settings')).toBeInTheDocument();

      await user.click(screen.getByText('Settings'));
      expect(onSettingsClick).toHaveBeenCalled();
    });

    it('renders custom menu sections', async () => {
      const user = userEvent.setup();
      const menuItem = {
        label: 'Export Notes',
        icon: <span data-testid="export-icon">📤</span>,
        onClick: vi.fn(),
      };

      render(
        <HeaderShell
          {...defaultProps}
          menuSections={[{ items: [menuItem] }]}
        />
      );

      await user.click(screen.getByLabelText('Profile menu'));
      expect(screen.getByText('Export Notes')).toBeInTheDocument();
      expect(screen.getByTestId('export-icon')).toBeInTheDocument();

      await user.click(screen.getByText('Export Notes'));
      expect(menuItem.onClick).toHaveBeenCalled();
    });

    it('renders menu item badges', async () => {
      const user = userEvent.setup();
      const menuItem = {
        label: 'Notifications',
        icon: <span>🔔</span>,
        onClick: vi.fn(),
        badge: <span data-testid="badge">5</span>,
      };

      render(
        <HeaderShell
          {...defaultProps}
          menuSections={[{ items: [menuItem] }]}
        />
      );

      await user.click(screen.getByLabelText('Profile menu'));
      expect(screen.getByTestId('badge')).toBeInTheDocument();
    });
  });

  describe('initials extraction', () => {
    it('extracts initials from two-word name', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { full_name: 'Alice Brown' },
          app_metadata: {},
          aud: 'authenticated',
          created_at: '2024-01-01',
        },
        signOut: mockSignOut,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGitHub: vi.fn(),
        resetPassword: vi.fn(),
        updatePassword: vi.fn(),
        updateProfile: vi.fn(),
        clearPasswordRecovery: vi.fn(),
        initiateOffboarding: vi.fn(),
        cancelOffboarding: vi.fn(),
        isPasswordRecovery: false,
        isDeparting: false,
        daysUntilRelease: null,
        loading: false,
      });

      render(<HeaderShell {...defaultProps} />);
      expect(screen.getByText('AB')).toBeInTheDocument();
    });

    it('extracts single initial from one-word name', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { full_name: 'Charlie' },
          app_metadata: {},
          aud: 'authenticated',
          created_at: '2024-01-01',
        },
        signOut: mockSignOut,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGitHub: vi.fn(),
        resetPassword: vi.fn(),
        updatePassword: vi.fn(),
        updateProfile: vi.fn(),
        clearPasswordRecovery: vi.fn(),
        initiateOffboarding: vi.fn(),
        cancelOffboarding: vi.fn(),
        isPasswordRecovery: false,
        isDeparting: false,
        daysUntilRelease: null,
        loading: false,
      });

      render(<HeaderShell {...defaultProps} />);
      expect(screen.getByText('C')).toBeInTheDocument();
    });

    it('extracts first and last initials from multi-word name', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { full_name: 'John Middle Smith' },
          app_metadata: {},
          aud: 'authenticated',
          created_at: '2024-01-01',
        },
        signOut: mockSignOut,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGitHub: vi.fn(),
        resetPassword: vi.fn(),
        updatePassword: vi.fn(),
        updateProfile: vi.fn(),
        clearPasswordRecovery: vi.fn(),
        initiateOffboarding: vi.fn(),
        cancelOffboarding: vi.fn(),
        isPasswordRecovery: false,
        isDeparting: false,
        daysUntilRelease: null,
        loading: false,
      });

      render(<HeaderShell {...defaultProps} />);
      expect(screen.getByText('JS')).toBeInTheDocument();
    });
  });
});
