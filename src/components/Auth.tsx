import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { Theme } from '../types';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

/**
 * Sanitize error messages to prevent information disclosure.
 * Maps technical/sensitive error messages to user-friendly ones.
 */
function sanitizeErrorMessage(message: string): string {
  const lowerMessage = message.toLowerCase();

  // Authentication errors - use generic messages to prevent user enumeration
  if (lowerMessage.includes('invalid login credentials') ||
      lowerMessage.includes('invalid email or password')) {
    return 'Invalid email or password';
  }

  if (lowerMessage.includes('email not confirmed')) {
    return 'Please confirm your email before signing in';
  }

  if (lowerMessage.includes('user already registered') ||
      lowerMessage.includes('already exists')) {
    return 'An account with this email already exists';
  }

  if (lowerMessage.includes('rate limit') ||
      lowerMessage.includes('too many requests')) {
    return 'Too many attempts. Please try again later';
  }

  if (lowerMessage.includes('network') ||
      lowerMessage.includes('fetch')) {
    return 'Network error. Please check your connection';
  }

  if (lowerMessage.includes('password') && lowerMessage.includes('weak')) {
    return 'Password is too weak. Please use a stronger password';
  }

  // For any unrecognized error, return a generic message
  // to avoid exposing sensitive technical details
  if (lowerMessage.includes('error') ||
      lowerMessage.includes('exception') ||
      lowerMessage.includes('failed')) {
    return 'An error occurred. Please try again';
  }

  // If the message seems safe (no technical details), return it as-is
  return message;
}

interface AuthProps {
  theme: Theme;
  onThemeToggle: () => void;
  initialMode?: AuthMode;
  onPasswordResetComplete?: () => void;
  isModal?: boolean;
  onClose?: () => void;
}

// Shared input field styles and handlers to reduce repetition
const inputBaseStyles: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--glass-border)',
  color: 'var(--color-text-primary)',
};

const inputFocusHandler = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = 'var(--color-accent)';
};

const inputBlurHandler = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = 'var(--glass-border)';
};

// Reusable OAuth button component
interface OAuthButtonProps {
  provider: 'google' | 'github';
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
}

const oauthIcons = {
  google: (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  ),
  github: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  ),
};

const oauthLabels = {
  google: 'Google',
  github: 'GitHub',
};

function OAuthButton({ provider, onClick, loading, disabled }: OAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
      style={{
        fontFamily: 'var(--font-body)',
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--glass-border)',
        color: 'var(--color-text-primary)',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = 'var(--color-accent)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--glass-border)';
      }}
    >
      {loading ? 'Redirecting...' : (
        <>
          {oauthIcons[provider]}
          {oauthLabels[provider]}
        </>
      )}
    </button>
  );
}

