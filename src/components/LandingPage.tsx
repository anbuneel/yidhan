import { useMemo, type MouseEvent } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { HeaderShell } from './HeaderShell';
import { createDemoStarterPreviewState, HERO_STARTER_NOTE_ID } from '../services/demoStarters';
import type { Theme } from '../types';

interface LandingPageProps {
  /** Opens sign-up. Reached from the preview's "keep and sync" link; the primary
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

      {/* ─── On the page: the product named, the promise stated ─── */}
      <section className="landing-hero">
        <div className="landing-intro">
          <h1 className="landing-headline">A notes app built around writing.</h1>
          <p className="landing-sub">
            Write a first draft, work through an idea, or make notes for something longer.
            Use focus mode when you’re writing, and tags and search when you need to find
            something.
          </p>
          <p className="landing-sub">
            Works offline. With an account, your notes sync across your devices and are
            encrypted before they leave this one.
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

        <div className="landing-proof">
          <button type="button" onClick={onSecurityClick} className="landing-fact focus-ring">
            Encrypted before it syncs
          </button>
          <span className="landing-proof-dot" aria-hidden="true">·</span>
          <span className="landing-fact-plain">Works offline</span>
          <span className="landing-proof-dot" aria-hidden="true">·</span>
          <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="landing-fact focus-ring">
            Free and open source
          </a>
          <span className="landing-proof-dot" aria-hidden="true">·</span>
          <span className="landing-fact-plain">Export any time</span>
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
              Create an account to keep and sync →
            </button>
          </div>
        </div>

        {/* ─── Sample notes: each opens in the practice space ─── */}
        <section className="landing-part" aria-labelledby="landing-samples-title">
          <h2 id="landing-samples-title" className="landing-h2">See what writing looks like in Yidhan.</h2>
          <p className="landing-section-body">
            Browse the sample notes, edit them, or start your own.
          </p>
          <ul className="landing-samples">
            {sampleNotes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={onDemoClick}
                  className="landing-sample focus-ring"
                  aria-label={`Open “${note.title}” in the practice space`}
                >
                  <span className="landing-sample-title">{note.title}</span>
                  <span className="landing-sample-preview">{note.preview}</span>
                </button>
              </li>
            ))}
          </ul>
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

        /* ─── On the page ─── */
        .landing-hero {
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          padding: 2.5rem clamp(1.25rem, 3.5vw, 3rem) 0;
          text-align: center;
          animation: landing-fade-up 0.7s var(--ease-out-quint, ease-out) backwards;
        }
        @media (min-width: 1024px) {
          .landing-hero { padding-top: 4rem; }
        }
        .landing-intro { display: flex; flex-direction: column; align-items: center; }
        .landing-headline {
          font-family: var(--font-title);
          font-weight: 500;
          font-size: clamp(2.75rem, 7vw, 6.5rem);
          line-height: 1;
          letter-spacing: -0.02em;
          margin: 0 0 1.5rem;
          text-wrap: balance;
          color: var(--color-text-primary);
        }
        .landing-sub {
          font-family: var(--font-body);
          font-weight: 400;
          font-size: clamp(1.05rem, 1.3vw, 1.25rem);
          line-height: 1.65;
          color: var(--color-text-secondary);
          max-width: 36rem;
          margin: 0 0 0.85rem;
          text-wrap: pretty;
        }
        .landing-actions {
          display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
          gap: 1rem 1.5rem;
          margin-top: 1.4rem;
        }
        .landing-cta {
          font-family: var(--font-body);
          font-size: 1rem;
          font-weight: 500;
          background: var(--color-cta-bg);
          color: var(--color-cta-text);
          border: none;
          border-radius: var(--radius-pill);
          padding: 0.9rem 2.4rem;
          line-height: 1.5;
          cursor: pointer;
          transition: transform 0.3s ease, background-color 0.3s ease;
        }
        .landing-cta:hover {
          transform: translateY(-1px);
          background: var(--color-cta-bg-hover);
        }
        .landing-micro {
          margin: 1.1rem 0 0;
          font-family: var(--font-body);
          font-size: 0.875rem;
          line-height: 1.5;
          color: var(--color-text-tertiary);
        }
        .landing-demo-link {
          display: inline-flex; align-items: center; gap: 0.3rem;
          font-family: var(--font-body);
          font-size: 0.92rem; font-weight: 500; line-height: 1.5;
          color: var(--color-text-tertiary);
          text-decoration: none;
          border-bottom: 1px dotted var(--color-text-tertiary);
          transition: color 0.2s ease, border-bottom-color 0.2s ease;
        }
        .landing-demo-link:hover { color: var(--color-accent-text); border-bottom-color: var(--color-accent); }
        .landing-demo-arrow { display: inline-block; transition: transform 0.2s ease; }
        .landing-demo-link:hover .landing-demo-arrow { transform: translateX(4px); }

        .landing-proof {
          display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
          gap: 0.5rem 0.9rem;
          padding-top: 1.75rem;
          font-size: 0.95rem; line-height: 1.5;
        }
        .landing-fact, .landing-fact-plain {
          font-family: var(--font-body);
          font-size: 0.95rem; line-height: 1.5;
          color: var(--color-text-secondary);
          background: none; border: 0; padding: 0 0 1px; cursor: pointer;
          text-decoration: none;
        }
        .landing-fact { border-bottom: 1px dotted var(--color-text-tertiary); transition: color 0.2s ease, border-bottom-color 0.2s ease; }
        .landing-fact:hover { color: var(--color-accent-text); border-bottom-color: var(--color-accent); }
        .landing-fact-plain { cursor: default; }
        .landing-proof-dot { color: var(--color-text-tertiary); }

        /* ─── The sheet: everything below the hero, at reading width ─── */
        .landing-sheet {
          position: relative;
          box-sizing: border-box;
          width: calc(100% - 2 * clamp(1rem, 3.5vw, 3rem));
          max-width: 1000px;
          margin: clamp(2.5rem, 5vw, 3.5rem) auto 0;
          padding: clamp(1.75rem, 5vw, 3.5rem) clamp(1.25rem, 8vw, 5.5rem) clamp(2rem, 5vw, 4rem);
          background: var(--color-manuscript-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-manuscript);
          overflow: hidden;
        }
        .landing-sheet > * { max-width: 46rem; }
        .landing-draft { position: relative; }
        .landing-manuscript-glow {
          position: absolute; inset: -2rem -3rem; pointer-events: none;
          background: radial-gradient(ellipse 80% 50% at 50% 42%, var(--color-editor-glow) 0%, transparent 70%);
        }
        .landing-manuscript-open {
          position: absolute; inset: -0.75rem; z-index: 2;
          background: transparent; border: 0; padding: 0; margin: 0;
          border-radius: var(--radius-input);
          cursor: text;
        }
        .landing-manuscript-page { position: relative; z-index: 1; pointer-events: none; }
        .landing-manuscript-title {
          font-family: var(--font-title);
          font-weight: 500;
          font-size: clamp(1.9rem, 3vw, 2.6rem);
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: var(--color-text-primary);
          margin: 0;
        }
        .landing-manuscript-meta {
          display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
          margin: 0.35rem 0 1.5rem; min-height: 1.5rem;
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: var(--color-text-tertiary);
        }
        .landing-manuscript-time { font-style: italic; }
        .landing-manuscript-tag { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.875rem; font-weight: 500; }
        .landing-manuscript-text {
          font-family: var(--font-body);
          font-size: clamp(1.05rem, 1.35vw, 1.25rem);
          line-height: 1.75;
        }
        .landing-manuscript-text p { margin: 0; }
        .landing-manuscript-text p + p { margin-top: 1.1em; }
        .landing-manuscript-text .landing-revision { color: var(--color-text-tertiary); }
        .landing-caret {
          display: inline-block; width: 2px; height: 1.15em;
          margin-left: 2px; vertical-align: -0.2em;
          background: var(--color-accent);
          animation: landing-blink 1.1s steps(2, start) infinite;
        }
        .landing-manuscript-foot {
          position: relative; z-index: 3;
          display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 0.75rem;
          margin-top: 2rem; padding-top: 1rem;
          border-top: 1px solid var(--glass-border);
        }
        .landing-saved {
          display: inline-flex; align-items: center; gap: 0.35rem;
          padding: 0.25rem 0;
          color: var(--color-text-secondary);
          font-family: var(--font-body); font-size: 0.875rem; white-space: nowrap;
        }
        .landing-manuscript-note {
          flex: 1 1 14rem;
          font-family: var(--font-body); font-size: 0.8125rem; line-height: 1.4;
          color: var(--color-text-tertiary);
        }
        .landing-keep {
          font-family: var(--font-body);
          font-size: 0.8125rem; font-weight: 500;
          color: var(--color-text-secondary);
          background: none;
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-pill);
          padding: 0.45rem 1rem;
          cursor: pointer;
          white-space: nowrap;
          transition: color 0.25s ease, border-color 0.25s ease;
        }
        .landing-keep:hover { color: var(--color-accent-text); border-color: var(--color-accent); }

        /* ─── Parts of the sheet: a heading and space, no divider ─── */
        .landing-part { margin-top: clamp(3.5rem, 7vw, 4.5rem); }
        .landing-h2 {
          font-family: var(--font-title); font-weight: 500;
          font-size: clamp(1.9rem, 3vw, 2.6rem); line-height: 1.1; letter-spacing: -0.02em;
          margin: 0 0 0.85rem; color: var(--color-text-primary);
        }
        .landing-section-body {
          font-family: var(--font-body);
          font-size: clamp(1.05rem, 1.35vw, 1.25rem); line-height: 1.75;
          font-weight: var(--note-weight);
          color: var(--color-text-note); margin: 0 0 1.1em;
        }
        .landing-samples { list-style: none; margin: 1.5rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
        .landing-sample {
          display: flex; flex-direction: column; gap: 0.15rem; width: 100%;
          padding: 0.35rem 0 0.35rem 1.25rem;
          background: none; border: 0; border-left: 2px solid var(--color-accent);
          text-align: left; cursor: pointer;
          font-family: var(--font-body);
          transition: border-left-color 0.2s ease;
        }
        .landing-sample-title { font-size: 1.05rem; font-weight: 600; color: var(--color-text-primary); transition: color 0.2s ease; }
        .landing-sample-preview {
          font-size: 0.95rem; color: var(--color-text-secondary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .landing-sample:hover .landing-sample-title { color: var(--color-accent-text); }
        .landing-link {
          font-family: var(--font-body); font-size: 1rem; font-weight: 500;
          color: var(--color-accent-text); background: none; border: 0; padding: 0; cursor: pointer;
          text-decoration: none;
        }
        .landing-link:hover { text-decoration: underline; }

        .landing-close {
          display: flex; flex-wrap: wrap; align-items: center; gap: 1.1rem 1.75rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--glass-border);
        }
        .landing-close-line {
          font-family: var(--font-title); font-weight: 500;
          font-size: clamp(1.75rem, 2.6vw, 2.25rem); letter-spacing: -0.02em;
          color: var(--color-text-primary); margin: 0;
          flex: 1 1 auto;
        }

        /* ─── Footer ─── */
        .landing-footer {
          display: flex; align-items: center; justify-content: center;
          gap: 0.5rem; flex-wrap: wrap;
          padding: 2.5rem clamp(1rem, 4vw, 4rem) 3rem;
          margin-top: auto;
          font-family: var(--font-body); font-size: 0.875rem;
          color: var(--color-text-tertiary);
        }
        .landing-nav-link {
          color: inherit; background: none; border: none; cursor: pointer;
          font-family: inherit; font-size: inherit; padding: 0;
          transition: color 0.2s ease; text-decoration: none;
        }
        .landing-nav-link:hover { color: var(--color-accent-text); }

        @media (max-width: 767px) {
          .landing-actions .landing-cta, .landing-close .landing-cta { width: 100%; }
          .landing-actions { width: 100%; }
          .landing-manuscript-foot .landing-keep { white-space: normal; text-align: left; }
        }

        /* The app shell remounts this page when the visitor opens sign-in from the
           public shell (src/shells/Root.tsx). The hero has already entered once. */
        .landing-handoff .landing-hero { animation: none; }

        @keyframes landing-fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes landing-blink { to { visibility: hidden; } }

        @media (prefers-reduced-motion: reduce) {
          .landing-hero { animation: none !important; }
          .landing-caret { animation: none !important; }
          .landing-cta, .landing-demo-arrow, .landing-sample, .landing-sample-title { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
