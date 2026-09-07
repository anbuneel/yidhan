import { HeaderShell } from './HeaderShell';
import { Footer } from './Footer';
import type { ReactNode } from 'react';
import type { Theme } from '../types';

/**
 * The threat model, in the product's voice (item 39).
 *
 * `/privacy` says what we do with your data. This says what an attacker would get, and
 * what they would not — including the parts we have not solved yet. A security page
 * that only lists strengths is marketing; the sections that name what is *visible* and
 * what is *not covered* are the ones that make the rest worth reading.
 */

interface SecurityPageProps {
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

const bodyStyle = {
  color: 'var(--color-text-secondary)',
  fontWeight: 300,
  lineHeight: 1.7,
  fontSize: '0.95rem',
} as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
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
        {title}
      </h2>
      <div className="space-y-3" style={bodyStyle}>
        {children}
      </div>
    </section>
  );
}

function Term({ children }: { children: ReactNode }) {
  return (
    <strong style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{children}</strong>
  );
}

export function SecurityPage({
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
}: SecurityPageProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-primary)' }}>
      <HeaderShell
        theme={theme}
        onThemeToggle={onThemeToggle}
        onLogoClick={onLogoClick}
        onSignIn={onSignIn}
        onSettingsClick={onSettingsClick}
      />

      <main className="flex-1">
        <div className="max-w-[800px] mx-auto px-6 sm:px-10 pb-20">
          <h1
            className="font-semibold mb-3"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.75rem',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Security
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
            What is protected, what is visible, and what we have not solved yet.
          </p>

          <div className="space-y-10" style={{ fontFamily: 'var(--font-body)' }}>
            <Section title="What we are protecting against">
              <p>
                Yidhan is built so that a breach of our servers, our database provider, or
                the network between you and them does not become a breach of your writing.
                If someone walks away with the whole database, they get a pile of
                ciphertext and the dates it was written on.
              </p>
              <p>
                Your passphrase never leaves your device. Keys are derived from it locally
                with Argon2id, and your notes are encrypted with AES-256-GCM before
                anything is sent. Each note is bound to its own identity and yours, so a
                note cannot be swapped for another one on the way back.
              </p>
            </Section>

            <Section title="What is visible to us, even so">
              <p>
                Encryption hides what you wrote. It does not hide that you wrote. Being
                specific about the difference matters more than sounding reassuring:
              </p>
              <p>
                <Term>Timestamps.</Term> When each note was created and last changed. A
                pattern of when you write is legible from this.
              </p>
              <p>
                <Term>Sizes.</Term> Roughly how long each note is. Ciphertext is close to
                the length of what it encrypts.
              </p>
              <p>
                <Term>Tag names.</Term> Your tags are stored in plaintext today. A tag
                called <em>Therapy</em> or <em>Divorce</em> is a fact about you on our
                server, even though the notes inside it are not readable. This is a
                deliberate trade — filtering and autocomplete need to work offline — and
                we are not comfortable with it. Encrypting them is on the roadmap.
              </p>
              <p>
                <Term>Counts and structure.</Term> How many notes you have, how many are
                pinned, how many have been let go.
              </p>
              <p>
                <Term>Account details.</Term> Your email address and, if you set one, your
                display name.
              </p>
            </Section>

            <Section title="What we have not solved">
              <p>
                <Term>A compromised browser.</Term> While your vault is unlocked, the key
                is in the page. Anything that can run code in your browser — a malicious
                extension, a successful script injection — can read what you have open.
                End-to-end encryption protects your notes in transit and at rest; it
                cannot protect a device that is already someone else&rsquo;s.
              </p>
              <p>
                <Term>&ldquo;Remember this browser&rdquo;.</Term> Turning it on stores your
                key in that browser so you do not have to unlock every time. That is a real
                convenience and a real cost: anyone with access to that browser profile has
                access to your notes. It is off by default, and it says so where you turn
                it on.
              </p>
              <p>
                <Term>A forgotten passphrase.</Term> There is no recovery, because there is
                nothing to recover with. We do not hold anything that could decrypt your
                notes. A recovery kit you keep yourself is planned; until then, if the
                passphrase is gone, so are the notes.
              </p>
              <p>
                <Term>Practice drafts.</Term> Anything written in the Practice Space before
                you sign up is stored in your browser without encryption. It is never sent
                anywhere, but it is not protected on the device either. The Practice Space
                says so on its own first note.
              </p>
              <p>
                <Term>An independent review.</Term> This has not had one yet. Everything on
                this page is our own account of our own work. The code is open, and a
                third-party review is on the roadmap before we make broader claims.
              </p>
            </Section>

            <Section title="Sharing a note">
              <p>
                A shared letter is encrypted with a key generated just for that share, and
                that key travels in the part of the link after the <code>#</code>. Browsers
                never send that part to a server, so we hold the encrypted letter and none
                of the means to open it.
              </p>
              <p>
                Which means the link <em>is</em> the key. Anyone you send it to, and anyone
                they forward it to, can read that note. Shares expire within 30 days at the
                latest, and you can revoke one at any time.
              </p>
            </Section>

            <Section title="What leaves your device">
              <p>
                Requests go to exactly three places: our database provider, our error
                monitoring (when it is configured at all), and the site itself for its own
                files. There is no analytics provider, no advertising, and no third-party
                embed. Fonts are served from our own domain rather than fetched from
                Google.
              </p>
              <p>
                Error reports are stripped before they are sent: note titles and content,
                passphrases, keys, share tokens and link fragments are removed, and session
                recordings are switched off entirely on a shared-letter page. The full
                inventory — every request type and every field it may carry — is kept in
                the repository as <code>docs/reference/outbound-data.md</code>.
              </p>
            </Section>

            <Section title="Reporting something">
              <p>
                If you find a problem, please tell us before telling anyone else, and give
                us a reasonable window to fix it. Write to{' '}
                <a
                  href="mailto:security@yidhan.app"
                  className="underline underline-offset-4"
                  style={{ color: 'var(--color-accent)' }}
                >
                  security@yidhan.app
                </a>
                . The same address is published at{' '}
                <a
                  href="/.well-known/security.txt"
                  className="underline underline-offset-4"
                  style={{ color: 'var(--color-accent)' }}
                >
                  /.well-known/security.txt
                </a>
                .
              </p>
              <p>
                We will not threaten you for reporting in good faith. We would rather hear
                it from you.
              </p>
            </Section>

            <p
              className="pt-6"
              style={{
                color: 'var(--color-text-tertiary)',
                fontSize: '0.8rem',
                fontWeight: 400,
                borderTop: '1px solid var(--glass-border)',
              }}
            >
              Last updated September 2026
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
