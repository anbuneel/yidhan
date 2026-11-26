import { useMemo, type MouseEvent } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { HeaderShell } from './HeaderShell';
import { createDemoStarterPreviewState, HERO_STARTER_NOTE_ID } from '../services/demoStarters';
import type { Theme } from '../types';

interface LandingPageProps {
  /** Opens sign-up. Reached from the preview's "keep your notes" link; the primary
   *  action goes to the Practice Space instead, and the account comes from there. */
  onStartWriting: () => void;
  onSignIn: () => void;
  theme: Theme;
  onThemeToggle: () => void;
  /** The Practice Space library, where the sample notes live. */
  onDemoClick: () => void;
  /**
   * The Practice Space opened straight into an empty note with the caret in it
   * (item 45). Every "Try writing" on the page goes here, at every width: the page
   * shows the editor, it no longer imitates one.
   */
  onDemoDraftClick: () => void;
  /** Opens a specific sample note directly in the Practice Space editor. */
  onDemoNoteClick: (noteId: string) => void;
  onSecurityClick: () => void;
  onChangelogClick: () => void;
  onRoadmapClick: () => void;
  onPrivacyClick: () => void;
  onTermsClick: () => void;
  onSupportClick: () => void;
}

const GITHUB_URL = 'https://github.com/anbuneel/yidhan';
// The licence itself, not the repository: "open source" is a claim the file backs.
// `index.html`'s shell carries the same address.
const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;

/** Only a plain left-click is routed in-app; modified clicks keep the link's own behaviour. */
const isPlainClick = (event: MouseEvent<HTMLAnchorElement>) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.metaKey &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.shiftKey;

