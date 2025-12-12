import { useState } from 'react';
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
}

export function Auth({ theme, onThemeToggle, initialMode = 'login', onPasswordResetComplete }: AuthProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { signIn, signUp, signInWithGoogle, resetPassword, updatePassword } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

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
          setMessage('Check your email for a confirmation link!');
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

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Welcome back';
      case 'signup': return 'Create your account';
      case 'forgot': return 'Reset your password';
      case 'reset': return 'Set new password';
    }
  };

  const getButtonText = () => {
    if (loading) return 'Loading...';
    switch (mode) {
      case 'login': return 'Sign In';
      case 'signup': return 'Sign Up';
      case 'forgot': return 'Send Reset Link';
      case 'reset': return 'Update Password';
    }
  };

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

      <div
        className="w-full max-w-[400px] p-10"
        style={{
          background: 'var(--color-card-bg)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        {/* Logo/Title */}
        <h1
          className="text-4xl font-semibold text-center mb-2"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          Zenote
        </h1>
        <p
          className="text-center mb-10"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
            fontSize: '0.95rem',
          }}
        >
          {getTitle()}
        </p>

        <form onSubmit={handleSubmit}>
          {/* Full Name - only shown during sign-up */}
          {mode === 'signup' && (
            <div className="mb-5">
              <label
                className="block text-sm mb-2"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="
                  w-full px-4 py-3
                  rounded-lg
                  outline-none
                  transition-all duration-200
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--color-text-primary)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              />
            </div>
          )}

          {/* Email - shown for login, signup, forgot */}
          {mode !== 'reset' && (
            <div className="mb-5">
              <label
                className="block text-sm mb-2"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="
                  w-full px-4 py-3
                  rounded-lg
                  outline-none
                  transition-all duration-200
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--color-text-primary)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              />
            </div>
          )}

          {/* Password - shown for login, signup, reset */}
          {mode !== 'forgot' && (
            <div className="mb-5">
              <label
                className="block text-sm mb-2"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {mode === 'reset' ? 'New Password' : 'Password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="
                  w-full px-4 py-3
                  rounded-lg
                  outline-none
                  transition-all duration-200
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--color-text-primary)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              />
            </div>
          )}

          {/* Confirm Password - only for reset */}
          {mode === 'reset' && (
            <div className="mb-5">
              <label
                className="block text-sm mb-2"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="
                  w-full px-4 py-3
                  rounded-lg
                  outline-none
                  transition-all duration-200
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--color-text-primary)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              />
            </div>
          )}

          {/* Forgot Password Link - only for login */}
          {mode === 'login' && (
            <div className="mb-6 text-right">
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
            {getButtonText()}
          </button>
        </form>

        {/* Google Sign-In - only for login and signup */}
        {(mode === 'login' || mode === 'signup') && (
          <>
            {/* Divider */}
            <div className="flex items-center my-6">
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
                or
              </span>
              <div
                className="flex-1 h-px"
                style={{ background: 'var(--glass-border)' }}
              />
            </div>

            {/* Google Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="
                w-full py-3
                rounded-lg
                font-medium
                transition-all duration-200
                disabled:opacity-50
                flex items-center justify-center gap-3
              "
              style={{
                fontFamily: 'var(--font-body)',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--glass-border)',
                color: 'var(--color-text-primary)',
              }}
              onMouseEnter={(e) => {
                if (!googleLoading) {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--glass-border)';
              }}
            >
              {googleLoading ? (
                'Redirecting...'
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </>
              )}
            </button>
          </>
        )}

        {/* Footer Links */}
        <div className="text-center mt-6 text-sm" style={{ fontFamily: 'var(--font-body)' }}>
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
      </div>
    </div>
  );
}
