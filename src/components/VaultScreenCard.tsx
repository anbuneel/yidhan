import type { ReactNode } from 'react';

/** The centred card the vault screens sit in, matching `PassphraseUnlock`. */
export function VaultScreenCard({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--page-background)' }}
    >
      <div
        className="w-full max-w-md p-8"
        style={{
          background: 'var(--color-bg-secondary)',
          borderRadius: '2px 24px 4px 24px',
          border: '1px solid var(--glass-border)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
