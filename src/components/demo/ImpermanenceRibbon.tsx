/**
 * ImpermanenceRibbon
 *
 * A subtle, non-intrusive banner that reminds demo users their notes are browser-local.
 * Aligns with Zenote's calm, wabi-sabi aesthetic.
 */

interface ImpermanenceRibbonProps {
  onSignUp: () => void;
  onDismiss: () => void;
}

export function ImpermanenceRibbon({ onSignUp, onDismiss }: ImpermanenceRibbonProps) {
  return (
    <div
      className="relative flex items-center justify-center gap-2 px-4 py-2.5"
      style={{
        background: `linear-gradient(
          90deg,
          transparent 0%,
          var(--color-bg-secondary) 15%,
          var(--color-bg-secondary) 85%,
          transparent 100%
        )`,
      }}
    >
      {/* Pulsing dot indicator */}
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{
          background: 'var(--color-accent)',
          animation: 'gentle-pulse 3s ease-in-out infinite',
        }}
      />

      {/* Message */}
      <span
        className="text-xs sm:text-sm"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        Your notes are safe in this browser
        <span className="hidden sm:inline"> · </span>
        <button
          onClick={onSignUp}
          className="sm:inline hidden transition-colors duration-200"
          style={{
            color: 'var(--color-accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: '1px dotted var(--color-accent)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderBottomStyle = 'solid';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderBottomStyle = 'dotted';
          }}
        >
          Sign up to sync across devices
        </button>
      </span>

      {/* Mobile sign up link */}
      <button
        onClick={onSignUp}
        className="sm:hidden text-xs px-2 py-1 rounded transition-colors duration-200"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-accent)',
          background: 'transparent',
          border: '1px solid var(--color-accent)',
        }}
      >
        Sync
      </button>

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="absolute right-2 sm:right-4 p-1 rounded opacity-40 hover:opacity-100 transition-opacity duration-200"
        style={{ color: 'var(--color-text-tertiary)' }}
        aria-label="Dismiss"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Animation keyframes (injected via style tag) */}
      <style>{`
        @keyframes gentle-pulse {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}
