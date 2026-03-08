import { TAG_COLORS, type Theme, type TagColor } from '../types';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

interface LandingPageProps {
  onStartWriting: () => void;
  onSignIn: () => void;
  theme: Theme;
  onThemeToggle: () => void;
  onChangelogClick: () => void;
  onRoadmapClick: () => void;
}

// Sample notes for the app preview (2 cards + writing surface vignette)
const SAMPLE_NOTES: Array<{
  title: string;
  content: string; // HTML content for rich preview
  tag: { name: string; color: TagColor };
  time: string;
}> = [
  {
    title: 'Morning reflections',
    content: '<p>The quiet hours before dawn have become my favorite time to think clearly. There\'s something about the stillness that invites honest thoughts...</p>',
    tag: { name: 'Journal', color: 'terracotta' },
    time: '2 days ago',
  },
  {
    title: 'Weekend errands',
    content: '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked disabled></label><div><p>Farmers market</p></div></li><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked disabled></label><div><p>Return library books</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox" disabled></label><div><p>Call mom</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox" disabled></label><div><p>Fix bike tire</p></div></li></ul>',
    tag: { name: 'Tasks', color: 'sage' },
    time: '3 days ago',
  },
];

/** Showcase card for the landing page right panel. Depends on `.showcase-card` styles in the <style> block below. */
function ShowcaseCard({ note, index }: { note: typeof SAMPLE_NOTES[number]; index: number }) {
  return (
    <article
      className="p-6 pb-5 relative overflow-hidden flex flex-col showcase-card"
      style={{
        background: 'linear-gradient(to bottom, var(--color-card-bg), color-mix(in srgb, var(--color-card-bg) 97%, var(--color-accent)))',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-md)',
        minHeight: '200px',
        animationDelay: `${0.1 + index * 0.1}s`,
      }}
    >
      <h3
        className="text-xl font-semibold line-clamp-2 mb-3 leading-tight"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
      >
        {note.title}
      </h3>
      {/* Safe: hardcoded sample data, not user input */}
      <div
        className="note-card-preview text-sm leading-relaxed flex-1 overflow-hidden"
        style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
        dangerouslySetInnerHTML={{ __html: note.content }}
      />
      <div className="flex items-center justify-between mt-auto pt-4">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wider"
          style={{
            fontFamily: 'var(--font-body)',
            background: `${TAG_COLORS[note.tag.color]}0A`,
            color: 'var(--color-text-secondary)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: TAG_COLORS[note.tag.color] }}
          />
          {note.tag.name}
        </span>
        <span
          className="text-[0.65rem] uppercase tracking-[0.1em] font-medium"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-tertiary)' }}
        >
          {note.time}
        </span>
      </div>
    </article>
  );
}

