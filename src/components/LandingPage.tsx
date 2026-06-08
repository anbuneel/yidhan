import { useState, useRef, useEffect, useCallback, useMemo, type MouseEvent } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { HeaderShell } from './HeaderShell';
import { createDemoStarterPreviewState, DEMO_CONTENT_STORAGE_KEY } from '../services/demoStorage';
import { NoteCard } from './NoteCard';
import type { Note, Tag, Theme } from '../types';

interface LandingPageProps {
  onStartWriting: () => void;
  onSignIn: () => void;
  theme: Theme;
  onThemeToggle: () => void;
  onDemoClick: () => void;
  onChangelogClick: () => void;
  onRoadmapClick: () => void;
  onPrivacyClick: () => void;
  onTermsClick: () => void;
  onSupportClick: () => void;
}

export function LandingPage({
  onStartWriting,
  onSignIn,
  theme,
  onThemeToggle,
  onDemoClick,
  onChangelogClick,
  onRoadmapClick,
  onPrivacyClick,
  onTermsClick,
  onSupportClick,
}: LandingPageProps) {
  const { isInstallable, isInstalled, triggerInstall } = useInstallPrompt();
  const previewNotes = useMemo<Note[]>(() => {
    const demoState = createDemoStarterPreviewState();
    const tagsById = new Map<string, Tag>(
      demoState.tags.map((tag) => [
        tag.localId,
        {
          id: tag.localId,
          name: tag.name,
          color: tag.color,
          createdAt: new Date(tag.createdAt),
        },
      ])
    );

    return demoState.notes.map((note) => ({
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

  // The hero quietly becomes a real writing surface on desktop. On phones we
  // route to the Practice Space instead — the in-place reveal fights the mobile
  // keyboard (viewport shift), so we reserve the signature moment for desktop.
  const [isWriting, setIsWriting] = useState(false);
  const [hasWritten, setHasWritten] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState(false);
  const landingRootRef = useRef<HTMLDivElement>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const hasEditedDraftRef = useRef(false);
  const focusTimeoutRef = useRef<number | null>(null);
  const closeStartTimeoutRef = useRef<number | null>(null);

  const isMobile = () =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(max-width: 768px)').matches === true;

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const enterWriting = useCallback(() => {
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      landingRootRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }

    setIsWriting(true);
    if (focusTimeoutRef.current !== null) {
      window.clearTimeout(focusTimeoutRef.current);
    }
    const focusDelay = prefersReducedMotion() ? 0 : 360;
    focusTimeoutRef.current = window.setTimeout(() => {
      editableRef.current?.focus();
      focusTimeoutRef.current = null;
    }, focusDelay);
  }, []);

  const handleStartWriting = () => {
    if (isMobile()) {
      onDemoClick();
      return;
    }
    enterWriting();
  };

  const handleCloseStart = () => {
    if (isMobile()) {
      onDemoClick();
      return;
    }
    const reducedMotion = prefersReducedMotion();
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    if (closeStartTimeoutRef.current !== null) {
      window.clearTimeout(closeStartTimeoutRef.current);
    }
    const revealDelay = reducedMotion ? 0 : 520;
    closeStartTimeoutRef.current = window.setTimeout(() => {
      enterWriting();
      closeStartTimeoutRef.current = null;
    }, revealDelay);
  };

  const getDraftText = () => {
    const el = editableRef.current;
    return (el?.innerText || el?.textContent || '').trim();
  };

  const handleInput = () => {
    const text = getDraftText();
    hasEditedDraftRef.current = true;
    setHasWritten(text.length > 0);
    setDraftSaveError(false);
  };

  const saveDraftBeforeAuth = () => {
    const text = getDraftText();

    try {
      if (!text) {
        if (hasEditedDraftRef.current) {
          localStorage.removeItem(DEMO_CONTENT_STORAGE_KEY);
        }
        setDraftSaveError(false);
        return true;
      }

      localStorage.setItem(DEMO_CONTENT_STORAGE_KEY, text);
      setDraftSaveError(false);
      return true;
    } catch (error) {
      console.warn('Failed to save landing draft before signup:', error);
      setDraftSaveError(true);
      return false;
    }
  };

  const handleContinue = () => {
    if (saveDraftBeforeAuth()) {
      onStartWriting();
    }
  };

  const handleSignIn = () => {
    if (saveDraftBeforeAuth()) {
      onSignIn();
    }
  };

  const handleDemoClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    onDemoClick();
  };

  // Scroll-reveal for the gallery "second act".
  useEffect(() => {
    const root = landingRootRef.current;
    if (!root) return;

    const els = Array.from(root.querySelectorAll<HTMLElement>('.landing-reveal'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current !== null) {
        window.clearTimeout(focusTimeoutRef.current);
      }
      if (closeStartTimeoutRef.current !== null) {
        window.clearTimeout(closeStartTimeoutRef.current);
      }
    };
  }, []);

  const hiddenHeroTabIndex = isWriting ? -1 : undefined;

  return (
    <div ref={landingRootRef} className="landing-canvas">
      <HeaderShell theme={theme} onThemeToggle={onThemeToggle} onSignIn={handleSignIn} />

      {/* ─── Hero fold — quiet, and it becomes the editor ─── */}
      <section className={`landing-hero${isWriting ? ' writing' : ''}`}>
        <div className="landing-stack">
          {/* Marketing prose */}
          <div className="landing-prose" aria-hidden={isWriting}>
            <h1 className="landing-headline">
              Begin where you <em>are.</em>
            </h1>
            <p className="landing-sub">
              A quiet space for the half-formed thought. No folders. No organizing.
              Nothing to learn — just room to think.
            </p>
            <button
              type="button"
              onClick={handleStartWriting}
              className="landing-cta focus-ring"
              tabIndex={hiddenHeroTabIndex}
            >
              Start writing
            </button>
            <p className="landing-micro">No account needed to start.</p>
            <a
              href="/demo"
              onClick={handleDemoClick}
              className="landing-demo-link focus-ring"
              tabIndex={hiddenHeroTabIndex}
            >
              Explore the Practice Space
              <span className="landing-demo-arrow" aria-hidden="true">→</span>
            </a>
          </div>

          {/* The real writing surface, revealed in the hero's place (desktop) */}
          <div className="landing-hero-editor-wrap" aria-hidden={!isWriting}>
            <div className="landing-hero-editor">
              <div className="landing-hero-glow" aria-hidden="true" />
              <div
                ref={editableRef}
                className="landing-hero-doc"
                contentEditable={isWriting}
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="Your writing"
                spellCheck={isWriting}
                onInput={handleInput}
              />
              <div className="landing-hero-foot">
                <span className={`landing-seal${hasWritten ? ' show' : ''}`}>
                  <span className="landing-seal-dot" aria-hidden="true" />
                  Locked before it leaves your hands.
                </span>
                <button
                  type="button"
                  onClick={handleContinue}
                  className={`landing-continue focus-ring${hasWritten ? ' show' : ''}`}
                  disabled={!hasWritten}
                  aria-hidden={!hasWritten}
                  tabIndex={hasWritten ? 0 : -1}
                >
                  Continue in Yidhan →
                </button>
              </div>
              {draftSaveError && (
                <p className="landing-draft-error" role="alert">
                  This browser blocked local saving. Copy your words before continuing.
                </p>
              )}
            </div>
          </div>
        </div>

        <a
          className="landing-scrollcue focus-ring"
          href="#landing-surface"
          aria-hidden={isWriting}
          tabIndex={hiddenHeroTabIndex}
        >
          <span>Or see how it feels</span>
          <span className="landing-scrollcue-arrow" aria-hidden="true">↓</span>
        </a>
      </section>

      {/* ─── Gallery — the honest "second act": the real product ─── */}
      <div className="landing-gallery">
        {/* The surface */}
        <section className="landing-piece landing-reveal" id="landing-surface">
          <div className="landing-caption">
            <p className="landing-kicker">The surface</p>
            <h2 className="landing-piece-title">A page that gets out of the way.</h2>
            <p className="landing-piece-body">
              No sidebars. No menus crowding the margins. Write in focus mode and the
              interface recedes — leaving only your words and a soft manuscript glow around
              the page.
            </p>
          </div>
          <div className="landing-mock-editor" aria-hidden="true">
            <div className="landing-mock-glow" />
            <div className="landing-mock-doc">
              <div className="landing-mock-title">Four Thousand Weeks</div>
              <p>
                Started it last night. The bit about how we&rsquo;ll never &ldquo;get on
                top of everything&rdquo; was oddly freeing.<span className="landing-car" />
              </p>
            </div>
          </div>
        </section>

        {/* What accumulates */}
        <section className="landing-piece-wide">
          <div className="landing-wide-inner landing-reveal">
            <div className="landing-caption">
              <p className="landing-kicker">What accumulates</p>
              <h2 className="landing-piece-title">Your thoughts, gathered like pages.</h2>
              <p className="landing-piece-body">
                Notes settle into a quiet, asymmetric arrangement — no rigid grid, no pressure
                to organize. Tag them, or don&rsquo;t. They wait for you, exactly as you left
                them.
              </p>
            </div>
            <div className="landing-grid" aria-hidden="true">
              {previewNotes.map((note) => (
                <div key={note.id} className="landing-note-card-wrap">
                  <NoteCard
                    note={note}
                    onClick={() => undefined}
                    onDelete={() => undefined}
                    onTogglePin={() => undefined}
                    isDecorative
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What stays yours */}
        <section className="landing-piece landing-reveal">
          <div className="landing-caption">
            <p className="landing-kicker">What stays yours</p>
            <h2 className="landing-piece-title">Locked before it leaves your hands.</h2>
            <p className="landing-piece-body">
              Every word is encrypted on your device before it syncs — so it reaches your
              other screens, but never ours readable. It works offline, and the code is open
              for anyone to check.
            </p>
          </div>
          <div className="landing-vault" aria-hidden="true">
            <span className="landing-vault-ring" />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="5" y="11" width="14" height="9" rx="2.2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              <circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
            </svg>
          </div>
        </section>
      </div>

      {/* ─── Close — echoes the hero ─── */}
      <section className="landing-close landing-reveal">
        <h2 className="landing-close-title">
          Your page is <em>waiting.</em>
        </h2>
        <button type="button" onClick={handleCloseStart} className="landing-cta focus-ring">
          Start writing
        </button>
        <p className="landing-micro">
          No account needed — your first words stay on this device.
        </p>
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
        <a
          href="https://github.com/anbuneel/yidhan"
          target="_blank"
          rel="noopener noreferrer"
          className="landing-nav-link focus-ring"
        >
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

        /* ─── Hero ─── */
        .landing-hero {
          position: relative;
          min-height: calc(100vh - 4.5rem);
          min-height: calc(100dvh - 4.5rem);
          display: grid;
          place-items: center;
          text-align: center;
          padding: 2rem clamp(1.4rem, 5vw, 3rem) 4rem;
          background: radial-gradient(
            ellipse 70% 60% at 50% 44%,
            color-mix(in srgb, var(--color-accent) 7%, var(--color-bg-primary) 93%) 0%,
            var(--color-bg-primary) 62%
          );
        }
        .landing-stack {
          display: grid;
          width: min(680px, 100%);
        }
        .landing-stack > * { grid-area: 1 / 1; }

        /* Marketing prose */
        .landing-prose {
          animation: landing-fade-up 0.7s var(--ease-out-quint, ease-out) backwards;
          transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.22,1,0.36,1), filter 0.7s ease;
        }
        .landing-headline {
          font-family: var(--font-display);
          font-weight: 300;
          font-size: 4.75rem;
          line-height: 1.03;
          letter-spacing: 0;
          margin: 0 0 1.6rem;
          text-wrap: balance;
          color: var(--color-text-primary);
        }
        .landing-headline em { font-style: italic; color: var(--color-accent); font-weight: 400; }
        .landing-sub {
          font-family: var(--font-body);
          font-weight: 300;
          font-size: 1.1rem;
          line-height: 1.7;
          color: var(--color-text-secondary);
          max-width: 40ch;
          margin: 0 auto 2.4rem;
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
          font-size: 0.76rem;
          color: var(--color-text-tertiary);
        }
        .landing-demo-link {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          margin-top: 1.6rem;
          font-family: var(--font-body);
          font-size: 0.82rem;
          color: var(--color-text-tertiary);
          text-decoration: none;
          border-bottom: 1px dotted var(--color-text-tertiary);
          transition: color 0.2s ease, border-bottom-color 0.2s ease;
        }
        .landing-demo-link:hover { color: var(--color-accent); border-bottom-color: var(--color-accent); }
        .landing-demo-arrow { display: inline-block; transition: transform 0.2s ease; }
        .landing-demo-link:hover .landing-demo-arrow { transform: translateX(4px); }

        /* Hero editor (revealed) — matches the real manuscript surface */
        .landing-hero-editor-wrap {
          opacity: 0;
          transform: translateY(10px);
          pointer-events: none;
          transition: opacity 0.8s ease 0.12s, transform 0.8s cubic-bezier(0.22,1,0.36,1) 0.12s;
        }
        .landing-hero-editor {
          position: relative;
          text-align: left;
          background: var(--color-bg-primary);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-manuscript);
          padding: clamp(2.2rem, 4.5vw, 3.4rem) clamp(1.8rem, 4.5vw, 3.8rem);
          min-height: 300px;
          overflow: hidden;
          transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .landing-hero-editor:focus-within {
          border-color: var(--color-accent-muted);
          box-shadow:
            var(--shadow-manuscript),
            0 0 0 2px color-mix(in srgb, var(--color-accent) 26%, transparent);
        }
        .landing-hero-glow {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 80% 50% at 50% 36%, var(--color-accent-glow) 0%, transparent 70%);
        }
        .landing-hero-doc {
          position: relative; z-index: 1;
          font-family: var(--font-body);
          font-weight: 400;
          font-size: 1.2rem;
          line-height: 1.75;
          color: var(--color-text-primary);
          outline: none;
          caret-color: var(--color-accent);
          min-height: 5.5em;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .landing-hero-doc:empty::before {
          content: "Begin where you are\\2026";
          color: var(--color-text-tertiary);
          font-style: italic;
          font-weight: 300;
          pointer-events: none;
        }
        .landing-hero-foot {
          position: relative; z-index: 1;
          display: flex; align-items: center; justify-content: space-between;
          gap: 1rem; margin-top: 1.6rem;
        }
        .landing-seal {
          font-family: var(--font-body);
          font-size: 0.72rem; letter-spacing: 0.04em;
          color: var(--color-text-tertiary);
          display: inline-flex; align-items: center; gap: 0.5rem;
          opacity: 0; transform: translateY(4px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .landing-seal-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent); }
        .landing-seal.show { opacity: 0.9; transform: none; }
        .landing-continue {
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: var(--color-text-secondary);
          background: none;
          border: 1px solid var(--glass-border);
          border-radius: 2px 12px 4px 12px;
          padding: 0.45rem 1rem;
          cursor: pointer;
          opacity: 0; transform: translateY(4px);
          pointer-events: none;
          transition: opacity 0.6s ease, transform 0.6s ease, color 0.25s ease, border-color 0.25s ease;
        }
        .landing-continue.show { opacity: 1; transform: none; pointer-events: auto; }
        .landing-continue:hover { color: var(--color-accent); border-color: var(--color-accent); }
        .landing-draft-error {
          position: relative;
          z-index: 1;
          margin: 1rem 0 0;
          font-family: var(--font-body);
          font-size: 0.78rem;
          line-height: 1.5;
          color: var(--color-destructive);
        }

        /* writing state cross-fade */
        .landing-hero.writing .landing-prose { opacity: 0; transform: translateY(-8px); filter: blur(2px); pointer-events: none; }
        .landing-hero.writing .landing-hero-editor-wrap { opacity: 1; transform: none; pointer-events: auto; }
        .landing-hero.writing .landing-scrollcue { opacity: 0; pointer-events: none; }

        .landing-scrollcue {
          position: absolute; left: 50%; bottom: 2.2rem; transform: translateX(-50%);
          display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
          font-family: var(--font-body);
          font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.18em;
          color: var(--color-text-tertiary); text-decoration: none;
          animation: landing-float 3.4s ease-in-out infinite;
          transition: opacity 0.5s ease;
        }
        .landing-scrollcue:hover { color: var(--color-accent); }
        .landing-scrollcue-arrow { font-size: 1rem; }

        /* ─── Gallery ─── */
        .landing-gallery {
          width: 100%;
          max-width: 1080px;
          margin: 0 auto;
          padding: clamp(3rem, 10vw, 9rem) clamp(1.4rem, 6vw, 4rem);
        }
        .landing-piece {
          display: grid;
          gap: clamp(2rem, 5vw, 4.5rem);
          align-items: center;
          margin-bottom: clamp(6rem, 16vw, 13rem);
        }
        .landing-piece:last-child { margin-bottom: 0; }
        @media (min-width: 860px) {
          .landing-piece { grid-template-columns: 1fr 1fr; }
          .landing-piece.flip .landing-caption { order: 2; }
        }
        .landing-kicker {
          font-family: var(--font-body);
          font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.18em;
          color: var(--color-accent); margin: 0 0 1rem;
        }
        .landing-piece-title {
          font-family: var(--font-display); font-weight: 300;
          font-size: 2.65rem; line-height: 1.1; letter-spacing: 0;
          margin: 0 0 1rem; color: var(--color-text-primary);
        }
        .landing-piece-body {
          font-family: var(--font-body);
          font-size: 1.02rem; line-height: 1.75;
          color: var(--color-text-secondary); max-width: 42ch; margin: 0;
        }

        /* Surface mock editor */
        .landing-mock-editor {
          position: relative;
          background: var(--color-bg-primary);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-manuscript);
          padding: clamp(2rem, 4vw, 3.2rem);
          overflow: hidden;
        }
        .landing-mock-glow {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 80% 50% at 50% 36%, var(--color-accent-glow) 0%, transparent 70%);
        }
        .landing-mock-doc { position: relative; z-index: 1; }
        .landing-mock-title {
          font-family: var(--font-display); font-weight: 600;
          font-size: 1.9rem; line-height: 1.3; letter-spacing: 0;
          color: var(--color-text-primary); margin-bottom: 0.8rem;
        }
        .landing-mock-doc p {
          font-family: var(--font-body); font-weight: 400;
          font-size: 1.16rem; line-height: 1.85;
          color: var(--color-text-primary); margin: 0;
        }

        /* Note grid - rendered with the real NoteCard in decorative mode */
        /* "What accumulates" steps out of the editorial 2-col split: a centered
           caption above a centered 2-up masonry. Cards render at app-true width
           (~410px, same as the real library) and the staggered heights give the
           "asymmetric, no rigid grid" arrangement the copy promises. */
        .landing-piece-wide { margin-bottom: clamp(6rem, 16vw, 13rem); }
        .landing-piece-wide .landing-caption {
          text-align: center;
          max-width: 48ch;
          margin: 0 auto clamp(2.5rem, 5vw, 3.5rem);
        }
        .landing-piece-wide .landing-piece-body { margin-left: auto; margin-right: auto; }
        .landing-grid {
          columns: 2;
          column-gap: 1.5rem;
          max-width: 846px;
          margin: 0 auto;
        }
        @media (max-width: 700px) { .landing-grid { columns: 1; max-width: 420px; } }
        .landing-note-card-wrap { break-inside: avoid; margin-bottom: 1.5rem; display: block; }
        /* Vault */
        .landing-vault {
          position: relative; display: grid; place-items: center;
          aspect-ratio: 1 / 1; max-width: 360px; width: 100%; margin: 0 auto;
          border-radius: var(--radius-card);
          background: radial-gradient(circle at 50% 42%, var(--color-accent-glow), transparent 60%), var(--color-bg-secondary);
          border: 1px solid var(--glass-border);
        }
        .landing-vault svg { width: 38%; height: 38%; color: var(--color-accent); }
        .landing-vault-ring {
          position: absolute; inset: 14%; border-radius: 50%;
          border: 1px dashed color-mix(in srgb, var(--color-accent) 40%, transparent);
        }

        /* ─── Close ─── */
        .landing-close {
          text-align: center;
          padding: clamp(5rem, 14vw, 11rem) 1.4rem clamp(3rem, 8vw, 6rem);
        }
        .landing-close-title {
          font-family: var(--font-display); font-weight: 300;
          font-size: 3.4rem; line-height: 1.06;
          margin: 0 0 2.2rem; color: var(--color-text-primary);
        }
        .landing-close-title em { font-style: italic; color: var(--color-accent); font-weight: 400; }

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

        /* ─── Reveal ─── */
        .landing-reveal { opacity: 0; transform: translateY(26px); transition: opacity 0.9s ease, transform 0.9s cubic-bezier(0.22,1,0.36,1); }
        .landing-reveal.in { opacity: 1; transform: none; }

        .landing-car {
          display: inline-block; width: 2px; height: 1.05em; vertical-align: -0.16em;
          margin-left: 0.1em; border-radius: 1px; background: var(--color-accent);
          animation: landing-blink 2.6s ease-in-out infinite;
        }

        @keyframes landing-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        @keyframes landing-float { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, 6px); } }
        @keyframes landing-fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 768px) {
          .landing-hero { min-height: calc(100vh - 4.5rem); }
          .landing-hero { min-height: calc(100svh - 4.5rem); }
          .landing-scrollcue { display: none; }
          .landing-headline { font-size: 3.2rem; }
          .landing-sub { font-size: 1rem; }
          .landing-piece-title { font-size: 2.2rem; }
          .landing-close-title { font-size: 2.6rem; }
        }

        @media (max-width: 420px) {
          .landing-headline { font-size: 2.75rem; }
          .landing-piece-title { font-size: 2rem; }
          .landing-close-title { font-size: 2.3rem; }
        }

        @media (prefers-reduced-motion: reduce) {
          .landing-prose,
          .landing-hero-editor-wrap,
          .landing-scrollcue,
          .landing-seal,
          .landing-continue,
          .landing-car,
          .landing-reveal { animation: none !important; transition: none !important; }
          .landing-reveal { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
