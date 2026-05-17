import { useEffect, useRef } from 'react';
import { roadmap, statusLabels, type RoadmapStatus } from '../data/roadmap';
import { HeaderShell } from './HeaderShell';
import { Footer } from './Footer';
import type { Theme } from '../types';

interface RoadmapPageProps {
  theme: Theme;
  onThemeToggle: () => void;
  onSignIn: () => void;
  onLogoClick: () => void;
  onChangelogClick: () => void;
  onPrivacyClick?: () => void;
  onTermsClick?: () => void;
  onSupportClick?: () => void;
  onSettingsClick?: () => void;
}

const statusOrder: RoadmapStatus[] = ['shipped', 'in-progress', 'coming-soon', 'exploring'];

/**
 * Per-status visual materiality — cards feel progressively lighter
 * from Shipped (solid, settled) to Exploring (mist, whisper).
 */
const statusMateriality: Record<RoadmapStatus, React.CSSProperties> = {
  shipped: {
    background: 'linear-gradient(to bottom, var(--color-card-bg), color-mix(in srgb, var(--color-card-bg) 94%, var(--color-success)))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-md)',
    opacity: 1,
  },
  'in-progress': {
    background: 'linear-gradient(to bottom, var(--color-card-bg), color-mix(in srgb, var(--color-card-bg) 97%, var(--color-accent)))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-sm)',
    opacity: 1,
  },
  'coming-soon': {
    background: 'var(--color-card-bg)',
    border: '1px dashed var(--glass-border)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'none',
    opacity: 0.8,
  },
  exploring: {
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'none',
    opacity: 0.55,
  },
};

/** Section label styling — quiet text, not pills */
const sectionLabelStyle: Record<RoadmapStatus, React.CSSProperties> = {
  shipped: { color: 'var(--color-success)' },
  'in-progress': { color: 'var(--color-status-progress)' },
  'coming-soon': { color: 'var(--color-status-coming)' },
  exploring: { color: 'var(--color-status-exploring)' },
};

/** Thread opacity fades as status becomes less certain */
const threadOpacity: Record<RoadmapStatus, number> = {
  shipped: 0.2,
  'in-progress': 0.15,
  'coming-soon': 0.1,
  exploring: 0,
};

/**
 * Hook: observe elements entering the viewport and apply a fade-in class.
 * Returns a ref callback to attach to each item.
 */
function useScrollReveal() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('roadmap-visible');
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    return () => observerRef.current?.disconnect();
  }, []);

  const observe = (el: HTMLElement | null) => {
    if (el && observerRef.current) {
      observerRef.current.observe(el);
    }
  };

  return observe;
}

export function RoadmapPage({
  theme,
  onThemeToggle,
  onSignIn,
  onLogoClick,
  onChangelogClick,
  onPrivacyClick,
  onTermsClick,
  onSupportClick,
  onSettingsClick,
}: RoadmapPageProps) {
  const observe = useScrollReveal();

  // Group items by status
  const groupedItems = statusOrder.reduce((acc, status) => {
    acc[status] = roadmap.filter((item) => item.status === status);
    return acc;
  }, {} as Record<RoadmapStatus, typeof roadmap>);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <HeaderShell
        theme={theme}
        onThemeToggle={onThemeToggle}
        onLogoClick={onLogoClick}
        onSignIn={onSignIn}
        onSettingsClick={onSettingsClick}
      />

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-[800px] mx-auto px-6 sm:px-10 pb-20">
          {/* Title */}
          <h1
            className="font-semibold mb-3"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.75rem',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Roadmap
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
            Some thoughts have settled. Others are still forming.
          </p>

          {/* Roadmap sections with left-margin thread */}
          <div className="space-y-12">
            {statusOrder.map((status) => {
              const items = groupedItems[status];
              if (items.length === 0) return null;

              return (
                <section
                  key={status}
                  className="relative"
                  style={{
                    // Left-margin thread — hidden on mobile via padding
                    borderLeft: `1px solid var(--color-accent)`,
                    borderLeftColor: `color-mix(in srgb, var(--color-accent) ${threadOpacity[status] * 100}%, transparent)`,
                    paddingLeft: '24px',
                    marginLeft: '8px',
                  }}
                >
                  {/* Section label — quiet text, not pills */}
                  <h2
                    className="mb-5"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      ...sectionLabelStyle[status],
                    }}
                  >
                    {statusLabels[status]}
                  </h2>

                  {/* Items */}
                  <div className="space-y-4">
                    {items.map((item) => (
                      <article
                        key={item.id}
                        ref={observe}
                        className={`roadmap-item p-5 transition-all duration-700${
                          status === 'in-progress' ? ' roadmap-breathing' : ''
                        }`}
                        style={statusMateriality[status]}
                      >
                        <h3
                          className="text-base font-semibold mb-2"
                          style={{
                            fontFamily: 'var(--font-display)',
                            color: status === 'exploring'
                              ? 'var(--color-text-tertiary)'
                              : 'var(--color-text-primary)',
                          }}
                        >
                          {item.title}
                        </h3>
                        <p
                          className="text-sm"
                          style={{
                            fontFamily: 'var(--font-body)',
                            color: status === 'exploring'
                              ? 'var(--color-text-tertiary)'
                              : 'var(--color-text-secondary)',
                            fontWeight: 300,
                            lineHeight: 1.6,
                          }}
                        >
                          {item.description}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer
        onChangelogClick={onChangelogClick}
        onRoadmapClick={() => {}}
        onPrivacyClick={onPrivacyClick}
        onTermsClick={onTermsClick}
        onSupportClick={onSupportClick}
      />

      {/* Roadmap-specific styles */}
      <style>{`
        /* Scroll-reveal: items start invisible, fade in on viewport entry */
        .roadmap-item {
          opacity: 0;
          transform: translateY(12px);
        }
        .roadmap-item.roadmap-visible {
          opacity: inherit;
          transform: translateY(0);
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }

        /* Breathing animation for in-progress items */
        .roadmap-breathing.roadmap-visible {
          animation: roadmap-breath 8s ease-in-out infinite;
        }
        @keyframes roadmap-breath {
          0%, 100% { box-shadow: var(--shadow-sm); }
          50% { box-shadow: var(--shadow-sm), 0 0 12px var(--color-accent-glow); }
        }

        /* Hide thread on mobile — not enough margin space */
        @media (max-width: 640px) {
          section[style*="border-left"] {
            border-left-color: transparent !important;
            padding-left: 0 !important;
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
