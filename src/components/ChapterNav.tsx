import { useState, useEffect, useCallback } from 'react';
import type { ChapterKey } from '../utils/temporalGrouping';

interface ChapterNavProps {
  chapters: { key: ChapterKey; label: string }[];
  currentChapter: ChapterKey | null;
  onChapterClick: (key: ChapterKey) => void;
}

// Chapter labels for tooltips
const CHAPTER_LABELS: Record<ChapterKey, string> = {
  today: 'Today',
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  seasonsPast: 'Seasons Past',
};

export function ChapterNav({
  chapters,
  currentChapter,
  onChapterClick,
}: ChapterNavProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredChapter, setHoveredChapter] = useState<ChapterKey | null>(null);

  // Show nav when scrolling, hide after idle
  useEffect(() => {
    let scrollTimeout: ReturnType<typeof setTimeout>;
    let hideTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      setIsVisible(true);
      clearTimeout(scrollTimeout);
      clearTimeout(hideTimeout);

      scrollTimeout = setTimeout(() => {
        // Keep visible for 2s after scrolling stops
        hideTimeout = setTimeout(() => {
          setIsVisible(false);
        }, 2000);
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
      clearTimeout(hideTimeout);
    };
  }, []);

  // Show on mouse enter, hide on mouse leave
  const handleMouseEnter = useCallback(() => {
    setIsVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Delay hide to allow clicking
    setTimeout(() => {
      setIsVisible(false);
    }, 1000);
  }, []);

  // Don't render if only one chapter
  if (chapters.length <= 1) {
    return null;
  }

  return (
    <nav
      className={`
        fixed right-4 top-1/2 -translate-y-1/2
        hidden md:flex flex-col items-center gap-3
        py-4 px-2
        rounded-full
        backdrop-blur-md
        transition-opacity duration-300
        z-40
        ${isVisible ? 'opacity-100' : 'opacity-0 hover:opacity-100'}
      `}
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--shadow-md)',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label="Chapter navigation"
    >
      {chapters.map((chapter) => {
        const isActive = currentChapter === chapter.key;
        const isHovered = hoveredChapter === chapter.key;

        return (
          <div key={chapter.key} className="relative">
            {/* Tooltip */}
            {isHovered && (
              <div
                className="
                  absolute right-full mr-3
                  px-3 py-1.5
                  rounded-lg
                  whitespace-nowrap
                  pointer-events-none
                  animate-fade-in
                "
                style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--glass-border)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {CHAPTER_LABELS[chapter.key]}
              </div>
            )}

            {/* Dot button */}
            <button
              onClick={() => onChapterClick(chapter.key)}
              onMouseEnter={() => setHoveredChapter(chapter.key)}
              onMouseLeave={() => setHoveredChapter(null)}
              className={`
                relative
                rounded-full
                transition-all duration-300
                focus:outline-none
                focus:ring-2
                focus:ring-[var(--color-accent)]
                focus:ring-offset-2
                ${isActive ? 'w-3 h-3' : 'w-2 h-2'}
              `}
              style={{
                background: isActive
                  ? 'var(--color-accent)'
                  : 'var(--color-text-tertiary)',
                opacity: isActive ? 1 : 0.5,
                boxShadow: isActive
                  ? '0 0 8px var(--color-accent-glow)'
                  : 'none',
              }}
              aria-label={`Jump to ${CHAPTER_LABELS[chapter.key]}`}
              aria-current={isActive ? 'true' : undefined}
            />
          </div>
        );
      })}
    </nav>
  );
}
