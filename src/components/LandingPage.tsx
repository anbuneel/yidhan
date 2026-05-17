import type { MouseEvent } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { Logo } from './Logo';
import type { Theme } from '../types';

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
  const isDark = theme === 'dark';

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

  // Atmospheric gradient centered on manuscript area
  const gradientPct = isDark ? 9 : 6;
  const atmosphere = `radial-gradient(
    ellipse 60% 70% at 62% 48%,
    color-mix(in srgb, var(--color-accent) ${gradientPct}%, var(--color-bg-primary) ${100 - gradientPct}%) 0%,
    var(--color-bg-primary) 60%
  )`;

  return (
    <div className="landing-canvas" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Atmospheric radial gradient */}
      <div className="landing-atmosphere" style={{ background: atmosphere }} />

      {/* Single header bar */}
      <header className="landing-header">
        <Logo variant="header" className="shrink-0" />
        <div className="flex items-center gap-3">
          <button
            onClick={onThemeToggle}
            className="landing-theme-toggle focus-ring"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
          <button
            onClick={onSignIn}
            className="landing-signin-btn focus-ring"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Content wrapper — centers main + footer in remaining space */}
      <div className="landing-content-wrap">
      {/* Main composition — two-column desktop, single-column mobile */}
      <main className="landing-main">
        {/* Text column */}
        <div className="landing-text-column">
          <h1 className="landing-headline landing-entrance">
            A quiet space for your thoughts.
          </h1>

          {/* CTA cluster */}
          <div className="landing-cta-cluster landing-entrance landing-entrance-1">
            <button
              onClick={onStartWriting}
              className="landing-cta-button focus-ring"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Start Writing
            </button>

            <p className="landing-proof-line">
              Google, GitHub, or email. No credit card.
            </p>

            <p className="landing-encrypt-line">
              End-to-end encrypted from the start.
            </p>

            <a
              href="/demo"
              onClick={handleDemoClick}
              className="landing-demo-link"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Explore the Practice Space
              <span className="landing-demo-arrow" aria-hidden="true">→</span>
            </a>
          </div>

          {/* Proof rail — spec P0 #5: each claim links to verifiable proof */}
          <div className="landing-proof-rail landing-entrance landing-entrance-2">
            <a
              href="https://github.com/anbuneel/yidhan"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-proof-rail-link"
            >
              Open source
            </a>
            <span aria-hidden="true">·</span>
            <span>Offline-first</span>
            <span aria-hidden="true">·</span>
            <span>End-to-end encrypted</span>
          </div>
        </div>

        {/* Manuscript — matches real editor surface */}
        <div
          className="landing-manuscript landing-entrance-manuscript"
          style={{
            background: 'var(--color-bg-primary)',
            padding: '3.8rem 4.18rem',
            boxShadow: 'var(--shadow-manuscript)',
          }}
        >
          <div className="landing-manuscript-glow" />
          <div className="landing-manuscript-content">
            <p className="landing-text-reveal" style={{ marginBottom: '1.2em', animationDelay: '0.4s' }}>
              The light through the kitchen window this morning reminded me of
              something I&apos;d forgotten — how good it feels to write without
              worrying where the words will end up.
            </p>
            <p className="landing-text-reveal" style={{ marginBottom: '1.2em', animationDelay: '0.7s' }}>
              No folders to choose, no tags to assign. Just a quiet surface
              and the freedom to think out loud.
            </p>
            <p className="landing-text-reveal" style={{ marginBottom: 0, animationDelay: '1.0s' }}>
              I used to keep a notebook by the bed. This feels like that,
              but the pages never
            </p>
            <span className="landing-cursor" style={{ animationDelay: '1.3s, 1.7s' }}>▎</span>
          </div>
        </div>
      </main>

      {/* Footer nav */}
      <nav className="landing-footer landing-entrance landing-entrance-3">
        <button onClick={onChangelogClick} className="landing-nav-link focus-ring">
          Changelog
        </button>
        <span aria-hidden="true">·</span>
        <button onClick={onRoadmapClick} className="landing-nav-link focus-ring">
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
        <button onClick={onPrivacyClick} className="landing-nav-link focus-ring">
          Privacy
        </button>
        <span aria-hidden="true">·</span>
        <button onClick={onTermsClick} className="landing-nav-link focus-ring">
          Terms
        </button>
        <span aria-hidden="true">·</span>
        <button onClick={onSupportClick} className="landing-nav-link focus-ring">
          Support
        </button>
        {isInstallable && !isInstalled && (
          <>
            <span aria-hidden="true">·</span>
            <button
              onClick={triggerInstall}
              className="landing-nav-link focus-ring flex items-center gap-1.5"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
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
      </div>{/* end landing-content-wrap */}

      <style>{`
        /* ─── Canvas ─── */
        .landing-canvas {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .landing-atmosphere {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        /* ─── Content wrapper — centers main+footer below pinned header ─── */
        .landing-content-wrap {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
          z-index: 1;
        }

        /* ─── Header ─── */
        .landing-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 clamp(1rem, 4vw, 4rem);
          height: 64px;
          position: relative;
          z-index: 10;
        }

        /* ─── Main composition ─── */
        .landing-main {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 40% 1fr;
          gap: 5%;
          max-width: 1220px;
          margin: 0 auto;
          padding: 2rem 1vw;
          align-items: center;
          width: 100%;
        }

        /* ─── Text column ─── */
        .landing-text-column {
          display: flex;
          flex-direction: column;
        }

        .landing-headline {
          font-family: var(--font-display);
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
          font-weight: 300;
          line-height: 1.08;
          font-size: clamp(2rem, 3.4vw, 4.5rem);
          margin: 0 0 2.25rem;
          text-wrap: balance;
        }

        /* ─── CTA cluster ─── */
        .landing-cta-cluster {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .landing-cta-button {
          background: var(--color-cta-bg);
          color: var(--color-cta-text);
          padding: 0.9rem 2.5rem;
          border-radius: 8px;
          font-size: 1.05rem;
          font-weight: 500;
          border: none;
          cursor: pointer;
          width: fit-content;
          box-shadow: 0 4px 20px var(--color-accent-glow);
          transition: all 0.3s ease;
        }
        .landing-cta-button:hover {
          background: var(--color-cta-bg-hover);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px var(--color-accent-glow);
        }

        .landing-proof-line {
          font-family: var(--font-body);
          color: var(--color-text-tertiary);
          font-size: 0.8rem;
          margin: 0;
        }

        .landing-encrypt-line {
          font-family: var(--font-body);
          color: var(--color-accent);
          font-size: 0.8rem;
          margin: 0;
          opacity: 0.85;
          letter-spacing: 0.03em;
        }

        .landing-demo-link {
          font-size: 0.8rem;
          color: var(--color-text-tertiary);
          text-decoration: none;
          border-bottom: 1px dotted var(--color-text-tertiary);
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          transition: color 0.2s ease, border-bottom-color 0.2s ease;
        }
        .landing-demo-link:hover {
          color: var(--color-accent);
          border-bottom-color: var(--color-accent);
        }
        .landing-demo-arrow {
          display: inline-block;
          transition: transform 0.2s ease;
        }
        .landing-demo-link:hover .landing-demo-arrow {
          transform: translateX(4px);
        }

        /* ─── Proof rail ─── */
        .landing-proof-rail {
          display: flex;
          gap: 0.6rem;
          margin-top: 2.5rem;
          font-family: var(--font-body);
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--color-text-tertiary);
        }
        .landing-proof-rail-link {
          color: inherit;
          text-decoration: none;
        }
        .landing-proof-rail-link:hover {
          color: var(--color-accent);
        }

        /* ─── Manuscript ─── */
        .landing-manuscript {
          position: relative;
          border-radius: var(--radius-card);
          overflow: hidden;
          border: 1px solid rgba(0, 0, 0, 0.06);
        }
        [data-theme="dark"] .landing-manuscript {
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .landing-manuscript-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(
            ellipse 80% 50% at 50% 40%,
            rgba(194, 86, 52, 0.12) 0%,
            transparent 70%
          );
        }
        [data-theme="dark"] .landing-manuscript-glow {
          background: radial-gradient(
            ellipse 80% 50% at 50% 50%,
            rgba(212, 175, 55, 0.12) 0%,
            transparent 70%
          );
        }

        .landing-manuscript-content {
          position: relative;
          z-index: 1;
          font-family: var(--font-body);
          color: var(--color-text-primary);
          font-size: 1.2rem;
          font-weight: 400;
          line-height: 1.75;
        }

        /* ─── Horizontal text reveal (P2 #12) — clip-path, GPU-composited ─── */
        .landing-text-reveal {
          clip-path: inset(0 100% 0 0);
          animation: landing-text-reveal 0.8s ease-out forwards;
          will-change: clip-path;
        }
        @keyframes landing-text-reveal {
          from { clip-path: inset(0 100% 0 0); }
          to { clip-path: inset(0 0% 0 0); }
        }

        /* ─── Breathing cursor — appears after text reveal ─── */
        .landing-cursor {
          color: var(--color-accent);
          font-size: 1.1rem;
          opacity: 0;
          animation: landing-cursor-appear 0.4s ease-out forwards, landing-cursor-breathe 3s ease-in-out 1.7s infinite;
        }
        @keyframes landing-cursor-appear {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes landing-cursor-breathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* ─── Header buttons ─── */
        .landing-theme-toggle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-secondary);
          background: none;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .landing-theme-toggle:hover {
          color: var(--color-accent);
          background: var(--color-bg-secondary);
        }

        .landing-signin-btn {
          padding: 0.45rem 1.25rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--color-accent);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-accent-muted);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .landing-signin-btn:hover {
          color: var(--color-cta-text);
          background: var(--color-cta-bg);
          border-color: var(--color-cta-bg);
        }

        /* ─── Footer ─── */
        .landing-footer {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1.5rem clamp(1rem, 4vw, 4rem);
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: var(--color-text-tertiary);
          flex-wrap: wrap;
        }
        .landing-nav-link {
          color: inherit;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          font-size: inherit;
          padding: 0;
          transition: color 0.2s ease;
        }
        .landing-nav-link:hover {
          color: var(--color-accent);
        }

        /* ─── Entrance animations ─── */
        .landing-entrance {
          will-change: opacity, transform;
          animation: landing-fade-up 0.6s ease-out backwards;
        }
        .landing-entrance-1 { animation-delay: 0.08s; }
        .landing-entrance-2 { animation-delay: 0.16s; }
        .landing-entrance-3 { animation-delay: 0.24s; }
        /* Manuscript is heavier — slower entrance, larger travel */
        .landing-entrance-manuscript {
          animation: landing-fade-up-heavy 0.9s ease-out backwards;
          animation-delay: 0.15s;
        }

        @keyframes landing-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes landing-fade-up-heavy {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ─── Mobile: stack to single column ─── */
        @media (max-width: 768px) {
          .landing-main {
            grid-template-columns: 1fr;
            gap: 2rem;
            padding: 0 1.5rem;
            align-items: start;
          }

          .landing-text-column {
            padding: 1rem 0 0;
            text-align: center;
            align-items: center;
          }

          .landing-canvas .landing-headline {
            font-size: clamp(2rem, 8vw, 3rem);
            margin-bottom: 1.5rem;
          }

          .landing-cta-cluster {
            align-items: center;
          }

          .landing-proof-rail {
            justify-content: center;
            flex-wrap: wrap;
          }

          .landing-manuscript {
            margin-bottom: 1rem;
            padding: 2rem 1.5rem !important;
          }
        }

        /* ─── Reduced motion — stillness ─── */
        @media (prefers-reduced-motion: reduce) {
          .landing-entrance,
          .landing-entrance-manuscript { animation: none; }
          .landing-text-reveal { animation: none; clip-path: none; }
          .landing-cursor { animation: none; opacity: 1; }
          .landing-cta-button { transition: none; }
          .landing-cta-button:hover { transform: none; }
        }
      `}</style>
    </div>
  );
}
