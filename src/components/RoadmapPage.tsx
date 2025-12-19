import { roadmap, statusLabels, statusColors, type RoadmapStatus } from '../data/roadmap';
import { SimpleHeader } from './SimpleHeader';
import { Footer } from './Footer';
import type { Theme } from '../types';

interface RoadmapPageProps {
  theme: Theme;
  onThemeToggle: () => void;
  onSignIn: () => void;
  onLogoClick: () => void;
  onChangelogClick: () => void;
  isAuthenticated?: boolean;
}

const statusOrder: RoadmapStatus[] = ['in-progress', 'coming-soon', 'exploring'];

export function RoadmapPage({ theme, onThemeToggle, onSignIn, onLogoClick, onChangelogClick, isAuthenticated }: RoadmapPageProps) {
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
      <SimpleHeader
        theme={theme}
        onThemeToggle={onThemeToggle}
        onLogoClick={onLogoClick}
        onSignIn={onSignIn}
        isAuthenticated={isAuthenticated}
      />

      {/* Content */}
      <main className="flex-1 px-6 md:px-12 py-4 md:py-6">
        <div className="max-w-2xl mx-auto">
          {/* Title */}
          <h1
            className="text-3xl md:text-4xl font-semibold mb-3"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Roadmap
          </h1>
          <p
            className="text-base mb-10"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
              fontWeight: 300,
            }}
          >
            What we're building and exploring next.
          </p>

          {/* Roadmap sections */}
          <div className="space-y-10">
            {statusOrder.map((status) => {
              const items = groupedItems[status];
              if (items.length === 0) return null;

              return (
                <section key={status}>
                  {/* Section header */}
                  <div className="flex items-center gap-4 mb-5">
                    <h2
                      className="text-lg font-semibold"
                      style={{
                        fontFamily: 'var(--font-display)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {statusLabels[status]}
                    </h2>
                    <div
                      className="flex-1 h-px"
                      style={{ background: 'var(--glass-border)' }}
                    />
                  </div>

                  {/* Items */}
                  <div className="space-y-4">
                    {items.map((item) => (
                      <article
                        key={item.id}
                        className="p-5 relative"
                        style={{
                          background: 'var(--color-card-bg)',
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                          border: '1px solid var(--glass-border)',
                          borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : undefined,
                          borderRadius: 'var(--radius-card)',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3
                              className="text-base font-semibold mb-2"
                              style={{
                                fontFamily: 'var(--font-display)',
                                color: 'var(--color-text-primary)',
                              }}
                            >
                              {item.title}
                            </h3>
                            <p
                              className="text-sm"
                              style={{
                                fontFamily: 'var(--font-body)',
                                color: 'var(--color-text-secondary)',
                                fontWeight: 300,
                                lineHeight: 1.6,
                              }}
                            >
                              {item.description}
                            </p>
                          </div>
                          <span
                            className="shrink-0 text-xs px-3 py-1 rounded-full font-medium"
                            style={{
                              background: statusColors[status].bg,
                              color: statusColors[status].text,
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            {statusLabels[status]}
                          </span>
                        </div>
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
      />
    </div>
  );
}
