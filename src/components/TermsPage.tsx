import { HeaderShell } from './HeaderShell';
import { Footer } from './Footer';
import type { Theme } from '../types';

interface TermsPageProps {
  theme: Theme;
  onThemeToggle: () => void;
  onSignIn: () => void;
  onLogoClick: () => void;
  onChangelogClick: () => void;
  onRoadmapClick: () => void;
  onPrivacyClick: () => void;
  onTermsClick?: () => void;
  onSupportClick?: () => void;
  onSettingsClick?: () => void;
}

export function TermsPage({
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
}: TermsPageProps) {
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
            Terms
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
            Plain language, no legalese.
          </p>

          <div className="space-y-10" style={{ fontFamily: 'var(--font-body)' }}>
            {/* What Yidhan is */}
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
                What Yidhan is
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p>
                  Yidhan is a free, open-source note-taking application with end-to-end encryption. It is offered as-is, without warranty of any kind. We do our best to keep it running, secure, and improving — but we're a small project, not a corporation with an SLA.
                </p>
              </div>
            </section>

            {/* Your content */}
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
                Your notes are yours
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p>
                  You own everything you write in Yidhan. We don't claim any rights over your content. We can't read it anyway — it's encrypted with your passphrase, which we never see.
                </p>
                <p>
                  You can export your notes and leave at any time. There are no lock-in mechanisms.
                </p>
              </div>
            </section>

            {/* Acceptable use */}
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
                Acceptable use
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p>
                  Use Yidhan for personal note-taking. Don't use the service to store or distribute illegal content, attempt to compromise other users' accounts, or abuse the infrastructure (automated scraping, denial-of-service, etc.).
                </p>
                <p>
                  We reserve the right to suspend accounts that violate these terms or threaten the service's availability for others.
                </p>
              </div>
            </section>

            {/* Encryption responsibility */}
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
                Encryption is your responsibility
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p>
                  Your passphrase is the key to your notes. We don't store it, we can't recover it, and we can't reset it. If you lose your passphrase, your encrypted notes are permanently inaccessible. We recommend keeping a backup of your passphrase in a secure location.
                </p>
              </div>
            </section>

            {/* Service availability */}
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
                Availability
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p>
                  We aim to keep Yidhan available, but we can't guarantee 100% uptime. The app works offline — your notes are stored locally and sync when connectivity returns. If we ever need to shut down the service, we'll give advance notice so you can export your data.
                </p>
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
                Open source
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p>
                  Yidhan's source code is publicly available on{' '}
                  <a
                    href="https://github.com/anbuneel/yidhan"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--color-accent)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                  >
                    GitHub
                  </a>
                  . You can inspect the encryption implementation, verify our privacy claims, or self-host your own instance.
                </p>
              </div>
            </section>

            {/* Privacy link */}
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
                Privacy
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p>
                  How we handle your data is covered in our{' '}
                  <button
                    onClick={onPrivacyClick}
                    style={{ color: 'var(--color-accent)', textDecoration: 'underline', textUnderlineOffset: '3px', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
                  >
                    Privacy Policy
                  </button>
                  . The short version: your notes are encrypted, we don't sell data, and you can delete everything at any time.
                </p>
              </div>
            </section>

            {/* Last updated */}
            <p
              className="pt-6"
              style={{
                color: 'var(--color-text-tertiary)',
                fontSize: '0.8rem',
                fontWeight: 400,
                borderTop: '1px solid var(--glass-border)',
              }}
            >
              Last updated March 2026
            </p>
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
