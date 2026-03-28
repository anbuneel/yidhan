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
 * Includes a floating control panel (collapsed by default) with sliders
 * to adjust layout values in real time.
 */
export function PlaygroundPage({ theme, onThemeToggle }: PlaygroundPageProps) {
  // Tunable layout values
  const [textWidth, setTextWidth] = useState(40);
  const [gap, setGap] = useState(5);
  const [sidePadding, setSidePadding] = useState(1);
  const [headlineSize, setHeadlineSize] = useState(3.4);
  const [manuscriptPadding, setManuscriptPadding] = useState(3.8);
  const [gradientIntensity, setGradientIntensity] = useState(6);
  const [shadowIntensity, setShadowIntensity] = useState(1.5);
  const [maxWidth, setMaxWidth] = useState(1220);
  const [panelOpen, setPanelOpen] = useState(false); // collapsed by default

  const isDark = theme === 'dark';

  // Computed styles
  const headlineFontSize = `clamp(2rem, ${headlineSize}vw, 4.5rem)`;
  const msPadding = `${manuscriptPadding}rem ${manuscriptPadding * 1.1}rem`;

  // Atmospheric gradient — subtle warmth radiating from manuscript area
  const gradient = `radial-gradient(
    ellipse 60% 70% at 62% 48%,
    color-mix(in srgb, var(--color-accent) ${gradientIntensity + (isDark ? 3 : 0)}%, var(--color-bg-primary) ${100 - gradientIntensity - (isDark ? 3 : 0)}%) 0%,
    var(--color-bg-primary) 60%
  )`;

  // 4-layer shadow for manuscript depth
  const shadow = isDark
    ? `0 1px 2px rgba(0, 0, 0, ${0.4 * shadowIntensity}),
       0 4px 12px rgba(0, 0, 0, ${0.3 * shadowIntensity}),
       0 16px 32px rgba(0, 0, 0, ${0.25 * shadowIntensity}),
       0 32px 64px rgba(0, 0, 0, ${0.2 * shadowIntensity})`
    : `0 1px 2px rgba(120, 80, 60, ${0.08 * shadowIntensity}),
       0 4px 12px rgba(120, 80, 60, ${0.06 * shadowIntensity}),
       0 16px 32px rgba(120, 80, 60, ${0.05 * shadowIntensity}),
       0 32px 64px rgba(120, 80, 60, ${0.04 * shadowIntensity})`;

  // Manuscript surface — matches real editor in both themes (bg-primary)
  const manuscriptBg = 'var(--color-bg-primary)';

  return (
    <div
      className="playground-canvas"
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg-primary)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Atmospheric radial gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: gradient,
        }}
      />

      {/* Single header bar */}
      <header
        className="playground-header"
        style={{ position: 'relative', zIndex: 10 }}
      >
        <Logo variant="header" className="shrink-0" />
        <div className="flex items-center gap-3">
          <button
            onClick={onThemeToggle}
            className="playground-theme-toggle focus-ring"
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
            className="playground-signin-btn focus-ring"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Main composition — two-column desktop, single-column mobile */}
      <main
        className="playground-main"
        style={{
          '--pg-text-width': `${textWidth}%`,
          '--pg-gap': `${gap}%`,
          '--pg-side-padding': `${sidePadding}vw`,
          '--pg-max-width': `${maxWidth}px`,
        } as React.CSSProperties}
      >
        {/* Text column */}
        <div className="playground-text-column">
          <h1
            className="playground-headline"
            style={{ fontSize: headlineFontSize }}
          >
            A quiet space<br />for your thoughts.
          </h1>

          {/* CTA cluster */}
          <div className="playground-cta-cluster">
            <button
              className="playground-cta-button focus-ring"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Start Writing
            </button>

            <p className="playground-proof-line">
              Google, GitHub, or email. No credit card.
            </p>

            <p className="playground-encrypt-line">
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
          <div className="playground-proof-rail">
            <span>Open source</span>
            <span aria-hidden="true">·</span>
            <span>Offline-first</span>
            <span aria-hidden="true">·</span>
            <span>End-to-end encrypted</span>
          </div>
        </div>

        {/* Manuscript */}
        <div
          className="playground-manuscript"
          style={{
            background: manuscriptBg,
            padding: msPadding,
            boxShadow: shadow,
          }}
        >
          {/* Manuscript glow */}
          <div className="playground-manuscript-glow" />

          <div className="playground-manuscript-content">
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

      {/* ─── Control Panel (collapsed by default) ─── */}
      <div className="playground-controls-container">
        {/* Toggle button — visible when panel is closed */}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="playground-controls-toggle"
          style={{ display: panelOpen ? 'none' : 'flex' }}
          title="Open layout controls"
        >
          ⚙
        </button>

        {panelOpen && (
          <div
            className="playground-controls-panel"
            style={{
              background: isDark ? 'rgba(10,18,11,0.95)' : 'rgba(255,255,255,0.95)',
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

            {[
              { label: 'Text width', value: textWidth, unit: '%', min: 30, max: 55, step: 1, set: setTextWidth },
              { label: 'Gap', value: gap, unit: '%', min: 1, max: 8, step: 0.5, set: setGap },
              { label: 'Side pad', value: sidePadding, unit: 'vw', min: 1, max: 10, step: 0.5, set: setSidePadding },
              { label: 'Headline', value: headlineSize, unit: 'vw', min: 2, max: 5, step: 0.1, set: setHeadlineSize },
              { label: 'MS pad', value: manuscriptPadding, unit: 'rem', min: 1, max: 5, step: 0.1, set: setManuscriptPadding },
              { label: 'Gradient', value: gradientIntensity, unit: '%', min: 0, max: 20, step: 1, set: setGradientIntensity },
              { label: 'Shadow', value: shadowIntensity, unit: '×', min: 0, max: 3, step: 0.1, set: setShadowIntensity },
              { label: 'Max width', value: maxWidth, unit: 'px', min: 800, max: 1600, step: 20, set: setMaxWidth },
            ].map(({ label, value, unit, min, max, step, set }) => (
              <label key={label} className="playground-control-row">
                <span>{label}: {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value}{unit}</span>
                <input type="range" min={min} max={max} step={step} value={value} onChange={e => set(+e.target.value)} />
              </label>
            ))}

            {/* Current values summary */}
            <div className="playground-values-summary">
              textWidth: {textWidth}%<br />
              gap: {gap}%<br />
              sidePadding: {sidePadding}vw<br />
              headline: {headlineSize}vw<br />
              msPadding: {manuscriptPadding}rem<br />
              gradient: {gradientIntensity}%<br />
              shadow: {shadowIntensity.toFixed(1)}×<br />
              maxWidth: {maxWidth}px
            </div>
          </div>
        )}
      </div>

      <style>{`
        /* ─── Header ─── */
        .playground-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 clamp(1rem, 4vw, 4rem);
          height: 64px;
        }

        /* ─── Main composition ─── */
        .playground-main {
          position: relative;
          z-index: 1;
          flex: 1;
          display: grid;
          grid-template-columns: var(--pg-text-width) 1fr;
          gap: var(--pg-gap);
          max-width: var(--pg-max-width);
          margin: 0 auto;
          padding: 0 var(--pg-side-padding);
          align-items: center;
          align-content: center;
          width: 100%;
        }

        /* ─── Text column ─── */
        .playground-text-column {
          display: flex;
          flex-direction: column;
        }

        .playground-headline {
          font-family: var(--font-display);
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
          font-weight: 300;
          line-height: 1.08;
          margin: 0 0 2.25rem;
        }

        /* ─── CTA cluster ─── */
        .playground-cta-cluster {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

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
        }
        .playground-cta-button:hover {
          background: var(--color-cta-bg-hover);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px var(--color-accent-glow);
        }

        .playground-proof-line {
          font-family: var(--font-body);
          color: var(--color-text-tertiary);
          font-size: 0.8rem;
          margin: 0;
        }

        .playground-encrypt-line {
          font-family: var(--font-body);
          color: var(--color-accent);
          font-size: 0.8rem;
          margin: 0;
          opacity: 0.85;
          letter-spacing: 0.03em;
        }

        .playground-demo-link {
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: var(--color-text-tertiary);
          text-decoration: none;
          border-bottom: 1px dotted var(--color-text-tertiary);
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          transition: all 0.2s ease;
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

        /* ─── Proof rail ─── */
        .playground-proof-rail {
          display: flex;
          gap: 0.6rem;
          margin-top: 2.5rem;
          font-family: var(--font-body);
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--color-text-tertiary);
        }

        /* ─── Manuscript ─── */
        .playground-manuscript {
          position: relative;
          border-radius: 2px 24px 4px 24px;
          overflow: hidden;
        }
        .playground-manuscript {
          border: 1px solid rgba(0, 0, 0, 0.06);
        }
        [data-theme="dark"] .playground-manuscript {
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .playground-manuscript-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(
            ellipse 80% 50% at 50% 40%,
            rgba(194, 86, 52, 0.12) 0%,
            transparent 70%
          );
        }
        [data-theme="dark"] .playground-manuscript-glow {
          background: radial-gradient(
            ellipse 80% 50% at 50% 50%,
            rgba(212, 175, 55, 0.12) 0%,
            transparent 70%
          );
        }

        .playground-manuscript-content {
          position: relative;
          z-index: 1;
          font-family: var(--font-body);
          color: var(--color-text-primary);
          font-size: 1.2rem;
          font-weight: 400;
          line-height: 1.75;
        }

        /* ─── Breathing cursor ─── */
        .playground-cursor {
          color: var(--color-accent);
          font-size: 1.1rem;
          animation: playground-cursor-breathe 3s ease-in-out infinite;
        }
        @keyframes playground-cursor-breathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* ─── Header buttons ─── */
        .playground-theme-toggle {
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
        .playground-theme-toggle:hover {
          color: var(--color-accent);
          background: var(--color-bg-secondary);
        }

        .playground-signin-btn {
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
        .playground-signin-btn:hover {
          color: var(--color-cta-text);
          background: var(--color-cta-bg);
          border-color: var(--color-cta-bg);
        }

        /* ─── Controls ─── */
        .playground-controls-container {
          position: fixed;
          bottom: 1rem;
          right: 1rem;
          z-index: 100;
          font-family: var(--font-body);
        }

        .playground-controls-toggle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--color-cta-bg);
          color: var(--color-cta-text);
          border: none;
          cursor: pointer;
          font-size: 1.1rem;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        .playground-controls-panel {
          backdrop-filter: blur(12px);
          border-radius: 12px;
          padding: 0.75rem 1rem;
          box-shadow: 0 4px 24px rgba(0,0,0,0.15);
          border: 1px solid var(--glass-border);
          width: 240px;
          font-size: 0.7rem;
          color: var(--color-text-primary);
        }

        .playground-control-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.35rem;
          font-size: 0.7rem;
        }
        .playground-control-row input[type="range"] {
          width: 100px;
        }

        .playground-values-summary {
          background: rgba(128,128,128,0.1);
          border-radius: 6px;
          padding: 0.4rem 0.6rem;
          font-size: 0.6rem;
          font-family: monospace;
          line-height: 1.6;
          color: var(--color-text-secondary);
          margin-top: 0.5rem;
        }

        /* ─── Mobile: stack to single column ─── */
        @media (max-width: 768px) {
          .playground-main {
            grid-template-columns: 1fr;
            gap: 2rem;
            padding: 0 1.5rem;
            align-items: start;
          }

          .playground-text-column {
            padding: 1rem 0 0;
            text-align: center;
            align-items: center;
          }

          .playground-headline {
            font-size: clamp(2rem, 8vw, 3rem) !important;
            margin-bottom: 1.5rem;
          }

          .playground-cta-cluster {
            align-items: center;
          }

          .playground-proof-rail {
            justify-content: center;
            flex-wrap: wrap;
          }

          .playground-manuscript {
            margin-bottom: 2rem;
          }

          .playground-controls-panel {
            width: 220px;
          }
        }

        /* ─── Reduced motion ─── */
        @media (prefers-reduced-motion: reduce) {
          .playground-cursor { animation: none; opacity: 1; }
          .playground-cta-button { transition: none; }
          .playground-cta-button:hover { transform: none; }
        }
      `}</style>
    </div>
  );
}
