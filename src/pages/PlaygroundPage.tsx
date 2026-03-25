import { useState } from 'react';
import { Logo } from '../components/Logo';
import type { Theme } from '../types';

interface PlaygroundPageProps {
  theme: Theme;
  onThemeToggle: () => void;
}

/**
 * Playground for iterating on the landing page redesign composition.
 * Throwaway component — delete after porting to LandingPage.tsx.
 *
 * Includes a floating control panel with sliders to adjust layout
 * values in real time. Find the right proportions, then tell Claude
 * the values to lock into the code.
 */
export function PlaygroundPage({ theme, onThemeToggle }: PlaygroundPageProps) {
  // Tunable layout values — all use viewport-relative units for responsiveness
  const [textWidth, setTextWidth] = useState(38);       // % of grid
  const [gap, setGap] = useState(2.5);                  // vw
  const [sidePadding, setSidePadding] = useState(3);    // vw
  const [headlineSize, setHeadlineSize] = useState(3.5);// vw (fluid)
  const [manuscriptPadding, setManuscriptPadding] = useState(2.5); // vw
  const [gradientIntensity, setGradientIntensity] = useState(6);
  const [shadowIntensity, setShadowIntensity] = useState(1.5);
  const [maxWidth, setMaxWidth] = useState(0);          // 0 = no limit
  const [canvasHeight, setCanvasHeight] = useState(100);// vh
  const [verticalPosition, setVerticalPosition] = useState(20); // lower = higher on page
  const [panelOpen, setPanelOpen] = useState(true);

  // Computed styles — responsive units
  const gridColumns = `${textWidth}% 1fr`;
  const compositionGap = `${gap}vw`;
  const compositionPadding = `0 ${sidePadding}vw 2rem ${sidePadding}vw`;
  const headlineFontSize = `clamp(2rem, ${headlineSize}vw, 5rem)`;
  const msPadding = `${manuscriptPadding}vw ${manuscriptPadding * 1.2}vw`;

  const lightGradient = `radial-gradient(
    ellipse 60% 70% at 62% 48%,
    color-mix(in srgb, var(--color-accent) ${gradientIntensity}%, var(--color-bg-primary) ${100 - gradientIntensity}%) 0%,
    var(--color-bg-primary) 60%
  )`;
  const darkGradient = `radial-gradient(
    ellipse 60% 70% at 62% 48%,
    color-mix(in srgb, var(--color-accent) ${gradientIntensity + 3}%, var(--color-bg-primary) ${97 - gradientIntensity}%) 0%,
    var(--color-bg-primary) 60%
  )`;

  const lightShadow = `
    0 1px 2px rgba(120, 80, 60, ${0.08 * shadowIntensity}),
    0 4px 12px rgba(120, 80, 60, ${0.06 * shadowIntensity}),
    0 16px 32px rgba(120, 80, 60, ${0.04 * shadowIntensity}),
    0 32px 64px rgba(120, 80, 60, ${0.03 * shadowIntensity})
  `;
  const darkShadow = `
    0 1px 2px rgba(0, 0, 0, ${0.4 * shadowIntensity}),
    0 4px 12px rgba(0, 0, 0, ${0.3 * shadowIntensity}),
    0 16px 32px rgba(0, 0, 0, ${0.25 * shadowIntensity}),
    0 32px 64px rgba(0, 0, 0, ${0.2 * shadowIntensity})
  `;

  return (
    <div
      className="playground-canvas"
      style={{
        minHeight: `${canvasHeight}vh`,
        background: 'var(--color-bg-primary)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Atmospheric radial gradient */}
      <div
        className="playground-atmosphere"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: theme === 'dark' ? darkGradient : lightGradient,
        }}
      />

      {/* Single header bar */}
      <header
        className="flex items-center justify-between px-6 md:px-10 lg:px-16 shrink-0"
        style={{ height: '64px', position: 'relative', zIndex: 10 }}
      >
        <Logo variant="header" className="shrink-0" />
        <div className="flex items-center gap-3">
          <button
            onClick={onThemeToggle}
            className="playground-theme-toggle focus-ring w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300"
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
            className="playground-signin-btn focus-ring px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Main composition */}
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          display: 'grid',
          gridTemplateColumns: gridColumns,
          gap: compositionGap,
          maxWidth: maxWidth === 0 ? 'none' : `${maxWidth}px`,
          margin: '0 auto',
          padding: compositionPadding,
          alignItems: 'center',
          alignContent: 'start',
          paddingTop: `${verticalPosition / 10}vh`,
          width: '100%',
        }}
      >
        {/* Text column */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
              fontWeight: 300,
              lineHeight: 1.08,
              fontSize: headlineFontSize,
              margin: `0 0 1.75rem`,
            }}
          >
            A quiet space<br />for your thoughts.
          </h1>

          {/* CTA cluster */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              className="playground-cta-button focus-ring"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Start Writing
            </button>

            <p
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-tertiary)',
                fontSize: '0.8rem',
                margin: 0,
              }}
            >
              Google, GitHub, or email. No credit card.
            </p>

            <p
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-accent)',
                fontSize: '0.8rem',
                margin: 0,
                opacity: 0.85,
                letterSpacing: '0.03em',
              }}
            >
              End-to-end encrypted from the start.
            </p>

            <a
              href="/demo"
              className="playground-demo-link"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Explore the Practice Space
              <span className="playground-demo-arrow" aria-hidden="true">→</span>
            </a>
          </div>

          {/* Proof rail */}
          <div
            style={{
              display: 'flex',
              gap: '0.6rem',
              marginTop: '2.5rem',
              fontFamily: 'var(--font-body)',
              fontSize: '0.65rem',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.12em',
              color: 'var(--color-text-tertiary)',
            }}
          >
            <span>Open source</span>
            <span aria-hidden="true">·</span>
            <span>Offline-first</span>
            <span aria-hidden="true">·</span>
            <span>End-to-end encrypted</span>
          </div>
        </div>

        {/* Manuscript */}
        <div
          style={{
            position: 'relative',
            background: theme === 'dark'
              ? 'color-mix(in srgb, var(--color-bg-primary) 75%, var(--color-bg-secondary) 25%)'
              : 'color-mix(in srgb, var(--color-bg-primary) 92%, white 8%)',
            borderRadius: '2px 24px 4px 24px',
            padding: msPadding,
            overflow: 'hidden',
            boxShadow: theme === 'dark' ? darkShadow : lightShadow,
          }}
        >
          {/* Manuscript glow */}
          <div className="playground-manuscript-glow" />

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-primary)',
              fontSize: '1.125rem',
              lineHeight: 1.8,
            }}
          >
            <p style={{ marginBottom: '1.2em' }}>
              The light through the kitchen window this morning reminded me of
              something I&apos;d forgotten — how good it feels to write without
              worrying where the words will end up.
            </p>
            <p style={{ marginBottom: '1.2em' }}>
              No folders to choose, no tags to assign. Just a quiet surface
              and the freedom to think out loud.
            </p>
            <p style={{ marginBottom: 0 }}>
              I used to keep a notebook by the bed. This feels like that,
              but the pages never
            </p>
            <span className="playground-cursor">▎</span>
          </div>
        </div>
      </main>

      {/* ─── Control Panel ─── */}
      <div
        style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          zIndex: 100,
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Toggle button */}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--color-cta-bg)',
            color: 'var(--color-cta-text)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.1rem',
            display: panelOpen ? 'none' : 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
          title="Open controls"
        >
          ⚙
        </button>

        {panelOpen && (
          <div
            style={{
              background: theme === 'dark' ? 'rgba(10,18,11,0.95)' : 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(12px)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              border: '1px solid var(--glass-border)',
              width: '280px',
              fontSize: '0.75rem',
              color: 'var(--color-text-primary)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <strong style={{ fontSize: '0.8rem' }}>Layout Controls</strong>
              <button
                onClick={() => setPanelOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontSize: '1rem' }}
              >
                ×
              </button>
            </div>

            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Text width: {textWidth}%</span>
              <input type="range" min={25} max={50} value={textWidth} onChange={e => setTextWidth(+e.target.value)} style={{ width: '120px' }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Gap: {gap}vw</span>
              <input type="range" min={0.5} max={8} step={0.5} value={gap} onChange={e => setGap(+e.target.value)} style={{ width: '120px' }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Side pad: {sidePadding}vw</span>
              <input type="range" min={1} max={10} step={0.5} value={sidePadding} onChange={e => setSidePadding(+e.target.value)} style={{ width: '120px' }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Headline: {headlineSize}vw</span>
              <input type="range" min={2} max={6} step={0.25} value={headlineSize} onChange={e => setHeadlineSize(+e.target.value)} style={{ width: '120px' }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>MS pad: {manuscriptPadding}vw</span>
              <input type="range" min={1} max={5} step={0.25} value={manuscriptPadding} onChange={e => setManuscriptPadding(+e.target.value)} style={{ width: '120px' }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Gradient: {gradientIntensity}%</span>
              <input type="range" min={0} max={20} value={gradientIntensity} onChange={e => setGradientIntensity(+e.target.value)} style={{ width: '120px' }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Shadow: {shadowIntensity.toFixed(1)}×</span>
              <input type="range" min={0} max={3} step={0.1} value={shadowIntensity} onChange={e => setShadowIntensity(+e.target.value)} style={{ width: '120px' }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Max width: {maxWidth === 0 ? 'none' : `${maxWidth}px`}</span>
              <input type="range" min={0} max={2000} step={40} value={maxWidth} onChange={e => setMaxWidth(+e.target.value)} style={{ width: '120px' }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Canvas H: {canvasHeight}vh</span>
              <input type="range" min={50} max={100} value={canvasHeight} onChange={e => setCanvasHeight(+e.target.value)} style={{ width: '120px' }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span>V-position: {verticalPosition}%</span>
              <input type="range" min={0} max={100} value={verticalPosition} onChange={e => setVerticalPosition(+e.target.value)} style={{ width: '120px' }} />
            </label>

            {/* Current values summary — copy these back to Claude */}
            <div
              style={{
                background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.65rem',
                fontFamily: 'monospace',
                lineHeight: 1.6,
                color: 'var(--color-text-secondary)',
              }}
            >
              textWidth: {textWidth}%<br />
              gap: {gap}rem<br />
              sidePadding: {sidePadding}rem<br />
              headline: {headlineSize}rem<br />
              msPadding: {manuscriptPadding}rem<br />
              gradient: {gradientIntensity}%<br />
              shadow: {shadowIntensity.toFixed(1)}×<br />
              maxWidth: {maxWidth === 0 ? 'none' : `${maxWidth}px`}<br />
              canvasH: {canvasHeight}vh<br />
              vPosition: {verticalPosition}%
            </div>
          </div>
        )}
      </div>

      <style>{`
        /* CTA button */
        .playground-cta-button {
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
          margin-bottom: 0.25rem;
        }
        .playground-cta-button:hover {
          background: var(--color-cta-bg-hover);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px var(--color-accent-glow);
        }

        /* Demo link */
        .playground-demo-link {
          font-size: 0.8rem;
          color: var(--color-text-tertiary);
          text-decoration: none;
          border-bottom: 1px dotted var(--color-text-tertiary);
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          transition: all 0.2s ease;
          margin-top: 0.15rem;
        }
        .playground-demo-link:hover {
          color: var(--color-accent);
          border-bottom-color: var(--color-accent);
        }
        .playground-demo-arrow {
          display: inline-block;
          transition: transform 0.2s ease;
        }
        .playground-demo-link:hover .playground-demo-arrow {
          transform: translateX(4px);
        }

        /* Manuscript glow */
        .playground-manuscript-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(
            ellipse 80% 50% at 50% 40%,
            rgba(194, 86, 52, 0.10) 0%,
            transparent 70%
          );
        }
        [data-theme="dark"] .playground-manuscript-glow {
          background: radial-gradient(
            ellipse 80% 50% at 50% 40%,
            rgba(212, 175, 55, 0.10) 0%,
            transparent 70%
          );
        }

        /* Breathing cursor */
        .playground-cursor {
          color: var(--color-accent);
          font-size: 1.1rem;
          animation: playground-cursor-breathe 3s ease-in-out infinite;
        }
        @keyframes playground-cursor-breathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* Theme toggle */
        .playground-theme-toggle {
          color: var(--color-text-secondary);
        }
        .playground-theme-toggle:hover {
          color: var(--color-accent);
          background: var(--color-bg-secondary);
        }

        /* Sign In button */
        .playground-signin-btn {
          color: var(--color-accent);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-accent-muted);
        }
        .playground-signin-btn:hover {
          color: var(--color-cta-text);
          background: var(--color-cta-bg);
          border-color: var(--color-cta-bg);
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .playground-cursor { animation: none; opacity: 1; }
          .playground-cta-button { transition: none; }
          .playground-cta-button:hover { transform: none; }
        }
      `}</style>
    </div>
  );
}
