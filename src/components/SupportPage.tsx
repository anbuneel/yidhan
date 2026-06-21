import { HeaderShell } from './HeaderShell';
import { Footer } from './Footer';
import type { Theme } from '../types';

interface SupportPageProps {
  theme: Theme;
  onThemeToggle: () => void;
  onSignIn: () => void;
  onLogoClick: () => void;
  onChangelogClick: () => void;
  onRoadmapClick: () => void;
  onPrivacyClick?: () => void;
  onTermsClick?: () => void;
  onSupportClick?: () => void;
  onSettingsClick?: () => void;
}

export function SupportPage({
  theme,
  onThemeToggle,
  onSignIn,
  onLogoClick,
  onChangelogClick,
  onRoadmapClick,
  onPrivacyClick,
  onTermsClick,
  onSupportClick,
  onSettingsClick,
}: SupportPageProps) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <HeaderShell
        theme={theme}
        onThemeToggle={onThemeToggle}
        onLogoClick={onLogoClick}
        onSignIn={onSignIn}
        onSettingsClick={onSettingsClick}
      />

      <main className="flex-1">
        <div className="max-w-[800px] mx-auto px-6 sm:px-10 pb-20">
          {/* Title */}
          <h1
            className="font-semibold mb-3"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.75rem',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Support
          </h1>
          <p
            className="text-base mb-12"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
              fontWeight: 300,
              fontStyle: 'italic',
            }}
          >
            Questions, issues, or just want to say hello.
          </p>

          <div className="space-y-10" style={{ fontFamily: 'var(--font-body)' }}>
            {/* Get help */}
            <section>
              <h2
                className="mb-4"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}
              >
                Get help
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p>
                  The best way to report bugs or request features is through{' '}
                  <a
                    href="https://github.com/anbuneel/yidhan/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--color-accent)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                  >
                    GitHub Issues
                  </a>
                  . It's public, searchable, and lets us track everything in one place.
                </p>
              </div>
            </section>

            {/* Common questions */}
            <section>
              <h2
                className="mb-4"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}
              >
                Common questions
              </h2>
              <div className="space-y-6">
                {/* FAQ items */}
                {[
                  {
                    q: 'I forgot my passphrase. Can you recover my notes?',
                    a: 'No. Your passphrase is never sent to our servers — it stays on your device. Without it, your encrypted notes cannot be decrypted. This is by design: real end-to-end encryption means no one (including us) can access your data without your passphrase.',
                  },
                  {
                    q: 'How do I export my notes?',
                    a: 'Open Settings and use the Export option. You can export as JSON (full fidelity, re-importable) or Markdown (human-readable). Both formats include your note titles, content, and tags.',
                  },
                  {
                    q: 'How do I delete my account?',
                    a: 'Account deletion is paused for public launch until the server-owned deletion workflow is available. Export your notes from Settings first; then contact support if you need account removal before the self-serve flow returns.',
                  },
                  {
                    q: 'Does Yidhan work offline?',
                    a: 'Yes. Your notes are stored locally on your device and sync with the server when you\'re back online. You can create, edit, and read notes without an internet connection.',
                  },
                  {
                    q: 'Is Yidhan free?',
                    a: 'Yes. Yidhan is free and open source. There are no premium tiers, no feature gates, and no ads.',
                  },
                  {
                    q: 'Can I install Yidhan as an app?',
                    a: 'Yes. Yidhan is a Progressive Web App (PWA). On most browsers, you\'ll see an install prompt after using it for a bit. On iOS Safari, use Share \u2192 Add to Home Screen.',
                  },
                ].map(({ q, a }) => (
                  <div key={q}>
                    <h3
                      className="mb-2"
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.95rem',
                        fontWeight: 500,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {q}
                    </h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                      {a}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Open source */}
            <section>
              <h2
                className="mb-4"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}
              >
                Contribute
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p>
                  Yidhan is open source. If you'd like to contribute, the code is on{' '}
                  <a
                    href="https://github.com/anbuneel/yidhan"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--color-accent)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                  >
                    GitHub
                  </a>
                  . Pull requests, bug reports, and design feedback are all welcome.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer
        onChangelogClick={onChangelogClick}
        onRoadmapClick={onRoadmapClick}
        onPrivacyClick={onPrivacyClick}
        onTermsClick={onTermsClick}
        onSupportClick={onSupportClick}
      />
    </div>
  );
}
