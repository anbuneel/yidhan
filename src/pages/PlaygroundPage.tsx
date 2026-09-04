import { useState, useEffect, useRef } from 'react';
import { Logo } from '../components/Logo';
import type { Theme } from '../types';

interface PlaygroundPageProps {
  theme: Theme;
  onThemeToggle: () => void;
}

type Phase = 'landing' | 'transitioning' | 'editor';

/**
 * Landing page synthesis prototype — "The Page becomes the Manuscript."
 *
 * Single editorial column. Marketing copy IS the prose the visitor reads.
 * On "Begin writing", the reading surface becomes the writing surface in
 * place — the prose stays as the visitor's first note, the cursor never
 * moves, the editor chrome arrives around what was already there.
 *
 * Dev-only at /playground. Replace LandingPage.tsx once approved.
 */
export function PlaygroundPage({ theme, onThemeToggle }: PlaygroundPageProps) {
  const [phase, setPhase] = useState<Phase>('landing');
  const editableRef = useRef<HTMLDivElement>(null);

  const handleBegin = () => {
    setPhase('transitioning');
    window.setTimeout(() => setPhase('editor'), 720);
  };

  const handleReset = () => setPhase('landing');

  useEffect(() => {
    if (phase === 'editor' && editableRef.current) {
      const el = editableRef.current;
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
      el.focus();
    }
  }, [phase]);

  const isDark = theme === 'dark';
  const editorArrived = phase === 'editor';
  const fadingChrome = phase !== 'landing';

  return (
    <div className="page-canvas">
      <div className="page-wash" aria-hidden="true" />
      <svg className="page-noise" aria-hidden="true" width="100%" height="100%">
        <filter id="page-noise-f">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#page-noise-f)" opacity={isDark ? 0.06 : 0.045} />
      </svg>

      <header className="page-header">
        <Logo />
        <div className="page-header-actions">
          <button
            type="button"
            onClick={onThemeToggle}
            className="page-icon-btn focus-ring"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
          <button type="button" className="page-textlink focus-ring">Sign in</button>
        </div>
      </header>

      <main className={`page-main ${editorArrived ? 'is-editor' : ''}`}>
        <div className="page-column">
          {/* Editor title field — fills in as editor chrome arrives */}
          <div className={`page-editor-title-slot ${editorArrived ? 'arrived' : ''}`}>
            <input
              type="text"
              aria-label="Note title preview"
              className="page-editor-title-input"
              placeholder="Untitled"
              tabIndex={editorArrived ? 0 : -1}
              disabled={!editorArrived}
            />
          </div>

          <h1 className={`page-title ${fadingChrome ? 'is-fading' : ''}`} aria-hidden={editorArrived}>
            A quiet space<br />for your thoughts.
          </h1>

          <div
            ref={editableRef}
            className={`page-prose ${editorArrived ? 'is-editor' : ''}`}
            contentEditable={editorArrived}
            suppressContentEditableWarning
            spellCheck={editorArrived}
          >
            <p>
              Yidhan is for the half-formed sentence that becomes a paragraph at midnight. No folders. No tags. No app to learn. Just a soft surface and room to think.
            </p>
            <p>
              Everything you write is yours alone: encrypted before it leaves your hands, kept on every device.
            </p>
            <p className="page-prose-trailing">
              It begins the moment you <span className="page-cursor" aria-hidden="true">▎</span>
            </p>
          </div>

          <div className={`page-actions ${fadingChrome ? 'is-fading' : ''}`} aria-hidden={editorArrived}>
            <button
              type="button"
              onClick={handleBegin}
              className="page-chip focus-ring"
              disabled={phase !== 'landing'}
            >
              Begin writing
            </button>
            <span className="page-actions-sep" aria-hidden="true">·</span>
            <a href="/demo" className="page-quietlink">
              or visit the practice space
            </a>
          </div>

          <p
            className={`page-trust ${fadingChrome ? 'is-fading' : ''}`}
            aria-hidden={editorArrived}
          >
            <em>open source · works offline · end-to-end encrypted</em>
          </p>
        </div>
      </main>

      <footer className={`page-footer ${fadingChrome ? 'is-dim' : ''}`}>
        <span className="page-edition">No. I · Spring 2026</span>
        <nav className="page-footer-nav">
          <button type="button" className="page-quietlink-sm">Changelog</button>
          <span aria-hidden="true">·</span>
          <button type="button" className="page-quietlink-sm">Roadmap</button>
          <span aria-hidden="true">·</span>
          <a href="https://github.com/anbuneel/yidhan" className="page-quietlink-sm" target="_blank" rel="noopener noreferrer">GitHub</a>
          <span aria-hidden="true">·</span>
          <button type="button" className="page-quietlink-sm">Privacy</button>
        </nav>
      </footer>

      {phase !== 'landing' && (
        <button type="button" onClick={handleReset} className="page-reset-btn focus-ring">
          ↺ replay
        </button>
      )}

      <style>{`
        /* ─── Canvas ─── */
        .page-canvas {
          min-height: 100vh;
          background: var(--color-bg-primary);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          color: var(--color-text-primary);
        }

        /* Warm wash from upper-center — sunlight on a page */
        .page-wash {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(
              ellipse 70% 50% at 50% 22%,
              color-mix(in srgb, var(--color-accent) ${isDark ? 7 : 5}%, transparent) 0%,
              transparent 65%
            );
        }

        /* Paper noise — subtle craft texture */
        .page-noise {
          position: absolute;
          inset: 0;
          pointer-events: none;
          mix-blend-mode: ${isDark ? 'soft-light' : 'multiply'};
          opacity: 0.7;
        }

        /* ─── Header ─── */
        .page-header {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem clamp(1.25rem, 3vw, 2.5rem);
          flex-shrink: 0;
        }

        .page-header-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .page-icon-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-secondary);
          background: none;
          border: none;
          cursor: pointer;
          transition: color 200ms ease, background-color 200ms ease;
        }
        .page-icon-btn:hover {
          color: var(--color-accent);
          background: color-mix(in srgb, var(--color-accent) 6%, transparent);
        }

        .page-textlink {
          background: none;
          border: none;
          color: var(--color-text-secondary);
          font-family: var(--font-body);
          font-size: 0.95rem;
          font-weight: 400;
          padding: 0.4rem 0.7rem;
          cursor: pointer;
          transition: color 200ms ease;
        }
        .page-textlink:hover {
          color: var(--color-accent);
        }

        /* ─── Main composition ─── */
        .page-main {
          flex: 1;
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(1rem, 4vh, 3rem) 1.5rem;
        }

        .page-column {
          width: 100%;
          max-width: 640px;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        /* Title — Cormorant, the unambiguous hero */
        .page-title {
          font-family: var(--font-display);
          font-weight: 300;
          color: var(--color-text-primary);
          letter-spacing: -0.025em;
          line-height: 1.04;
          font-size: clamp(2.6rem, 6.2vw, 5.25rem);
          margin: 0 0 2.25rem;
          text-wrap: balance;
          transition: opacity 480ms ease-out, transform 480ms ease-out;
        }
        .page-title.is-fading {
          opacity: 0;
          transform: translateY(-6px);
          pointer-events: none;
        }

        /* Prose — exact editor parity (Source Sans 3, 1.2rem, 1.75 line-height) */
        .page-prose {
          font-family: var(--font-body);
          font-size: 1.2rem;
          font-weight: 400;
          line-height: 1.75;
          color: var(--color-text-primary);
          caret-color: var(--color-accent);
          outline: none;
        }
        .page-prose > * + * {
          margin-top: 1.1em;
        }
        .page-prose p {
          margin: 0;
        }

        .page-prose-trailing {
          /* Keeps the cursor flowing inline with the prose */
          display: block;
        }

        /* When entering editor mode, prose becomes the editing surface */
        .page-prose.is-editor {
          min-height: 50vh;
        }
        .page-prose.is-editor .page-cursor {
          display: none; /* native caret takes over */
        }

        /* Breathing cursor — terracotta, ~2.5s cycle */
        .page-cursor {
          display: inline-block;
          color: var(--color-accent);
          font-weight: 400;
          margin-left: 0.05em;
          animation: page-cursor-breathe 2.5s ease-in-out infinite;
          transform: translateY(0.05em);
        }
        @keyframes page-cursor-breathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }

        /* ─── Actions — chip + quiet link ─── */
        .page-actions {
          margin-top: 2.5rem;
          display: flex;
          align-items: center;
          gap: 0.85rem;
          flex-wrap: wrap;
          transition: opacity 380ms ease-out, transform 380ms ease-out;
        }
        .page-actions.is-fading {
          opacity: 0;
          transform: translateY(-4px);
          pointer-events: none;
        }

        .page-chip {
          font-family: var(--font-body);
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--color-accent);
          background: color-mix(in srgb, var(--color-accent) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--color-accent) 28%, transparent);
          border-radius: var(--radius-card);
          padding: 0.7rem 1.5rem;
          cursor: pointer;
          letter-spacing: 0.005em;
          transition:
            background 280ms ease,
            color 280ms ease,
            border-color 280ms ease,
            transform 120ms ease;
        }
        .page-chip:hover:not(:disabled) {
          background: var(--color-cta-bg);
          color: var(--color-cta-text);
          border-color: var(--color-cta-bg);
        }
        .page-chip:active:not(:disabled) {
          transform: scale(0.97);
        }
        .page-chip:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .page-actions-sep {
          color: var(--color-text-tertiary);
          font-size: 0.9rem;
        }

        .page-quietlink {
          font-family: var(--font-body);
          font-size: 0.92rem;
          color: var(--color-text-tertiary);
          text-decoration: none;
          border-bottom: 1px dotted color-mix(in srgb, var(--color-text-tertiary) 70%, transparent);
          padding-bottom: 1px;
          transition: color 200ms ease, border-color 200ms ease;
        }
        .page-quietlink:hover {
          color: var(--color-accent);
          border-bottom-color: var(--color-accent);
        }

        /* ─── Trust line — quiet italic, single bar of marginalia ─── */
        .page-trust {
          margin: 1.6rem 0 0;
          font-family: var(--font-body);
          font-size: 0.85rem;
          color: var(--color-text-tertiary);
          letter-spacing: 0.015em;
          transition: opacity 360ms ease-out;
        }
        .page-trust em {
          font-style: italic;
        }
        .page-trust.is-fading {
          opacity: 0;
        }

        /* ─── Editor title slot — arrives above the prose during transition ─── */
        .page-editor-title-slot {
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          transition: max-height 520ms ease-out, opacity 320ms ease-out 120ms;
        }
        .page-editor-title-slot.arrived {
          max-height: 5rem;
          opacity: 1;
          margin-bottom: 1.25rem;
        }
        .page-editor-title-input {
          font-family: var(--font-display);
          font-weight: 300;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
          line-height: 1.1;
          font-size: clamp(2rem, 4vw, 3rem);
          background: transparent;
          border: none;
          outline: none;
          width: 100%;
          padding: 0;
          caret-color: var(--color-accent);
        }
        .page-editor-title-input::placeholder {
          color: var(--color-text-tertiary);
          font-style: italic;
          opacity: 0.7;
        }

        /* ─── Footer — old-book running foot ─── */
        .page-footer {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 1rem;
          padding: 1.25rem clamp(1.25rem, 3vw, 2.5rem) 1.5rem;
          font-family: var(--font-body);
          font-size: 0.78rem;
          color: var(--color-text-tertiary);
          flex-shrink: 0;
          flex-wrap: wrap;
          transition: opacity 360ms ease-out;
        }
        .page-footer.is-dim {
          opacity: 0.35;
        }
        .page-edition {
          font-style: italic;
          letter-spacing: 0.05em;
        }
        .page-footer-nav {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .page-quietlink-sm {
          background: none;
          border: none;
          color: inherit;
          font: inherit;
          padding: 0;
          cursor: pointer;
          text-decoration: none;
          transition: color 200ms ease;
        }
        .page-quietlink-sm:hover {
          color: var(--color-accent);
        }

        /* ─── Dev: replay button ─── */
        .page-reset-btn {
          position: fixed;
          right: 1rem;
          bottom: 1rem;
          z-index: 50;
          background: var(--color-bg-secondary);
          border: 1px solid color-mix(in srgb, var(--color-text-tertiary) 25%, transparent);
          color: var(--color-text-secondary);
          font-family: var(--font-body);
          font-size: 0.78rem;
          padding: 0.35rem 0.75rem;
          border-radius: 999px;
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 200ms ease;
        }
        .page-reset-btn:hover {
          opacity: 1;
        }

        /* ─── Entrance — soft fade-up for the title and prose ─── */
        .page-title,
        .page-prose,
        .page-actions,
        .page-trust {
          animation: page-fade-up 720ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
        }
        .page-title { animation-delay: 80ms; }
        .page-prose { animation-delay: 220ms; }
        .page-actions { animation-delay: 380ms; }
        .page-trust { animation-delay: 480ms; }
        @keyframes page-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ─── Mobile ─── */
        @media (max-width: 640px) {
          .page-main {
            align-items: flex-start;
            padding-top: 2rem;
          }
          .page-title {
            font-size: clamp(2rem, 9vw, 2.6rem);
            margin-bottom: 1.5rem;
          }
          .page-prose {
            font-size: 1.05rem;
            line-height: 1.7;
          }
          .page-actions {
            margin-top: 2rem;
          }
          .page-chip {
            width: 100%;
            text-align: center;
          }
          .page-actions-sep { display: none; }
          .page-footer {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
        }

        /* ─── Reduced motion — stillness ─── */
        @media (prefers-reduced-motion: reduce) {
          .page-title,
          .page-prose,
          .page-actions,
          .page-trust {
            animation: none;
          }
          .page-cursor { animation: none; opacity: 1; }
          .page-title,
          .page-actions,
          .page-trust,
          .page-footer,
          .page-editor-title-slot {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
