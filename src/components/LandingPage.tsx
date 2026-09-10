import { useMemo, type MouseEvent } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { HeaderShell } from './HeaderShell';
import { createDemoStarterPreviewState, HERO_STARTER_NOTE_ID } from '../services/demoStorage';
import { NoteCard } from './NoteCard';
import type { Note, Tag, Theme } from '../types';

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

/** Only a plain left-click is routed in-app; modified clicks keep the link's own behaviour. */
const isPlainClick = (event: MouseEvent<HTMLAnchorElement>) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.metaKey &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.shiftKey;

/** Labels of the real editor toolbar, in its order. Decorative: the preview is a picture. */
const TOOLBAR_LABELS = [
  'B', 'I', '</>', 'H1', 'List', 'Undo', 'Redo', 'Link', 'U', 'S', 'Mark', 'H2', 'H3',
  '1.List', 'Task', 'Quote', 'Code', '···',
] as const;
const TOOLBAR_DIMMED = new Set(['Undo', 'Redo']);

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

  // The sample cards are the Practice Space's own starters, so "open" shows the same
  // note there. The pinned welcome and the note already in the hero are left out.
  const sampleNotes = useMemo<Note[]>(() => {
    const demoState = createDemoStarterPreviewState();
    const tagsById = new Map<string, Tag>(
      demoState.tags.map((tag) => [
        tag.localId,
        { id: tag.localId, name: tag.name, color: tag.color, createdAt: new Date(tag.createdAt) },
      ])
    );

    return demoState.notes
      .filter((note) => !note.pinned && note.localId !== HERO_STARTER_NOTE_ID)
      .map((note) => ({
        id: note.localId,
        title: note.title,
        content: note.content,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt),
        tags: note.tagIds
          .map((tagId) => tagsById.get(tagId))
          .filter((tag): tag is Tag => Boolean(tag)),
        pinned: note.pinned,
        deletedAt: null,
        syncStatus: 'synced',
      }));
  }, []);

  const handleDemoLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onDemoClick();
  };

  return (
    <div className="landing-canvas">
      <HeaderShell theme={theme} onThemeToggle={onThemeToggle} onSignIn={onSignIn} />

      {/* ─── First screen: the product named, the promise stated, the editor shown ─── */}
      <section className="landing-hero">
        <div className="landing-intro">
          <h1 className="landing-headline">A quiet home for your personal notes.</h1>
          <p className="landing-sub">
            Capture an idea, think something through, or keep a passage worth returning to.
            Nothing to set up.
          </p>
          <p className="landing-sub">
            Each note is locked on your device before it syncs, so nobody else can read it.
            Not even us.
          </p>
          <div className="landing-actions">
            <button type="button" onClick={onDemoDraftClick} className="landing-cta focus-ring">
              Try writing
            </button>
            <a href="/demo" onClick={handleDemoLinkClick} className="landing-demo-link focus-ring">
              Explore sample notes
              <span className="landing-demo-arrow" aria-hidden="true">→</span>
            </a>
          </div>
          <p className="landing-micro">Free to use. No account needed to try.</p>
        </div>

        {/* The manuscript as the Practice Space renders it. A picture of the editor, not
            an imitation of one: clicking anywhere on it opens the real thing. */}
        <div className="landing-manuscript">
          <div className="landing-manuscript-glow" aria-hidden="true" />
          <button
            type="button"
            onClick={onDemoDraftClick}
            className="landing-manuscript-open focus-ring"
            aria-label="Try writing in the Practice Space"
          />
          <div className="landing-manuscript-page">
            <p className="landing-manuscript-title">An idea for Saturday</p>
            <div className="landing-manuscript-meta" aria-hidden="true">
              <span className="landing-manuscript-tag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add tag
              </span>
              <span>Just now</span>
            </div>
            <div className="landing-manuscript-divider" aria-hidden="true" />
            <div className="landing-manuscript-toolbar" aria-hidden="true">
              {TOOLBAR_LABELS.map((label) => (
                <span
                  key={label}
                  className={`landing-tb${TOOLBAR_DIMMED.has(label) ? ' dim' : ''}`}
                  data-label={label}
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="landing-manuscript-text">
              <p>Leave the morning unplanned.</p>
              <p>Walk to the market. Pick up something for lunch. Take the longer way home.</p>
              <p>
                Maybe that is enough.
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
              A practice draft. It stays on this device and is not encrypted.
            </span>
            <button type="button" onClick={onStartWriting} className="landing-keep focus-ring">
              Create an account to keep and sync →
            </button>
          </div>
        </div>
      </section>

      {/* ─── Proof: one line, stated once ─── */}
      <div className="landing-proof">
        <button type="button" onClick={onSecurityClick} className="landing-fact focus-ring">
          Encrypted before it syncs
        </button>
        <span className="landing-proof-dot" aria-hidden="true">·</span>
        <span className="landing-fact-plain">Works offline</span>
        <span className="landing-proof-dot" aria-hidden="true">·</span>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="landing-fact focus-ring">
          Free and open source
        </a>
        <span className="landing-proof-dot" aria-hidden="true">·</span>
        <span className="landing-fact-plain">Export any time</span>
      </div>

      {/* ─── Sample notes: three uses, each opens in the Practice Space ─── */}
      <section className="landing-section" aria-labelledby="landing-samples-title">
        <div className="landing-section-head">
          <h2 id="landing-samples-title" className="landing-h2">Small thoughts, worth keeping.</h2>
          <p className="landing-section-body">
            Write a little. Come back when you want.
            <br />
            Open any of these in the editor and change it.
          </p>
        </div>
        <div className="landing-samples">
          {sampleNotes.map((note) => (
            <div key={note.id} className="landing-sample">
              <NoteCard
                note={note}
                onClick={() => undefined}
                onDelete={() => undefined}
                onTogglePin={() => undefined}
                isDecorative
              />
              <button
                type="button"
                onClick={onDemoClick}
                className="landing-sample-open focus-ring"
                aria-label={`Open “${note.title}” in the Practice Space`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ─── Trust: the promise once, then the exits ─── */}
      <section className="landing-section landing-trust" aria-labelledby="landing-trust-title">
        <h2 id="landing-trust-title" className="landing-h2">Your words stay yours.</h2>
        <div className="landing-trust-body">
          <p className="landing-section-body">
            Notes are encrypted on your device before they sync. The server keeps ciphertext it
            cannot read, and neither can we. Export your notes any time. Read the source. Leave
            whenever you want.
          </p>
          <button type="button" onClick={onSecurityClick} className="landing-link focus-ring">
            How the locking works →
          </button>
          <div className="landing-hairline" aria-hidden="true" />
          <p className="landing-section-body landing-maker">
            Yidhan is built and looked after by one person. It will never carry ads, tracking,
            streaks or notifications.
          </p>
        </div>
      </section>

      {/* ─── Closing action ─── */}
      <section className="landing-close">
        <p className="landing-close-line">Start with one note.</p>
        <button type="button" onClick={onDemoDraftClick} className="landing-cta focus-ring">
          Try writing
        </button>
      </section>

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
          background: var(--color-bg-primary);
          overflow-x: hidden;
        }

        /* ─── First screen ─── */
        .landing-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 2.5rem;
          align-items: center;
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
          padding: 2rem clamp(1.25rem, 3.5vw, 3rem) 0;
          animation: landing-fade-up 0.7s var(--ease-out-quint, ease-out) backwards;
        }
        @media (min-width: 1024px) {
          .landing-hero {
            grid-template-columns: minmax(0, 30rem) minmax(0, 1fr);
            gap: clamp(3rem, 5vw, 4.5rem);
            padding-top: 3.5rem;
          }
        }
        .landing-intro { display: flex; flex-direction: column; align-items: flex-start; }
        .landing-headline {
          font-family: var(--font-display);
          font-weight: 300;
          font-size: clamp(2.75rem, 4.6vw, 4rem);
          line-height: 1.05;
          letter-spacing: 0;
          margin: 0 0 1.5rem;
          text-wrap: balance;
          color: var(--color-text-primary);
        }
        .landing-sub {
          font-family: var(--font-body);
          font-weight: 300;
          font-size: clamp(1.05rem, 1.2vw, 1.15rem);
          line-height: 1.65;
          color: var(--color-text-secondary);
          max-width: 30rem;
          margin: 0 0 0.85rem;
        }
        .landing-actions {
          display: flex; flex-wrap: wrap; align-items: center; gap: 1rem 1.5rem;
          margin-top: 1.4rem;
        }
        .landing-cta {
          font-family: var(--font-body);
          font-size: 1rem;
          font-weight: 500;
          background: var(--color-cta-bg);
          color: var(--color-cta-text);
          border: none;
          border-radius: 2px 16px 4px 16px;
          padding: 0.9rem 2.4rem;
          cursor: pointer;
          box-shadow: 0 6px 24px var(--color-accent-glow);
          transition: transform 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease;
        }
        .landing-cta:hover {
          transform: translateY(-1px);
          background: var(--color-cta-bg-hover);
          box-shadow: 0 10px 34px var(--color-accent-glow);
        }
        .landing-micro {
          margin: 1.1rem 0 0;
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: var(--color-text-tertiary);
        }
        .landing-demo-link {
          display: inline-flex; align-items: center; gap: 0.3rem;
          font-family: var(--font-body);
          font-size: 0.92rem;
          color: var(--color-text-tertiary);
          text-decoration: none;
          border-bottom: 1px dotted var(--color-text-tertiary);
          transition: color 0.2s ease, border-bottom-color 0.2s ease;
        }
        .landing-demo-link:hover { color: var(--color-accent); border-bottom-color: var(--color-accent); }
        .landing-demo-arrow { display: inline-block; transition: transform 0.2s ease; }
        .landing-demo-link:hover .landing-demo-arrow { transform: translateX(4px); }

        /* ─── The manuscript preview ─── */
        .landing-manuscript {
          position: relative;
          padding: clamp(1.5rem, 3vw, 2.25rem) clamp(1.25rem, 3vw, 2.75rem) clamp(1.25rem, 2.5vw, 1.9rem);
          background: color-mix(in srgb, var(--color-bg-primary) 92%, white 8%);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-manuscript);
          overflow: hidden;
          transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .landing-manuscript:has(.landing-manuscript-open:hover) {
          border-color: var(--color-accent-muted);
        }
        .landing-manuscript-glow {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 80% 50% at 50% 42%, color-mix(in srgb, var(--color-accent) 12%, transparent) 0%, transparent 70%);
        }
        .landing-manuscript-open {
          position: absolute; inset: 0; z-index: 2;
          background: transparent; border: 0; padding: 0; margin: 0;
          border-radius: inherit;
          cursor: text;
        }
        .landing-manuscript-page { position: relative; z-index: 1; pointer-events: none; }
        .landing-manuscript-title {
          font-family: var(--font-display);
          font-weight: 600;
          font-size: clamp(1.75rem, 2.4vw, 2.25rem);
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: var(--color-text-primary);
          margin: 0;
        }
        .landing-manuscript-meta {
          display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
          margin: 0.35rem 0 0.5rem; min-height: 1.5rem;
          font-family: var(--font-body);
          font-size: 0.75rem;
          color: var(--color-text-tertiary);
        }
        .landing-manuscript-tag { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.85rem; }
        .landing-manuscript-divider {
          height: 1px; margin-top: 0.85rem; opacity: 0.6;
          background: linear-gradient(to right, transparent 0%, color-mix(in srgb, var(--color-accent) 25%, transparent) 30%, color-mix(in srgb, var(--color-accent) 25%, transparent) 70%, transparent 100%);
        }
        .landing-manuscript-toolbar {
          display: flex; align-items: center; gap: 2px;
          min-height: 44px; padding: 6px 8px; margin: 0.85rem 0 1.25rem;
          border: 1px solid var(--glass-border);
          border-radius: 2px 12px 4px 12px;
          background: var(--color-bg-secondary);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }
        .landing-tb {
          width: 32px; height: 32px; flex: 0 0 32px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 6px;
          color: var(--color-text-secondary);
          font-family: var(--font-body);
          font-size: 0.72rem; font-weight: 600; white-space: nowrap;
        }
        .landing-tb.dim { opacity: 0.4; }
        .landing-tb[data-label="I"] { font-family: var(--font-display); font-style: italic; font-size: 0.95rem; }
        .landing-tb[data-label="</>"] { font-family: var(--font-mono); font-weight: 400; }
        .landing-tb[data-label="U"] { text-decoration: underline; font-size: 0.85rem; }
        .landing-tb[data-label="S"] { text-decoration: line-through; font-size: 0.85rem; }
        .landing-tb[data-label="B"] { font-size: 0.85rem; }
        .landing-manuscript-text {
          font-family: var(--font-body);
          font-weight: 400;
          font-size: clamp(1.05rem, 1.25vw, 1.2rem);
          line-height: 1.75;
          color: var(--color-text-primary);
          min-height: 6.5em;
        }
        .landing-manuscript-text p { margin: 0; }
        .landing-manuscript-text p + p { margin-top: 1.75em; }
        .landing-caret {
          display: inline-block; width: 2px; height: 1.15em;
          margin-left: 2px; vertical-align: -0.2em;
          background: var(--color-accent);
          animation: landing-blink 1.1s steps(2, start) infinite;
        }
        .landing-manuscript-foot {
          position: relative; z-index: 3;
          display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 0.75rem;
          margin-top: 1.5rem; padding-top: 1rem;
          border-top: 1px solid color-mix(in srgb, var(--glass-border) 60%, transparent);
        }
        .landing-saved {
          display: inline-flex; align-items: center; gap: 0.35rem;
          padding: 0.25rem 0.6rem; border-radius: 999px;
          background: var(--color-success-glow); color: var(--color-success);
          font-family: var(--font-body); font-size: 0.78rem; font-weight: 500; white-space: nowrap;
        }
        .landing-manuscript-note {
          flex: 1 1 14rem;
          font-family: var(--font-body); font-size: 0.8rem; line-height: 1.4;
          color: var(--color-text-tertiary);
        }
        .landing-keep {
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: var(--color-text-secondary);
          background: none;
          border: 1px solid var(--glass-border);
          border-radius: 2px 12px 4px 12px;
          padding: 0.45rem 1rem;
          cursor: pointer;
          white-space: nowrap;
          transition: color 0.25s ease, border-color 0.25s ease;
        }
        .landing-keep:hover { color: var(--color-accent); border-color: var(--color-accent); }

        /* ─── Proof line ─── */
        .landing-proof {
          display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
          gap: 0.5rem 0.9rem;
          padding: 2.25rem clamp(1.25rem, 3.5vw, 3rem) 0;
          text-align: center;
        }
        .landing-fact, .landing-fact-plain {
          font-family: var(--font-body);
          font-size: 0.95rem;
          color: var(--color-text-secondary);
          background: none; border: 0; padding: 0 0 1px; cursor: pointer;
          text-decoration: none;
        }
        .landing-fact { border-bottom: 1px dotted var(--color-text-tertiary); transition: color 0.2s ease, border-bottom-color 0.2s ease; }
        .landing-fact:hover { color: var(--color-accent); border-bottom-color: var(--color-accent); }
        .landing-fact-plain { cursor: default; }
        .landing-proof-dot { color: var(--color-text-tertiary); }

        /* ─── Sections ─── */
        .landing-section {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
          padding: clamp(4.5rem, 8vw, 7.5rem) clamp(1.25rem, 3.5vw, 3rem) 0;
        }
        .landing-h2 {
          font-family: var(--font-display); font-weight: 300;
          font-size: clamp(2.1rem, 2.8vw, 2.65rem); line-height: 1.1; letter-spacing: 0;
          margin: 0; color: var(--color-text-primary);
        }
        .landing-section-body {
          font-family: var(--font-body);
          font-size: 1.02rem; line-height: 1.7;
          color: var(--color-text-secondary); margin: 0;
        }
        .landing-section-head {
          display: flex; flex-direction: column; gap: 0.75rem;
          margin-bottom: 1.75rem;
        }
        @media (min-width: 1024px) {
          .landing-section-head { flex-direction: row; align-items: flex-end; justify-content: space-between; gap: 3rem; margin-bottom: 2.25rem; }
          .landing-section-head .landing-h2 { max-width: 24rem; }
          .landing-section-head .landing-section-body { max-width: 26rem; text-align: right; padding-bottom: 0.35rem; }
        }
        .landing-samples {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
          gap: 1.5rem;
          align-items: start;
        }
        .landing-sample { position: relative; }
        .landing-sample-open {
          position: absolute; inset: 0; z-index: 2;
          background: transparent; border: 0; padding: 0; margin: 0;
          border-radius: var(--radius-card);
          cursor: pointer;
        }
        .landing-sample:has(.landing-sample-open:hover) .note-card { box-shadow: var(--shadow-lg); }

        .landing-trust { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.25rem; align-items: start; }
        @media (min-width: 1024px) {
          .landing-trust { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(3rem, 5vw, 4.5rem); }
        }
        .landing-trust-body { display: flex; flex-direction: column; align-items: flex-start; gap: 1.25rem; max-width: 34rem; }
        .landing-trust-body .landing-section-body { font-size: 1.08rem; line-height: 1.75; }
        .landing-link {
          font-family: var(--font-body); font-size: 0.95rem;
          color: var(--color-accent); background: none; border: 0; padding: 0; cursor: pointer;
          text-decoration: none;
        }
        .landing-link:hover { text-decoration: underline; }
        .landing-hairline { width: 100%; height: 1px; background: color-mix(in srgb, var(--glass-border) 60%, transparent); }
        .landing-maker { font-size: 0.98rem; }

        .landing-close {
          display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
          gap: 1.1rem 1.75rem;
          padding: clamp(4rem, 7vw, 6.5rem) clamp(1.25rem, 3.5vw, 3rem) 0;
          text-align: center;
        }
        .landing-close-line {
          font-family: var(--font-display); font-weight: 300;
          font-size: clamp(1.85rem, 2.2vw, 2rem);
          color: var(--color-text-primary); margin: 0;
        }

        /* ─── Footer ─── */
        .landing-footer {
          display: flex; align-items: center; justify-content: center;
          gap: 0.5rem; flex-wrap: wrap;
          padding: 2.5rem clamp(1rem, 4vw, 4rem) 3rem;
          margin-top: auto;
          font-family: var(--font-body); font-size: 0.78rem;
          color: var(--color-text-tertiary);
        }
        .landing-nav-link {
          color: inherit; background: none; border: none; cursor: pointer;
          font-family: inherit; font-size: inherit; padding: 0;
          transition: color 0.2s ease; text-decoration: none;
        }
        .landing-nav-link:hover { color: var(--color-accent); }

        @media (max-width: 767px) {
          .landing-cta { width: 100%; }
          .landing-actions { width: 100%; }
          .landing-manuscript-foot .landing-keep { white-space: normal; text-align: left; }
        }

        @keyframes landing-fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes landing-blink { to { visibility: hidden; } }

        @media (prefers-reduced-motion: reduce) {
          .landing-hero { animation: none !important; }
          .landing-caret { animation: none !important; }
          .landing-cta, .landing-demo-arrow { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