export function Auth({ theme, onThemeToggle, initialMode = 'login', onPasswordResetComplete, isModal = false, onClose }: AuthProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const { signIn, signUp, signInWithGoogle, signInWithGitHub, resetPassword, updatePassword } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

  // Countdown timer for resend cooldown
  // This effect creates a 1-second countdown by:
  // 1. Setting a timeout that decrements the counter after 1 second
  // 2. Re-running when resendCooldown changes (each decrement triggers next tick)
  // 3. Cleaning up the timeout on unmount or before next run to prevent memory leaks
  // The dependency on resendCooldown is intentional - it creates the countdown loop
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Check if form is dirty
        const isDirty = email.length > 0 || password.length > 0 || fullName.length > 0;
        if (isDirty && !awaitingConfirmation) {
          setShowCloseConfirm(true);
        } else {
          onClose?.();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModal, email, password, fullName, awaitingConfirmation, onClose]);

  const handleResendConfirmation = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      // Re-trigger signup which sends a new confirmation email
      const { error } = await signUp(email, password, fullName.trim() || undefined);
      if (error) {
        // "User already registered" is expected - email was sent
        if (!error.message.toLowerCase().includes('already registered')) {
          setError(sanitizeErrorMessage(error.message));
          return; // Don't show success message on error
        }
      }
      // Only show success if no unexpected error
      setResendCooldown(60); // 60 second cooldown
      setMessage('Confirmation email sent!');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setAwaitingConfirmation(false);
    setPassword('');
    setMessage(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) setError(sanitizeErrorMessage(error.message));
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password, fullName.trim() || undefined);
        if (error) {
          setError(sanitizeErrorMessage(error.message));
        } else {
          setAwaitingConfirmation(true);
          setMessage(null);
        }
      } else if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) {
          setError(sanitizeErrorMessage(error.message));
        } else {
          setMessage('Check your email for a password reset link!');
        }
      } else if (mode === 'reset') {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          return;
        }
        const { error } = await updatePassword(password);
        if (error) {
          setError(sanitizeErrorMessage(error.message));
        } else {
          setMessage('Password updated successfully!');
          setPassword('');
          setConfirmPassword('');
          // Notify parent that reset is complete
          if (onPasswordResetComplete) {
            onPasswordResetComplete();
          } else {
            setMode('login');
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setMessage(null);
    setPassword('');
    setConfirmPassword('');
    if (newMode !== 'signup') setFullName('');
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setMessage(null);
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
    // Note: on success, user will be redirected to Google, so no need to setGoogleLoading(false)
  };

  const handleGitHubSignIn = async () => {
    setError(null);
    setMessage(null);
    setGithubLoading(true);
    const { error } = await signInWithGitHub();
    if (error) {
      setError(error.message);
      setGithubLoading(false);
    }
    // Note: on success, user will be redirected to GitHub, so no need to setGithubLoading(false)
  };

  const titles: Record<AuthMode, string> = {
    login: 'Welcome back',
    signup: 'Create your account',
    forgot: 'Reset your password',
    reset: 'Set new password',
  };

  const buttonTexts: Record<AuthMode, string> = {
    login: 'Sign In',
    signup: 'Sign Up',
    forgot: 'Send Reset Link',
    reset: 'Update Password',
  };

  const getTitle = () => titles[mode];
  const getButtonText = () => loading ? 'Loading...' : buttonTexts[mode];

  // Auth card content (shared between modal and full page)
  const authCard = (
    <div
        className="w-full max-w-[600px] p-6 md:p-10 mx-auto"
        style={{
          background: 'var(--color-card-bg)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        {/* Logo/Title */}
        <h1
          className="text-3xl md:text-4xl font-semibold text-center mb-2"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          Zenote
        </h1>
        <h2
          id="auth-modal-title"
          className="text-center mb-6 md:mb-10"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
            fontSize: '0.95rem',
            fontWeight: 'normal',
          }}
        >
          {awaitingConfirmation ? 'Check your inbox' : getTitle()}
        </h2>

        {/* Confirmation waiting state */}
        {awaitingConfirmation ? (
          <div className="text-center">
            {/* Email icon */}
            <div
              className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-bg-secondary)' }}
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: 'var(--color-accent)' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>

            <p
              className="mb-2"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-primary)',
              }}
            >
              We sent a confirmation link to
            </p>
            <p
              className="mb-6 font-medium"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-accent)',
              }}
            >
              {email}
            </p>

            {/* Success/Error Messages */}
            {error && (
              <p
                className="mb-4 text-sm"
                style={{ color: 'var(--color-destructive)' }}
              >
                {error}
              </p>
            )}
            {message && (
              <p
                className="mb-4 text-sm"
                style={{ color: 'var(--color-accent)' }}
              >
                {message}
              </p>
            )}

            {/* Helpful tip */}
            <p
              className="mb-6 text-sm"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              Check your spam folder if you don't see it
            </p>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={loading || resendCooldown > 0}
                className="w-full py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
                style={{
                  fontFamily: 'var(--font-body)',
                  background: 'var(--color-accent)',
                  color: '#fff',
                }}
                onMouseEnter={(e) => {
                  if (!loading && resendCooldown === 0) {
                    e.currentTarget.style.background = 'var(--color-accent-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent)';
                }}
              >
                {loading ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend email'}
              </button>
              <button
                type="button"
                onClick={handleChangeEmail}
                className="w-full py-3 rounded-lg font-medium transition-all duration-200"
                style={{
                  fontFamily: 'var(--font-body)',
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--color-text-primary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              >
                Use a different email
              </button>
            </div>
          </div>
        ) : (
        <>
        {/* OAuth Buttons - Primary action for login and signup */}
        {(mode === 'login' || mode === 'signup') && (
          <>
            <div className="flex gap-3 mb-4 md:mb-6">
              <OAuthButton
                provider="google"
                onClick={handleGoogleSignIn}
                loading={googleLoading}
                disabled={googleLoading || githubLoading}
              />
              <OAuthButton
                provider="github"
                onClick={handleGitHubSignIn}
                loading={githubLoading}
                disabled={googleLoading || githubLoading}
              />
            </div>

            {/* Divider */}
            <div className="flex items-center mb-4 md:mb-6">
              <div
                className="flex-1 h-px"
                style={{ background: 'var(--glass-border)' }}
              />
              <span
                className="px-4 text-sm"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                or continue with email
              </span>
              <div
                className="flex-1 h-px"
                style={{ background: 'var(--glass-border)' }}
              />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit}>
          {/* Full Name - only shown during sign-up */}
          {mode === 'signup' && (
            <div className="mb-4 md:mb-5">
              <label
                htmlFor="auth-fullname"
                className="block text-sm mb-2"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Full Name <span style={{ color: 'var(--color-text-tertiary)' }}>(optional)</span>
              </label>
              <input
                id="auth-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder=""
                className="w-full px-4 py-3 rounded-lg outline-none transition-all duration-200"
                style={inputBaseStyles}
                onFocus={inputFocusHandler}
                onBlur={inputBlurHandler}
              />
            </div>
          )}

          {/* Email - shown for login, signup, forgot */}
          {mode !== 'reset' && (
            <div className="mb-4 md:mb-5">
              <label
                htmlFor="auth-email"
                className="block text-sm mb-2"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg outline-none transition-all duration-200"
                style={inputBaseStyles}
                onFocus={inputFocusHandler}
                onBlur={inputBlurHandler}
              />
            </div>
          )}

          {/* Password - shown for login, signup, reset */}
          {mode !== 'forgot' && (
            <div className="mb-4 md:mb-5">
              <label
                htmlFor="auth-password"
                className="block text-sm mb-2"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {mode === 'reset' ? 'New Password' : 'Password'}
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 rounded-lg outline-none transition-all duration-200"
                style={inputBaseStyles}
                onFocus={inputFocusHandler}
                onBlur={inputBlurHandler}
              />
              {(mode === 'signup' || mode === 'reset') && (
                <p
                  className="text-xs mt-1.5"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  8+ characters
                </p>
              )}
            </div>
          )}

          {/* Confirm Password - only for reset */}
          {mode === 'reset' && (
            <div className="mb-4 md:mb-5">
              <label
                htmlFor="auth-confirm-password"
                className="block text-sm mb-2"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Confirm Password
              </label>
              <input
                id="auth-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 rounded-lg outline-none transition-all duration-200"
                style={inputBaseStyles}
                onFocus={inputFocusHandler}
                onBlur={inputBlurHandler}
              />
            </div>
          )}

          {/* Forgot Password Link - only for login */}
          {mode === 'login' && (
            <div className="mb-4 md:mb-6 text-right">
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-sm transition-colors"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p
              className="mb-4 text-sm text-center"
              style={{ color: 'var(--color-destructive)' }}
            >
              {error}
            </p>
          )}

          {/* Success Message */}
          {message && (
            <p
              className="mb-4 text-sm text-center"
              style={{ color: 'var(--color-accent)' }}
            >
              {message}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="
              w-full py-3
              rounded-lg
              font-medium
              transition-all duration-200
              disabled:opacity-50
            "
            style={{
              fontFamily: 'var(--font-body)',
              background: 'var(--color-accent)',
              color: '#fff',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'var(--color-accent-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-accent)';
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Loading...
              </span>
            ) : (
              getButtonText()
            )}
          </button>
        </form>

        {/* Footer Links */}
        <div className="text-center mt-4 md:mt-6 text-sm" style={{ fontFamily: 'var(--font-body)' }}>
          {mode === 'login' && (
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="underline transition-colors"
                style={{ color: 'var(--color-accent)' }}
              >
                Sign Up
              </button>
            </p>
          )}

          {mode === 'signup' && (
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="underline transition-colors"
                style={{ color: 'var(--color-accent)' }}
              >
                Sign In
              </button>
            </p>
          )}

          {mode === 'forgot' && (
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="underline transition-colors"
                style={{ color: 'var(--color-accent)' }}
              >
                Sign In
              </button>
            </p>
          )}

          {mode === 'reset' && (
            <p style={{ color: 'var(--color-text-secondary)' }}>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="underline transition-colors"
                style={{ color: 'var(--color-accent)' }}
              >
                Back to Sign In
              </button>
            </p>
          )}
        </div>
        </>
        )}
      </div>
  );

  // Check if form has been modified (dirty state)
  const isDirty = email.length > 0 || password.length > 0 || fullName.length > 0;

  const handleModalClose = () => {
    if (isDirty && !awaitingConfirmation) {
      setShowCloseConfirm(true);
    } else {
      onClose?.();
    }
  };

  const handleConfirmClose = () => {
    setShowCloseConfirm(false);
    onClose?.();
  };

  // Modal mode: wrap in overlay
  if (isModal) {
    return (
      <div className="auth-modal-overlay" onClick={handleModalClose}>
        <div
        className="auth-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Close button */}
          <button
            className="auth-modal-close"
            onClick={handleModalClose}
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {authCard}
        </div>

        {/* Close confirmation modal */}
        {showCloseConfirm && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setShowCloseConfirm(false)}
          >
            <div
              className="w-full max-w-sm p-6 rounded-lg text-center"
              style={{
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--glass-border)',
                boxShadow: 'var(--shadow-lg)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                className="text-lg font-semibold mb-2"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text-primary)',
                }}
              >
                Discard changes?
              </h3>
              <p
                className="text-sm mb-6"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                You have unsaved changes that will be lost.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowCloseConfirm(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                    background: 'transparent',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  Keep Editing
                </button>
                <button
                  onClick={handleConfirmClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-bg-primary)',
                    background: 'var(--color-accent)',
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full page mode: wrap in page container with theme toggle
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      {/* Theme Toggle */}
      <button
        onClick={onThemeToggle}
        className="
          absolute top-6 right-6
          w-[44px] h-[44px]
          rounded-full
          flex items-center justify-center
          border border-transparent
          transition-all duration-300
          focus:outline-none
          focus:ring-2
          focus:ring-[var(--color-accent)]
          hover:text-[var(--color-accent)]
          hover:-translate-y-0.5
        "
        style={{
          color: 'var(--color-text-secondary)',
        }}
        aria-label="Toggle theme"
      >
        {theme === 'light' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )}
      </button>
      {authCard}
    </div>
  );
}
