import { useState, useEffect, useCallback, useEffectEvent, useRef } from 'react';
import { type ChapterKey } from '../utils/temporalGrouping';

interface TimeRibbonProps {
  noteCount: number;
  chapters: { key: ChapterKey; label: string }[];
  currentChapter: ChapterKey | null;
  onChapterClick: (key: ChapterKey) => void;
}

// Short labels for mobile (use full labels from utility)
const SHORT_LABELS: Record<ChapterKey, string> = {
  pinned: 'Pinned',
  thisWeek: 'Week',
  lastWeek: 'Last Wk',
  thisMonth: 'Month',
  earlier: 'Earlier',
  archive: 'Archive',
};

// localStorage key for tracking first-time users
const RIBBON_SEEN_KEY = 'yidhan-ribbon-seen';

// Timeout durations
const FIRST_TIME_TIMEOUT = 6000; // 6s for first-time users
const RETURNING_TIMEOUT = 5000; // 5s for returning users

export function TimeRibbon({
  chapters,
  noteCount,
  currentChapter,
  onChapterClick,
}: TimeRibbonProps) {
  const [nearFooter, setNearFooter] = useState(false);
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => setNearFooter(entry.isIntersecting), { rootMargin: "120px 0px" });
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Check if user has seen the ribbon before
  const getHideTimeout = useCallback(() => {
    if (typeof window === 'undefined') return RETURNING_TIMEOUT;
    const hasSeen = localStorage.getItem(RIBBON_SEEN_KEY);
    if (!hasSeen) {
      localStorage.setItem(RIBBON_SEEN_KEY, 'true');
      return FIRST_TIME_TIMEOUT;
    }
    return RETURNING_TIMEOUT;
  }, []);

  // Reset hide timer
  const resetHideTimer = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, RETURNING_TIMEOUT);
  }, []);

  // Show ribbon and reset timer
  const showRibbon = useCallback(() => {
    setIsVisible(true);
    resetHideTimer();
  }, [resetHideTimer]);
  const handleRibbonActivity = useEffectEvent(() => {
    showRibbon();
  });

  // Track previous chapter for section change detection
  const prevChapterRef = useRef<ChapterKey | null>(currentChapter);

  // Show on section change (using render-time comparison to avoid lint warning)
  if (currentChapter !== prevChapterRef.current && currentChapter !== null) {
    prevChapterRef.current = currentChapter;
    setIsVisible(true);
    // Reset timer will be handled by the effect below
  }

  // Auto-hide with scroll direction awareness
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show on scroll UP (user seeking/navigating)
      if (currentScrollY < lastScrollY.current - 10) {
        handleRibbonActivity();
      }

      lastScrollY.current = currentScrollY;
    };

    // Show on scroll or touch
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchstart', handleRibbonActivity, { passive: true });

    // Initial hide (longer for first-time users)
    const initialTimeout = getHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, initialTimeout);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', handleRibbonActivity);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [getHideTimeout]);

  const handleChapterClick = useCallback(
    (key: ChapterKey) => {
      // Haptic feedback on supported devices
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
      onChapterClick(key);
      showRibbon();
    },
    [onChapterClick, showRibbon]
  );

  // Don't render if only one chapter
  if (noteCount < 20 || nearFooter || chapters.length <= 1) {
    return null;
  }

  const currentLabel = currentChapter
    ? SHORT_LABELS[currentChapter]
    : chapters[0]?.label || '';

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 h-[calc(7rem+env(safe-area-inset-bottom))] border-t border-[var(--glass-border)] bg-[var(--color-bg-primary)] md:hidden">
    <nav
      className={`
        absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2
        flex items-center gap-2
        px-3 py-3 max-w-[calc(100vw-2rem)]
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
    >
      {/* Timeline track */}
      <div className="flex items-center gap-0">
        {chapters.map((chapter) => {
          const isActive = currentChapter === chapter.key;

          return (
            <button type="button"
              key={chapter.key}
              onClick={() => handleChapterClick(chapter.key)}
              className="
                inline-flex items-center justify-center
                min-w-[36px] min-h-[48px]
                md:min-w-0 md:min-h-0
                rounded-full
                transition-all duration-300
                focus:outline-none
              "
              aria-label={`Jump to ${chapter.label}`}
              aria-current={isActive ? 'true' : undefined}
            >
              <span
                className={`
                  block rounded-full
                  transition-all duration-300
                  ${isActive ? 'size-3' : 'size-2'}
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
              />
            </button>
          );
        })}
      </div>

      {/* Current chapter label */}
      <div
        className="
          ml-2 pl-3
          border-l
          text-xs font-medium
          min-w-[38px]
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
    </div>
  );
}