/** The first paragraph of a starter note as plain text, for a one-line preview. */
function firstLine(html: string): string {
  const paragraph = /<p[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? html;
  return paragraph.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function LandingPage({
  onStartWriting,
  onSignIn,
  theme,
  onThemeToggle,
  onDemoClick,
  onDemoDraftClick,
  onDemoNoteClick,
  onSecurityClick,
  onChangelogClick,
  onRoadmapClick,
  onPrivacyClick,
  onTermsClick,
  onSupportClick,
}: LandingPageProps) {
  const { isInstallable, isInstalled, triggerInstall } = useInstallPrompt();

  // The samples are the practice space's own starters, so "open" shows the same note
  // there. The pinned welcome and the note already in the sheet are left out.
  const sampleNotes = useMemo(() => {
    const demoState = createDemoStarterPreviewState();
    return demoState.notes
      .filter((note) => !note.pinned && note.localId !== HERO_STARTER_NOTE_ID)
      .map((note) => ({ id: note.localId, title: note.title, preview: firstLine(note.content) }));
  }, []);

  const handleDemoLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onDemoClick();
  };

  const handleSecurityLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onSecurityClick();
  };

  return (
    <div className="landing-canvas">
      <HeaderShell theme={theme} onThemeToggle={onThemeToggle} onSignIn={onSignIn} />

      {/* ─── On the page: the promise stated, compact so the sheet shows above the fold ─── */}
      <section className="landing-hero">
        <div className="landing-intro">
          <h1 className="landing-headline">A calm, private place to write.</h1>
          <p className="landing-sub">
            Notes are{' '}
            <a href="/security" onClick={handleSecurityLinkClick} className="landing-inline-link focus-ring">
              encrypted on your device
            </a>{' '}
            before they sync. Works offline.{' '}
            <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="landing-inline-link focus-ring">
              Free and open source
            </a>
            .
          </p>
          <div className="landing-actions">
            <button type="button" onClick={onDemoDraftClick} className="landing-cta focus-ring">
              Try writing
            </button>
            <a href="/demo" onClick={handleDemoLinkClick} className="landing-demo-link focus-ring">
              Browse sample notes
              <span className="landing-demo-arrow" aria-hidden="true">→</span>
            </a>
          </div>
          <p className="landing-micro">Free to use. No account needed to try.</p>
        </div>
      </section>

      {/* ─── One sheet holds the rest, at reading width (DECISIONS.md, 2026-11-11) ─── */}
      <article className="landing-sheet">
        {/* The draft as the practice space renders it. A picture of the editor, not an
            imitation of one: clicking anywhere on it opens the real thing. */}
        <div className="landing-draft">
          <div className="landing-manuscript-glow" aria-hidden="true" />
          <button
            type="button"
            onClick={onDemoDraftClick}
            className="landing-manuscript-open focus-ring"
            aria-label="Try writing in the practice space"
          />
          <div className="landing-manuscript-page">
            <p className="landing-manuscript-title">Opening draft</p>
            <div className="landing-manuscript-meta" aria-hidden="true">
              <span className="landing-manuscript-tag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add tag
              </span>
              <span className="landing-manuscript-time">Just now</span>
            </div>
            <div className="landing-manuscript-text">
              <p>By nine, everyone in the building had received the same letter. Except Sam.</p>
              <p>He checked the empty mailbox again, then knocked on his neighbour’s door.</p>
              <p className="landing-revision">
                [Try starting with the knock. Explain the letter later.]
                <span className="landing-caret" aria-hidden="true" />
              </p>
            </div>
          </div>
          <div className="landing-manuscript-foot">
            <span className="landing-saved">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5L20 7" />
              </svg>
              Saved here
            </span>
            <span className="landing-manuscript-note">
              Demo notes are saved in this browser and are not encrypted.
            </span>
            <button type="button" onClick={onStartWriting} className="landing-keep focus-ring">
              Create an account to keep your notes →
            </button>
          </div>
        </div>

        {/* ─── Sample notes: each opens its own note in the practice space ─── */}
        <section className="landing-part" aria-labelledby="landing-samples-title">
          <h2 id="landing-samples-title" className="landing-h2">See what writing looks like in Yidhan.</h2>
          <p className="landing-section-body">
            Open a sample note, edit it, or start your own.
          </p>
          <ul className="landing-samples">
            {sampleNotes.map((note) => (
              <li key={note.id}>
                <a
                  href={`/demo/n/${note.id}`}
                  onClick={(event) => {
                    if (!isPlainClick(event)) return;
                    event.preventDefault();
                    onDemoNoteClick(note.id);
                  }}
                  className="landing-sample focus-ring"
                  aria-label={`Open “${note.title}” in the practice space`}
                >
                  <span className="landing-sample-title">{note.title}</span>
                  <span className="landing-sample-preview">{note.preview}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── What the blank page hides ─── */}
        <section className="landing-part" aria-labelledby="landing-features-title">
          <h2 id="landing-features-title" className="landing-h2">What stays out of the way.</h2>
          <dl className="landing-features">
            <div className="landing-feature">
              <dt>Chapters</dt>
              <dd>Notes group by time — Pinned, This week, This month, and earlier — with no folders to maintain.</dd>
            </div>
            <div className="landing-feature">
              <dt>Search</dt>
              <dd>Full-text search runs locally in your browser while your notes are unlocked, with tag and date filters.</dd>
            </div>
            <div className="landing-feature">
              <dt>Share as Letter</dt>
              <dd>Send a read-only link to one note. The key stays in the link fragment, expires within 30 days, and can be revoked any time.</dd>
            </div>
            <div className="landing-feature">
              <dt>Phone and offline</dt>
              <dd>Install Yidhan to your home screen. Write, edit, and read without a connection; changes sync when you are back online.</dd>
            </div>
          </dl>
        </section>

        {/* ─── Privacy: the promise once, then the exit ─── */}
        <section className="landing-part landing-trust" aria-labelledby="landing-trust-title">
          <h2 id="landing-trust-title" className="landing-h2">Your writing is private.</h2>
          <p className="landing-section-body">
            With an account, your note titles and content are encrypted on your device before
            they sync. We can’t read them. Dates, note sizes and tag names are not encrypted.
          </p>
          <p className="landing-section-body">
            When you sign up, you choose a passphrase and get a recovery key. If you lose both,
            we can’t get your notes back.
          </p>
          <p className="landing-section-body">You can export your notes at any time.</p>
          <a href="/security" onClick={handleSecurityLinkClick} className="landing-link focus-ring">
            How encryption works →
          </a>
        </section>

        {/* ─── Compact FAQ ─── */}
        <section className="landing-part" aria-labelledby="landing-faq-title">
          <h2 id="landing-faq-title" className="landing-h2">Common questions.</h2>
          <dl className="landing-faq">
            <div className="landing-faq-item">
              <dt>Which browsers work, and can I install it?</dt>
              <dd>
                Yidhan is a Progressive Web App that runs in modern desktop and mobile browsers.
                On most browsers you can install it from the browser’s install prompt; on iOS
                Safari, use Share → Add to Home Screen.
              </dd>
            </div>
            <div className="landing-faq-item">
              <dt>What is free, and how is it paid for?</dt>
              <dd>
                Yidhan is free and open source under AGPL-3.0, with no ads. If paid storage for
                attachments is ever added, everything that is free today stays free. It is
                maintained by one person, with no company behind it.
              </dd>
            </div>
            <div className="landing-faq-item">
              <dt>Can I import or export my notes?</dt>
              <dd>
                Yes. The profile menu exports all your notes as JSON or Markdown, any time, and
                imports Markdown files or a JSON export. An encrypted .yidhan backup is offered
                when you delete your account. Import cannot read .yidhan files.
              </dd>
            </div>
            <div className="landing-faq-item">
              <dt>What if I forget my passphrase?</dt>
              <dd>
                Your recovery key — created during setup or in Settings — opens your notes and
                lets you set a new passphrase. If you lose both, no one, Yidhan included, can
                restore them.
              </dd>
            </div>
          </dl>
        </section>

        {/* ─── Closing action ─── */}
        <section className="landing-part landing-close">
          <p className="landing-close-line">Start with one note.</p>
          <button type="button" onClick={onDemoDraftClick} className="landing-cta focus-ring">
            Try writing
          </button>
        </section>
      </article>

      {/* ─── Footer nav ─── */}
      <nav className="landing-footer">
        <button type="button" onClick={onChangelogClick} className="landing-nav-link focus-ring">
          Changelog
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={onRoadmapClick} className="landing-nav-link focus-ring">
          Roadmap
        </button>
        <span aria-hidden="true">·</span>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="landing-nav-link focus-ring">
          GitHub
        </a>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={onPrivacyClick} className="landing-nav-link focus-ring">
          Privacy
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={onTermsClick} className="landing-nav-link focus-ring">
          Terms
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={onSupportClick} className="landing-nav-link focus-ring">
          Support
        </button>
        {isInstallable && !isInstalled && (
          <>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={triggerInstall}
              className="landing-nav-link focus-ring flex items-center gap-1.5"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Install
            </button>
          </>
        )}
      </nav>

      {/* The remaining landing styles live in src/index.css so they do not weigh on the
          JS entry and app-shell budgets. Rules checked by fonts.test.ts, themeCss.test.ts
          and reviewFixes.test.tsx stay here. */}
      <style>{`
        .landing-canvas {
          position: relative;
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: var(--page-background);
          overflow-x: hidden;
        }
        .landing-headline {
          font-family: var(--font-title);
          font-weight: 500;
          font-size: clamp(2.25rem, 5.2vw, 4.5rem);
          line-height: 1.04;
          letter-spacing: -0.02em;
          margin: 0 0 1rem;
          text-wrap: balance;
          color: var(--color-text-primary);
        }
        .landing-cta {
          font-family: var(--font-body);
          font-size: 1rem;
          font-weight: 500;
          background: var(--color-cta-bg);
          color: var(--color-cta-text);
          border: none;
          border-radius: var(--radius-pill);
          padding: 0.8rem 2.2rem;
          line-height: 1.5;
          cursor: pointer;
          transition: transform 0.3s ease, background-color 0.3s ease;
        }
        .landing-cta:hover {
          transform: translateY(-1px);
          background: var(--color-cta-bg-hover);
        }
        .landing-sheet {
          position: relative;
          box-sizing: border-box;
          width: calc(100% - 2 * clamp(1rem, 3.5vw, 3rem));
          max-width: 1000px;
          margin: clamp(1.5rem, 3vw, 2.25rem) auto 0;
          padding: clamp(1.5rem, 4vw, 3rem) clamp(1.25rem, 7vw, 5rem) clamp(2rem, 5vw, 3.5rem);
          background: var(--color-manuscript-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-manuscript);
          overflow: hidden;
        }
        .landing-manuscript-glow {
          position: absolute; inset: -2rem -3rem; pointer-events: none;
          background: radial-gradient(ellipse 80% 50% at 50% 42%, var(--color-editor-glow) 0%, transparent 70%);
        }
        .landing-manuscript-title {
          font-family: var(--font-title);
          font-weight: 500;
          font-size: clamp(1.9rem, 3vw, 2.6rem);
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: var(--color-text-primary);
          margin: 0;
        }
        .landing-saved {
          display: inline-flex; align-items: center; gap: 0.35rem;
          padding: 0.25rem 0;
          color: var(--color-text-secondary);
          font-family: var(--font-body); font-size: 0.875rem; white-space: nowrap;
        }
        .landing-h2 {
          font-family: var(--font-title); font-weight: 500;
          font-size: clamp(1.9rem, 3vw, 2.6rem); line-height: 1.1; letter-spacing: -0.02em;
          margin: 0 0 0.85rem; color: var(--color-text-primary);
        }
        .landing-close-line {
          font-family: var(--font-title); font-weight: 500;
          font-size: clamp(1.75rem, 2.6vw, 2.25rem); letter-spacing: -0.02em;
          color: var(--color-text-primary); margin: 0;
          flex: 1 1 auto;
        }
      `}</style>
    </div>
  );
}
