import { useState, useEffect, useEffectEvent, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ModalBackdropButton } from './ModalBackdropButton';

interface ReAuthModalProps {
  isOpen: boolean;
  onSuccess: (confirmationToken?: string) => void;
  onCancel: () => void;
  /** Action description shown to user (e.g., "export your data") */
  actionDescription?: string;
  sensitiveAction?: 'account_deletion';
}

/**
 * Re-authentication modal for step-up auth before sensitive actions.
 *
 * For email/password users: prompts for current password.
 * OAuth users are blocked for account deletion until a real provider or OTP
 * challenge mints the same server-side confirmation token.
 *
 * Uses zen-inspired messaging to match Yidhan's aesthetic.
 */
export function ReAuthModal({
  isOpen,
  onSuccess,
  onCancel,
  actionDescription = 'continue',
  sensitiveAction,
}: ReAuthModalProps) {
  const { user, verifyPassword, confirmAccountDeletion } = useAuth();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const wasOpenRef = useRef(isOpen);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if user signed up with OAuth (Google, GitHub, etc.)
  const provider = user?.app_metadata?.provider;
  const isOAuthUser =
    provider === 'google' ||
    provider === 'github' ||
    user?.identities?.some((identity) => identity.provider !== 'email');
  const providerLabel = provider === 'google' ? 'Google' : provider === 'github' ? 'GitHub' : 'your sign-in provider';
  const isAccountDeletion = sensitiveAction === 'account_deletion';
  const isOAuthBlocked = isOAuthUser;

  if (isOpen !== wasOpenRef.current) {
    wasOpenRef.current = isOpen;
    if (isOpen) {
      setInput('');
      setError(null);
      setIsLoading(false);
    }
  }

  // Focus input when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(focusTimer);
  }, [isOpen]);

  // Handle Escape key to close modal (accessibility)
  const handleEscapeKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  });

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isOAuthBlocked) {
      setError('This verification method is not available for your sign-in provider yet.');
      return;
    }

    if (!input.trim()) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      if (isAccountDeletion) {
        const result = await confirmAccountDeletion(input);
        if (result.success && result.confirmationToken) {
          onSuccess(result.confirmationToken);
        } else {
          setError(result.error ?? "That doesn't seem right. Try again?");
        }
      } else {
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
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 modal-backdrop"
    >
      <ModalBackdropButton label="Cancel verification" onClick={onCancel} />
      <dialog
        open
        className="
          relative z-10 w-full max-w-sm
          shadow-2xl
          animate-[modal-enter_300ms_ease-out]
          p-0 border-0
        "
        style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--glass-border)',
          margin: 0,
        }}
        aria-modal="true"
        aria-labelledby="reauth-title"
      >
        {/* Header */}
        <div
          className="px-6 py-5 border-b"
          style={{ borderColor: 'var(--glass-border)' }}
        >
          <div className="flex items-center justify-between">
            <h2
              id="reauth-title"
              className="text-xl italic"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              A Moment of Verification
            </h2>
            <button type="button"
              onClick={onCancel}
              className="
                size-8
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
              <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
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

          {isOAuthBlocked && (
            <p
              className="text-sm mb-4"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
              }}
            >
              You signed in with {providerLabel}. This action needs a stronger
              verification step than typing your email, so it is unavailable for
              this sign-in method until that challenge is enabled.
            </p>
          )}

          {/* Input */}
          {!isOAuthBlocked && (
          <div className="mb-4">
            <label
              htmlFor="reauth-input"
              className="block text-sm mb-2"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Your password
            </label>
            <input
              id="reauth-input"
              ref={inputRef}
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
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

          {/* Error message */}
          {error && (
            <p
              className="mb-4 text-sm text-center"
              style={{ color: 'var(--color-error)' }}
            >
              {error}
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
              disabled={isLoading || isOAuthBlocked}
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
      </dialog>
    </div>
  );
}
