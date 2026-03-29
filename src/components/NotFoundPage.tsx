import { Logo } from './Logo';

interface NotFoundPageProps {
  onGoHome: () => void;
}

export function NotFoundPage({ onGoHome }: NotFoundPageProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <Logo variant="header" className="mb-12 opacity-40" />
      <h1
        className="text-3xl md:text-4xl mb-4"
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--color-text-primary)',
          fontWeight: 300,
        }}
      >
        This path leads nowhere.
      </h1>
      <p
        className="mb-8"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-text-secondary)',
          fontSize: '1.1rem',
        }}
      >
        Your notes are waiting.
      </p>
      <button
        onClick={onGoHome}
        className="focus-ring"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-accent)',
          background: 'none',
          border: 'none',
          fontSize: '1rem',
          cursor: 'pointer',
          textDecoration: 'underline',
          textUnderlineOffset: '4px',
        }}
      >
        Return home
      </button>
    </div>
  );
}