export function LandingPage({ onStartWriting, onSignIn, theme, onThemeToggle, onChangelogClick, onRoadmapClick }: LandingPageProps) {
  const { isInstallable, isInstalled, triggerInstall } = useInstallPrompt();

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row overflow-hidden"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      {/* Left Panel - Hero (45/55 asymmetric split on desktop) */}
      <section className="w-full md:w-[45%] flex flex-col" style={{ background: 'var(--color-bg-primary)' }}>
        {/* Left Header */}
        <header className="h-16 px-6 md:px-8 lg:px-12 flex items-center justify-between shrink-0">
          <span
            className="text-[1.4rem] md:text-[1.75rem] font-semibold tracking-tight"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.5px',
              userSelect: 'none',
            }}
          >
            Yidhan
          </span>

          {/* Mobile-only: Theme toggle + Sign In (desktop has these in right panel header) */}
          <div className="flex md:hidden items-center gap-3">
            <button
              onClick={onThemeToggle}
              className="landing-theme-toggle focus-ring w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300"
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
              className="landing-signin-btn focus-ring px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 touch-press-light"
            >
              Sign In
            </button>
          </div>
        </header>

        {/* Hero Content */}
        <div className="flex-1 flex items-center px-6 md:px-8 lg:px-12 py-8 md:py-0">
            <div className="max-w-lg">
              <h2
                className="text-4xl md:text-5xl lg:text-[4rem] font-light leading-[1.1] mb-4 md:mb-6 landing-reveal"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                A quiet space<br />for your thoughts.
              </h2>
              <p
                className="text-base lg:text-lg mb-8 md:mb-10 max-w-sm landing-reveal landing-reveal-1"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                  fontWeight: 300,
                  lineHeight: 1.7,
                }}
              >
                The distraction-free note-taking app. No folders, no clutter.
                Just your thoughts, beautifully organized.
              </p>
              <p
                className="text-sm mb-6 md:mb-8 landing-reveal landing-reveal-2"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-accent)',
                  letterSpacing: '0.05em',
                  opacity: 0.85,
                }}
              >
                End-to-end encrypted. Your thoughts belong only to you.
              </p>

              {/* CTA Group */}
              <div className="flex flex-col gap-3 landing-reveal landing-reveal-3">
                {/* Primary CTA */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={onStartWriting}
                    className="landing-cta-button focus-ring px-10 py-4 rounded-lg text-lg font-medium transition-all duration-300 touch-press"
                    style={{
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    Start Writing
                  </button>
                  <span
                    className="text-sm"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    For free
                  </span>
                </div>

                {/* Secondary CTAs */}
                <div className="flex flex-col gap-2">
                  {/* Explore without signing up - low commitment, shown first */}
                  <a
                    href="/demo"
                    className="landing-secondary-cta focus-ring text-sm transition-all duration-200 inline-flex items-center gap-1 w-fit"
                  >
                    or explore first
                    <span className="landing-secondary-cta-arrow" aria-hidden="true">→</span>
                  </a>

                </div>
              </div>

              {/* Trust Signals */}
              <div
                className="mt-8 pt-6 flex flex-col gap-3 landing-reveal landing-reveal-4"
                style={{
                  borderTop: '1px dashed var(--glass-border)',
                }}
              >
                {['Open source', 'Works offline', 'End-to-end encrypted'].map((signal) => (
                  <div
                    key={signal}
                    className="landing-trust-signal flex items-center gap-2.5 text-base"
                  >
                    <span className="landing-trust-signal-icon">✦</span>
                    {signal}
                  </div>
                ))}
              </div>

              {/* Inline card peek - mobile only (desktop has the full showcase panel) */}
              <article
                className="md:hidden mt-8 p-5 relative overflow-hidden landing-reveal landing-reveal-4"
                style={{
                  background: 'linear-gradient(to bottom, var(--color-card-bg), color-mix(in srgb, var(--color-card-bg) 97%, var(--color-accent)))',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--shadow-sm)',
                  transform: 'rotate(-1deg)',
                }}
              >
                <h3
                  className="text-xl font-semibold mb-2 leading-tight"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
                >
                  {SAMPLE_NOTES[0].title}
                </h3>
                {/* Safe: hardcoded sample data, not user input */}
                <div
                  className="note-card-preview text-sm leading-relaxed line-clamp-3"
                  style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
                  dangerouslySetInnerHTML={{ __html: SAMPLE_NOTES[0].content }}
                />
                <div className="flex items-center justify-between mt-3">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wider"
                    style={{
                      background: `${TAG_COLORS[SAMPLE_NOTES[0].tag.color]}0A`,
                      color: 'var(--color-text-secondary)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: TAG_COLORS[SAMPLE_NOTES[0].tag.color] }}
                    />
                    {SAMPLE_NOTES[0].tag.name}
                  </span>
                  <span
                    className="text-[0.6rem] uppercase tracking-widest"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    {SAMPLE_NOTES[0].time}
                  </span>
                </div>
              </article>

              {/* Footer links - integrated into left panel */}
              <nav
                className="mt-12 md:mt-16 flex items-center gap-2 text-sm flex-wrap landing-reveal landing-reveal-4"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                <button
                  onClick={onChangelogClick}
                  className="landing-nav-link focus-ring hover:underline transition-colors duration-200"
                >
                  Changelog
                </button>
                <span aria-hidden="true">·</span>
                <button
                  onClick={onRoadmapClick}
                  className="landing-nav-link focus-ring hover:underline transition-colors duration-200"
                >
                  Roadmap
                </button>
                <span aria-hidden="true">·</span>
                <a
                  href="https://github.com/anbuneel/yidhan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-nav-link focus-ring hover:underline transition-colors duration-200"
                >
                  GitHub
                </a>
                {isInstallable && !isInstalled && (
                  <>
                    <span aria-hidden="true">·</span>
                    <button
                      onClick={triggerInstall}
                      className="landing-nav-link focus-ring hover:underline transition-colors duration-200 flex items-center gap-1.5"
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
            </div>
          </div>
        </section>

      {/* Right Panel - Showcase (55% asymmetric split, desktop only) */}
      <section
        className="hidden md:flex md:w-[55%] flex-col relative"
        style={{
          background: 'var(--color-bg-tertiary)',
        }}
      >
        {/* Soft gradient seam - desktop only */}
        <div
          className="hidden md:block absolute left-0 top-0 bottom-0 w-5 -translate-x-1/2"
          style={{
            background: 'linear-gradient(to right, var(--color-bg-primary), var(--color-bg-tertiary))',
            opacity: 0.8,
            pointerEvents: 'none',
          }}
        />

        {/* Right Header */}
        <header className="h-16 px-6 md:px-10 flex items-center justify-end gap-3 shrink-0">
          {/* Theme Toggle */}
          <button
            onClick={onThemeToggle}
            className="landing-theme-toggle focus-ring w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300"
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

          {/* Sign In - Outlined button for returning users */}
          <button
            onClick={onSignIn}
            className="landing-signin-btn focus-ring px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 touch-press-light"
          >
            Sign In
          </button>
        </header>

        {/* Cards + Writing Surface - Vertically Centered */}
        <div className="flex-1 flex items-center justify-center px-10 py-8">
            <div className="w-full max-w-3xl flex flex-col gap-5">
              {/* Top row: 2 showcase cards side by side */}
              <div className="flex" style={{ gap: '20px' }}>
                {[0, 1].map((idx) => (
                  <div key={idx} className="flex-1">
                    <ShowcaseCard note={SAMPLE_NOTES[idx]} index={idx} />
                  </div>
                ))}
              </div>

              {/* Writing surface vignette — mirrors the real editor-writing-area */}
              <div
                className="writing-surface-vignette relative overflow-hidden"
                style={{
                  background: 'color-mix(in srgb, var(--color-bg-primary) 92%, white 8%)',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)',
                  padding: '2.5rem 3rem',
                  minHeight: '200px',
                }}
              >
                {/* Manuscript glow — matches editor-writing-area::after */}
                <div
                  className="writing-surface-glow absolute inset-0 pointer-events-none"
                />
                {/* Text that fades in line by line — matches editor font styling */}
                <div className="relative" style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-primary)',
                  fontSize: '1.2rem',
                  lineHeight: 1.75,
                }}>
                  <p className="writing-line mb-0" style={{ animationDelay: '0.6s' }}>
                    There&apos;s something about writing in a quiet space —
                  </p>
                  <p className="writing-line mb-0" style={{ animationDelay: '1.2s' }}>
                    no sidebars, no distractions, just your thoughts
                  </p>
                  <p className="writing-line mb-0" style={{ animationDelay: '1.8s' }}>
                    finding their way onto the page.
                  </p>
                  <span className="writing-cursor" style={{ animationDelay: '2.4s' }}>▎</span>
                </div>
              </div>
            </div>
          </div>
        </section>

      {/* Styles */}
      <style>{`
        .landing-cta-button {
          background: var(--color-cta-bg);
          color: var(--color-cta-text);
          box-shadow: 0 4px 20px var(--color-accent-glow);
        }
        .landing-cta-button:hover {
          background: var(--color-cta-bg-hover);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px var(--color-accent-glow);
        }
        .landing-secondary-cta {
          font-family: var(--font-body);
          color: var(--color-text-secondary);
          border-bottom: 1px dotted var(--color-text-tertiary);
          text-decoration: none;
        }
        .landing-secondary-cta:hover {
          color: var(--color-accent);
          border-bottom-color: var(--color-accent);
        }
        .landing-secondary-cta-arrow {
          display: inline-block;
          transition: transform 0.2s ease;
        }
        .landing-secondary-cta:hover .landing-secondary-cta-arrow {
          transform: translateX(4px);
        }
        .landing-theme-toggle {
          color: var(--color-text-secondary);
        }
        .landing-theme-toggle:hover {
          color: var(--color-accent);
          background: var(--color-bg-secondary);
        }
        .landing-signin-btn {
          font-family: var(--font-body);
          color: var(--color-accent);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-accent-muted);
        }
        .landing-signin-btn:hover {
          color: var(--color-cta-text);
          background: var(--color-cta-bg);
          border-color: var(--color-cta-bg);
        }
        .landing-nav-link {
          color: inherit;
        }
        .landing-nav-link:hover {
          color: var(--color-accent);
        }
        .landing-trust-signal {
          font-family: var(--font-body);
          color: var(--color-text-tertiary);
        }
        .landing-trust-signal-icon {
          color: var(--color-accent);
          font-size: 0.85rem;
        }
        /* Left panel entrance choreography */
        .landing-reveal {
          animation: landing-fade-up 0.6s var(--ease-smooth) backwards;
        }
        .landing-reveal-1 { animation-delay: 0.1s; }
        .landing-reveal-2 { animation-delay: 0.2s; }
        .landing-reveal-3 { animation-delay: 0.3s; }
        .landing-reveal-4 { animation-delay: 0.4s; }
        @media (prefers-reduced-motion: reduce) {
          .landing-reveal { animation: none; }
          .showcase-card { animation: none; }
        }
        @keyframes landing-fade-up {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Card reveal (staggered via inline animationDelay) */
        .showcase-card {
          animation: card-reveal 0.8s ease-out backwards;
          transition: transform 0.3s var(--ease-smooth), box-shadow 0.3s var(--ease-smooth);
        }
        .showcase-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-lg);
        }
        @keyframes card-reveal {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Writing surface vignette — mirrors .editor-writing-area from index.css */
        .writing-surface-vignette {
          animation: card-reveal 0.8s ease-out backwards;
          animation-delay: 0.3s;
        }
        [data-theme="dark"] .writing-surface-vignette {
          background: color-mix(in srgb, var(--color-bg-primary) 75%, var(--color-bg-secondary) 25%);
          box-shadow: 0 1px 4px rgba(0,0,0,0.3), 0 4px 20px rgba(0,0,0,0.2);
        }
        /* Manuscript glow — matches editor-writing-area::after per theme */
        .writing-surface-glow {
          background: radial-gradient(ellipse 80% 50% at 50% 40%, rgba(194, 86, 52, 0.12) 0%, transparent 70%);
        }
        [data-theme="dark"] .writing-surface-glow {
          background: radial-gradient(ellipse 80% 50% at 50% 40%, rgba(212, 175, 55, 0.12) 0%, transparent 70%);
        }
        .writing-line {
          opacity: 0;
          animation: writing-fade-in 0.8s ease-out forwards;
        }
        .writing-cursor {
          opacity: 0;
          animation: writing-fade-in 0.4s ease-out forwards, cursor-breathe 3s ease-in-out 3s infinite;
          color: var(--color-accent);
          font-size: 1.1rem;
        }
        @keyframes writing-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cursor-breathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @media (prefers-reduced-motion: reduce) {
          .writing-line { animation: none; opacity: 1; }
          .writing-cursor { animation: none; opacity: 1; }
          .writing-surface-vignette { animation: none; }
        }

      `}</style>
    </div>
  );
}
