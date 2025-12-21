import { useState, useEffect, useCallback } from 'react';
import type { ChapterKey } from '../utils/temporalGrouping';

interface TimeRibbonProps {
  chapters: { key: ChapterKey; label: string }[];
  currentChapter: ChapterKey | null;
  onChapterClick: (key: ChapterKey) => void;
}

// Short labels for mobile
const SHORT_LABELS: Record<ChapterKey, string> = {
  today: 'Today',
  thisWeek: 'Week',
  thisMonth: 'Month',
  lastMonth: 'Last Mo.',
  seasonsPast: 'Past',
};

export function TimeRibbon({
  chapters,
  currentChapter,
  onChapterClick,
}: TimeRibbonProps) {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-hide after idle
  useEffect(() => {
    let hideTimeout: ReturnType<typeof setTimeout>;

    const handleInteraction = () => {
      setIsVisible(true);
      clearTimeout(hideTimeout);

      hideTimeout = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    };

    // Show on scroll or touch
    window.addEventListener('scroll', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });

    // Initial hide after 3s
    hideTimeout = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => {
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      clearTimeout(hideTimeout);
    };
  }, []);

  const handleChapterClick = useCallback(
    (key: ChapterKey) => {
      // Haptic feedback on supported devices
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
      onChapterClick(key);
      setIsVisible(true);
    },
    [onChapterClick]
  );

  // Don't render if only one chapter
  if (chapters.length <= 1) {
    return null;
  }

  const currentLabel = currentChapter
    ? SHORT_LABELS[currentChapter]
    : chapters[0]?.label || '';

  return (
    <nav
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2
        flex items-center gap-2
        px-4 py-3
        rounded-full
        backdrop-blur-md
        md:hidden
        transition-all duration-300
        z-40
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-30 translate-y-2'}
      `}
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--shadow-lg)',
      }}
      aria-label="Time navigation"
      onClick={() => setIsVisible(true)}
    >
      {/* Timeline track */}
      <div className="flex items-center gap-3">
        {chapters.map((chapter) => {
          const isActive = currentChapter === chapter.key;

          return (
            <button
              key={chapter.key}
              onClick={() => handleChapterClick(chapter.key)}
              className={`
                rounded-full
                transition-all duration-300
                focus:outline-none
                ${isActive ? 'w-3 h-3' : 'w-2 h-2'}
              `}
              style={{
                background: isActive
                  ? 'var(--color-accent)'
                  : 'var(--color-text-tertiary)',
                opacity: isActive ? 1 : 0.5,
                boxShadow: isActive
                  ? '0 0 6px var(--color-accent-glow)'
                  : 'none',
              }}
              aria-label={`Jump to ${chapter.label}`}
              aria-current={isActive ? 'true' : undefined}
            />
          );
        })}
      </div>

      {/* Current chapter label */}
      <div
        className="
          ml-2 pl-3
          border-l
          text-xs font-medium
          min-w-[50px]
        "
        style={{
          borderColor: 'var(--glass-border)',
          fontFamily: 'var(--font-display)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {currentLabel}
      </div>
    </nav>
  );
}
