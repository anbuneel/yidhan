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
      <Logo className="mb-12 opacity-40" />
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
        className="mb-8 text-lg"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-text-secondary)',
        }}
      >
        Your notes are waiting.
      </p>
      <button type="button"
        onClick={onGoHome}
        className="focus-ring bg-transparent border-none text-base cursor-pointer underline underline-offset-4"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-accent)',
        }}
      >
        Return home
      </button>
    </div>
  );
}
