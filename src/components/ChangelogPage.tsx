import { useEffect, useRef } from 'react';
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
  feature: 'var(--color-accent)',
  improvement: 'var(--color-change-improvement)',
  fix: 'var(--color-change-fix)',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return dateString;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Number of recent entries that get full visual treatment */
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
            What's New
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
            What we remember.
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
            {changelog.map((entry, index) => {
              const isRecent = index < FULL_ENTRIES;

              return (
                <article
                  key={entry.version}
                  ref={observe}
                  className="changelog-item transition-all duration-500"
                  style={{
                    // Progressive compression: recent entries get full treatment
                    padding: isRecent ? '24px' : '16px 20px',
                    background: isRecent
                      ? 'linear-gradient(to bottom, var(--color-card-bg), color-mix(in srgb, var(--color-card-bg) 97%, var(--color-accent)))'
                      : 'var(--color-card-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-card)',
                    boxShadow: isRecent ? 'var(--shadow-sm)' : 'none',
                    opacity: isRecent ? 1 : 0.85,
                  }}
                >
                  {/* Version header */}
                  <div className={`flex items-baseline gap-3 ${isRecent ? 'mb-5' : 'mb-3'}`}>
                    <h2
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: isRecent ? '1.25rem' : '1rem',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {entry.version}
                    </h2>
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.75rem',
                        color: 'var(--color-text-tertiary)',
                        fontWeight: 400,
                      }}
                    >
                      {formatDate(entry.date)}
                    </span>
                  </div>

                  {/* Changes list */}
                  <ul className={isRecent ? 'space-y-3' : 'space-y-1.5'}>
                    {entry.changes.map((change) => (
                      <li
                        key={`${entry.version}-${change.type}-${change.text.slice(0, 30)}`}
                        className="flex items-start gap-3"
                        style={{
                          fontFamily: 'var(--font-body)',
                          color: 'var(--color-text-secondary)',
                          fontWeight: 300,
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
