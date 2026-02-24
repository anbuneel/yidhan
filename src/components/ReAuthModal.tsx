import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ReAuthModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  /** Action description shown to user (e.g., "export your data") */
  actionDescription?: string;
}

/**
 * Re-authentication modal for step-up auth before sensitive actions.
 *
 * For email/password users: prompts for current password.
 * For OAuth users: prompts to type their email to confirm.
 *
 * Uses zen-inspired messaging to match Yidhan's aesthetic.
 */
export function ReAuthModal({
  isOpen,
  onSuccess,
  onCancel,
  actionDescription = 'continue',
}: ReAuthModalProps) {
  const { user, verifyPassword, markReauth } = useAuth();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if user signed up with OAuth (Google, GitHub, etc.)
  const provider = user?.app_metadata?.provider;
  const isOAuthUser =
    provider === 'google' ||
    provider === 'github' ||
    user?.identities?.some((identity) => identity.provider !== 'email');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setInput('');
      setError(null);
      setIsLoading(false);
      // Focus input after a brief delay for animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle Escape key to close modal (accessibility)
  const handleEscapeKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen, handleEscapeKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!input.trim()) {
      setError(isOAuthUser ? 'Please enter your email' : 'Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      if (isOAuthUser) {
        // OAuth users: verify by typing their email
        if (input.trim().toLowerCase() !== user?.email?.toLowerCase()) {
          setError("That doesn't match your account email");
          return;
        }
        // Track re-auth for grace window (OAuth users too)
        markReauth();
        onSuccess();
      } else {
        // Email/password users: verify password
        const result = await verifyPassword(input);
        if (result.success) {
          onSuccess();
        } else {
          setError("That doesn't seem right. Try again?");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onCancel}
    >
      <div
        className="
          w-full max-w-sm
          shadow-2xl
          animate-[modal-enter_300ms_ease-out]
        "
        style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--glass-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-5 border-b"
          style={{ borderColor: 'var(--glass-border)' }}
        >
          <div className="flex items-center justify-between">
            <h2
              className="text-xl italic"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              A Moment of Verification
            </h2>
            <button
              onClick={onCancel}
              className="
                w-8 h-8
                flex items-center justify-center
                rounded-full
                transition-colors duration-200
              "
              style={{ color: 'var(--color-text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              aria-label="Cancel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 py-5">
          {/* Message */}
          <p
            className="text-center text-sm mb-5"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
            }}
          >
            Before you {actionDescription}, please confirm it's you.
          </p>

          {/* Input */}
          <div className="mb-4">
            <label
              className="block text-sm mb-2"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {isOAuthUser ? 'Your email' : 'Your password'}
            </label>
            <input
              ref={inputRef}
              type={isOAuthUser ? 'email' : 'password'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isOAuthUser ? 'Enter your account email' : 'Enter your password'}
              autoComplete={isOAuthUser ? 'email' : 'current-password'}
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

          {/* Error message */}
          {error && (
            <p
              className="mb-4 text-sm text-center"
              style={{ color: 'var(--color-error)' }}
            >
              {error}
            </p>
          )}

          {/* OAuth hint */}
          {isOAuthUser && (
            <p
              className="text-xs text-center mb-4"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              You signed in with {provider === 'google' ? 'Google' : 'GitHub'}.
              Type your email to confirm.
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="
                flex-1 py-3
                rounded-lg
                font-medium
                transition-all duration-200
              "
              style={{
                fontFamily: 'var(--font-body)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--glass-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-accent)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--glass-border)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="
                flex-1 py-3
                rounded-lg
                font-medium
                transition-all duration-200
                disabled:opacity-50
              "
              style={{
                fontFamily: 'var(--font-body)',
                background: 'var(--color-cta-bg)',
                color: 'var(--color-cta-text)',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'var(--color-cta-bg-hover)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-cta-bg)';
              }}
            >
              {isLoading ? 'Verifying...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
