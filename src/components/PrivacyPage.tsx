import { HeaderShell } from './HeaderShell';
import { Footer } from './Footer';
import type { Theme } from '../types';

interface PrivacyPageProps {
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

export function PrivacyPage({
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
}: PrivacyPageProps) {
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
            Privacy
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
            How Yidhan handles your data — honestly and simply.
          </p>

          <div className="space-y-10" style={{ fontFamily: 'var(--font-body)' }}>
            {/* Encryption */}
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
                Your notes are encrypted
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p>
                  Yidhan uses end-to-end encryption (AES-256-GCM) to protect your notes. Your passphrase never leaves your device — it is used locally to derive encryption keys via Argon2id. Note titles and content are encrypted before they reach our servers.
                </p>
                <p>
                  We cannot read your notes. No one at Yidhan, Supabase, or anywhere else can decrypt them without your passphrase. If you forget your passphrase, your notes cannot be recovered — this is the tradeoff of real encryption.
                </p>
              </div>
            </section>

            {/* What's stored */}
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
                What we store
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p><strong style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Encrypted:</strong> Note titles and content (stored as encrypted blobs — unreadable without your passphrase).</p>
                <p><strong style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Not encrypted:</strong> Tag names, timestamps (created/updated), and whether a note is pinned. These remain in plaintext to enable sorting and filtering.</p>
                <p><strong style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Account:</strong> Your email address, display name (optional), and authentication credentials managed by Supabase.</p>
              </div>
            </section>

            {/* Local storage */}
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
                What stays on your device
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p>
                  Yidhan stores data locally using IndexedDB (for offline access) and sessionStorage (for encryption keys during your session). Keys are cleared when you close the tab or sign out.
                </p>
                <p>
                  If you enable "Remember this browser," encryption keys are also stored in localStorage so you don't need to re-enter your passphrase on that device. This is opt-in and can be revoked at any time. We recommend only enabling it on personal devices you trust.
                </p>
              </div>
            </section>

            {/* Telemetry */}
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
                Error monitoring
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p>
                  Yidhan uses Sentry for error tracking to help us find and fix bugs. Sentry receives crash reports and basic performance data. It does not receive your note content — encrypted fields are stripped before any data reaches Sentry.
                </p>
                <p>
                  Session replay (if sampled) masks all text and blocks note card elements to prevent accidental capture of decrypted content.
                </p>
              </div>
            </section>

            {/* Third parties */}
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
                Third-party services
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p><strong style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Supabase</strong> — Database, authentication, and real-time sync. Your encrypted data is stored on Supabase's infrastructure with row-level security.</p>
                <p><strong style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Sentry</strong> — Error monitoring (no note content). Optional — Yidhan works without it.</p>
                <p><strong style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Google Fonts</strong> — Typography (Cormorant Garamond, Source Sans 3). Google may log font requests.</p>
                <p><strong style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Vercel</strong> — Hosting and deployment.</p>
              </div>
            </section>

            {/* What we don't do */}
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
                What we don't do
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p>We don't sell your data. We don't show ads. We don't use your notes to train AI models. We don't track you across websites. We don't send marketing emails. We don't use dark patterns to keep you engaged.</p>
              </div>
            </section>

            {/* Your rights */}
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
                Your data, your choice
              </h2>
              <div className="space-y-3" style={{ color: 'var(--color-text-secondary)', fontWeight: 300, lineHeight: 1.7, fontSize: '0.95rem' }}>
                <p>
                  You can export all your notes at any time (JSON or Markdown). You can delete your account and all associated data through Settings. Deletion is permanent — we don't keep backups of your data after you leave.
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
