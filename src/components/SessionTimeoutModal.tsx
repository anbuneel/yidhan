interface SessionTimeoutModalProps {
  isOpen: boolean;
  onStay: () => void;
  onSignOut: () => void;
  minutesRemaining: number | null;
}

/**
 * Modal shown when user's session is about to expire due to inactivity.
 *
 * Uses Zen-inspired messaging: session "fades" rather than "expires".
 * Provides two options: stay (reset timer) or sign out gracefully.
 */
export function SessionTimeoutModal({
  isOpen,
  onStay,
  onSignOut,
  minutesRemaining,
}: SessionTimeoutModalProps) {
  if (!isOpen) return null;

  const timeText =
    minutesRemaining === null || minutesRemaining <= 0
      ? 'moments'
      : minutesRemaining === 1
        ? '1 minute'
        : `${minutesRemaining} minutes`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onStay} // Clicking backdrop counts as staying
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
              A Gentle Pause
            </h2>
            <button
              onClick={onStay}
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
              aria-label="Stay signed in"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Main message */}
          <p
            className="text-center text-lg mb-2"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
            }}
          >
            Your session is about to fade.
          </p>

          {/* Time remaining */}
          <p
            className="text-center text-sm mb-6"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
            }}
          >
            You've been away for a while. For your security, you'll be signed out in{' '}
            <span style={{ color: 'var(--color-accent)' }}>{timeText}</span>.
          </p>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onSignOut}
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
              Sign out now
            </button>
            <button
              onClick={onStay}
              className="
                flex-1 py-3
                rounded-lg
                font-medium
                transition-all duration-200
              "
              style={{
                fontFamily: 'var(--font-body)',
                background: 'var(--color-accent)',
                color: '#fff',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-accent-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-accent)';
              }}
            >
              Stay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
