/**
 * InvitationModal
 *
 * A gentle, non-aggressive signup prompt that appears after users
 * have engaged with the demo (3+ notes, 5+ minutes).
 * Follows Zenote's calm philosophy - invitation, not demand.
 */

interface InvitationModalProps {
  noteCount: number;
  onSignUp: () => void;
  onDismiss: () => void;
}

export function InvitationModal({ noteCount, onSignUp, onDismiss }: InvitationModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-[400px] p-8 sm:p-10 text-center"
        style={{
          background: 'var(--color-card-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '2px 24px 4px 24px',
          animation: 'float-up 0.5s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invitation-title"
        aria-describedby="invitation-body"
      >
        {/* Icon */}
        <div
          className="text-2xl mb-4"
          style={{ color: 'var(--color-accent)' }}
          aria-hidden="true"
        >
          ✦
        </div>

        {/* Title */}
        <h2
          id="invitation-title"
          className="text-xl sm:text-2xl mb-5"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.02em',
            fontWeight: 500,
          }}
        >
          A Gentle Invitation
        </h2>

        {/* Body */}
        <p
          id="invitation-body"
          className="text-sm sm:text-base mb-7 leading-relaxed"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.7,
          }}
        >
          You've written{' '}
          <strong style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
            {noteCount} {noteCount === 1 ? 'note' : 'notes'}
          </strong>{' '}
          here. They're yours to keep.
          <br />
          <br />
          Create a free account and your words will travel with you everywhere.
        </p>

        {/* Primary CTA */}
        <button
          onClick={onSignUp}
          className="w-full py-3.5 px-6 rounded-lg text-base font-medium transition-all duration-300"
          style={{
            fontFamily: 'var(--font-body)',
            background: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 16px var(--color-accent-glow)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-accent-hover)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 24px var(--color-accent-glow)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-accent)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 16px var(--color-accent-glow)';
          }}
        >
          Keep My Notes
        </button>

        {/* Dismiss link */}
        <button
          onClick={onDismiss}
          className="mt-4 text-sm transition-colors duration-200"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
            textDecorationStyle: 'dotted',
            textUnderlineOffset: '3px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-tertiary)';
          }}
        >
          Continue without
        </button>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes float-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
