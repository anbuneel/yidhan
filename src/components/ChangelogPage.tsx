import { useEffect, useRef } from 'react';
import { changelog, type ChangeType } from '../data/changelog';
import { formatDayVersions, groupChangelogByDay } from '../utils/changelogDays';
import { HeaderShell } from './HeaderShell';
import { Footer } from './Footer';
import type { Theme } from '../types';

interface ChangelogPageProps {
  theme: Theme;
  onThemeToggle: () => void;
  onSignIn: () => void;
  onLogoClick?: () => void;
  onRoadmapClick?: () => void;
  onPrivacyClick?: () => void;
  onTermsClick?: () => void;
  onSupportClick?: () => void;
  onSettingsClick?: () => void;
}

const changeTypeIcons: Record<ChangeType, { icon: string; label: string }> = {
  feature: { icon: '✦', label: 'New' },
  improvement: { icon: '↑', label: 'Improved' },
  fix: { icon: '✓', label: 'Fixed' },
};

const changeTypeColors: Record<ChangeType, string> = {
  feature: 'var(--color-accent-text)',
  improvement: 'var(--color-change-improvement)',
  fix: 'var(--color-change-fix)',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return dateString;
  }
  // Dates are calendar days ("2026-11-25"), which Date parses as the start of the day
  // in UTC. Format them in UTC too, or a reader west of UTC sees the day before.
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Number of recent days that get full visual treatment */
const FULL_ENTRIES = 3;

/**
 * Hook: observe elements entering the viewport and apply a fade-in class.
 */
function useScrollReveal() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('changelog-visible');
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
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

export function ChangelogPage({
  theme,
  onThemeToggle,
  onSignIn,
  onLogoClick,
  onRoadmapClick,
  onPrivacyClick,
  onTermsClick,
  onSupportClick,
  onSettingsClick,
}: ChangelogPageProps) {
  const observe = useScrollReveal();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--page-background)' }}
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
        <div className="max-w-[calc(48ch+5rem)] mx-auto px-6 sm:px-10 pb-20" data-measure="public-page">
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
            What's new
          </h1>
          <p
            className="text-base mb-12"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
              fontWeight: 400,
              fontStyle: 'italic',
            }}
          >
            Every release, newest first.
          </p>

          {/* Changelog entries with left-margin thread */}
          <div
            className="space-y-6"
            style={{
              borderLeft: '1px solid color-mix(in srgb, var(--color-accent) 15%, transparent)',
              paddingLeft: '24px',
              marginLeft: '8px',
            }}
          >
            {groupChangelogByDay(changelog).map((day, index) => {
              const isRecent = index < FULL_ENTRIES;

              return (
                <article
                  key={day.date}
                  ref={observe}
                  className="changelog-item transition-all duration-500"
                  style={{
                    // Progressive compression: recent entries get full treatment
                    padding: isRecent ? '24px' : '16px 20px',
                    background: isRecent
                      ? 'linear-gradient(to bottom, var(--color-card-bg), color-mix(in srgb, var(--color-card-bg) 97%, var(--color-accent)))'
                      : 'var(--color-card-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-plain)',
                    boxShadow: isRecent ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  {/* Day header: the date, with the day's versions in small text */}
                  <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${isRecent ? 'mb-5' : 'mb-3'}`}>
                    <h2
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: isRecent ? '1.25rem' : '1rem',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <time dateTime={day.date}>{formatDate(day.date)}</time>
                    </h2>
                    <span
                      data-testid="changelog-versions"
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.75rem',
                        color: 'var(--color-text-tertiary)',
                        fontWeight: 400,
                      }}
                    >
                      {formatDayVersions(day.versions)}
                    </span>
                  </div>

                  {/* Changes list */}
                  <ul className={isRecent ? 'space-y-3' : 'space-y-1.5'}>
                    {day.changes.map((change, changeIndex) => (
                      <li
                        key={`${changeIndex}-${change.type}-${change.text.slice(0, 30)}`}
                        className="flex items-start gap-3"
                        style={{
                          fontFamily: 'var(--font-body)',
                          color: 'var(--color-text-secondary)',
                          fontWeight: 400,
                          fontSize: isRecent ? '0.95rem' : '0.875rem',
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
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer
        onChangelogClick={() => {}}
        onRoadmapClick={onRoadmapClick}
        onPrivacyClick={onPrivacyClick}
        onTermsClick={onTermsClick}
        onSupportClick={onSupportClick}
      />

      {/* Changelog-specific styles */}
      <style>{`
        .changelog-item {
          opacity: 0;
          transform: translateY(10px);
        }
        .changelog-item.changelog-visible {
          opacity: inherit;
          transform: translateY(0);
          transition: opacity 0.5s ease-out, transform 0.5s ease-out;
        }

        @media (max-width: 640px) {
          div[style*="border-left"] {
            border-left-color: transparent !important;
            padding-left: 0 !important;
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
