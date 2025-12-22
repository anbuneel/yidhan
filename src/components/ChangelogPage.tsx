import { changelog, type ChangeType } from '../data/changelog';
import { HeaderShell } from './HeaderShell';
import { Footer } from './Footer';
import type { Theme } from '../types';

interface ChangelogPageProps {
  theme: Theme;
  onThemeToggle: () => void;
  onSignIn: () => void;
  onLogoClick: () => void;
  onRoadmapClick: () => void;
  onSettingsClick?: () => void;
}

const changeTypeIcons: Record<ChangeType, { icon: string; label: string }> = {
  feature: { icon: '✦', label: 'New' },
  improvement: { icon: '↑', label: 'Improved' },
  fix: { icon: '✓', label: 'Fixed' },
};

const changeTypeColors: Record<ChangeType, string> = {
  feature: 'var(--color-accent)',
  improvement: '#87A878',
  fix: '#8B8178',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ChangelogPage({ theme, onThemeToggle, onSignIn, onLogoClick, onRoadmapClick, onSettingsClick }: ChangelogPageProps) {
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
        <div className="max-w-[800px] mx-auto px-10 pb-20">
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
            What's New
          </h1>
          <p
            className="text-base mb-10"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
              fontWeight: 300,
            }}
          >
            All the latest updates and improvements to Zenote.
          </p>

          {/* Changelog entries */}
          <div className="space-y-8">
            {changelog.map((entry) => (
              <article
                key={entry.version}
                className="p-6 relative"
                style={{
                  background: 'var(--color-card-bg)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid var(--glass-border)',
                  borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : undefined,
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                {/* Accent line */}
                <div
                  className="absolute top-0 left-0 w-full h-[2px]"
                  style={{
                    background: 'var(--color-accent)',
                    opacity: 0.5,
                    borderRadius: '2px 24px 0 0',
                  }}
                />

                {/* Version header */}
                <div className="flex items-center justify-between mb-5">
                  <h2
                    className="text-xl font-semibold"
                    style={{
                      fontFamily: 'var(--font-display)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    v{entry.version}
                  </h2>
                  <span
                    className="text-xs px-3 py-1 rounded-full uppercase tracking-wider"
                    style={{
                      fontFamily: 'var(--font-body)',
                      background: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-tertiary)',
                      fontWeight: 500,
                      letterSpacing: '0.1em',
                    }}
                  >
                    {formatDate(entry.date)}
                  </span>
                </div>

                {/* Changes list */}
                <ul className="space-y-3">
                  {entry.changes.map((change, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text-secondary)',
                        fontWeight: 300,
                        fontSize: '0.95rem',
                        lineHeight: 1.6,
                      }}
                    >
                      <span
                        className="shrink-0 mt-0.5"
                        style={{ color: changeTypeColors[change.type] }}
                        title={changeTypeIcons[change.type].label}
                      >
                        {changeTypeIcons[change.type].icon}
                      </span>
                      <span>{change.text}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer
        onChangelogClick={() => {}}
        onRoadmapClick={onRoadmapClick}
      />
    </div>
  );
}
