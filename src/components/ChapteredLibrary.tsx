import { useMemo, useState, useEffect, useCallback } from 'react';
import type { Note } from '../types';
import { ChapterSection } from './ChapterSection';
import { ChapterNav } from './ChapterNav';
import { TimeRibbon } from './TimeRibbon';
import { PullToRefresh } from './PullToRefresh';
import { GestureHint } from './GestureHint';
import { useTouchCapable, useMobileDetect } from '../hooks/useMobileDetect';
import {
  groupNotesByChapter,
  getDefaultExpansionState,
  type ChapterKey,
} from '../utils/temporalGrouping';

// Mobile breakpoint matching masonry grid (700px)
const MOBILE_BREAKPOINT = 700;

interface ChapteredLibraryProps {
  notes: Note[];
  onNoteClick: (id: string) => void;
  onNoteDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onNewNote?: () => void;
  onRefresh?: () => Promise<void>;
  searchQuery?: string;
  isSearching?: boolean;
}

export function ChapteredLibrary({
  notes,
  onNoteClick,
  onNoteDelete,
  onTogglePin,
  onNewNote,
  onRefresh,
  searchQuery,
  isSearching = false,
}: ChapteredLibraryProps) {
  // Auto-detect compact mode based on viewport width (mobile = compact)
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  // Update compact mode on viewport resize
  useEffect(() => {
    const handleResize = () => {
      setIsCompact(window.innerWidth < MOBILE_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Detect touch capability for pull-to-refresh
  const isTouchDevice = useTouchCapable();

  // Detect mobile for gesture hint
  const isMobile = useMobileDetect();

  // Group notes by chapter (pinned notes get their own chapter first)
  // Assumes notes are already sorted by date (handled in App.tsx)
  const chapters = useMemo(() => {
    return groupNotesByChapter(notes);
  }, [notes]);

  // Get default expansion state based on total note count
  const defaultExpansion = useMemo(() => {
    return getDefaultExpansionState(notes.length);
  }, [notes.length]);

  // Track current chapter for navigation
  const [currentChapter, setCurrentChapter] = useState<ChapterKey | null>(
    chapters.length > 0 ? (chapters[0].key as ChapterKey) : null
  );

  // Intersection Observer for scroll detection
  useEffect(() => {
    if (chapters.length === 0) return;

    // Use a single observer for all chapters to improve performance
    // Bolt: Optimized from N observers to 1 observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.1) {
            // Extract chapter key from element ID (format: "chapter-{key}")
            const chapterKey = entry.target.id.replace('chapter-', '');
            if (chapterKey) {
              setCurrentChapter(chapterKey as ChapterKey);
            }
          }
        });
      },
      {
        threshold: [0.1, 0.3, 0.5],
        rootMargin: '-80px 0px -20% 0px',
      }
    );

    chapters.forEach((chapter) => {
      const element = document.getElementById(`chapter-${chapter.key}`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [chapters]);

  // Smooth scroll to chapter
  const scrollToChapter = useCallback((key: ChapterKey) => {
    const element = document.getElementById(`chapter-${key}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Navigation chapters (for ChapterNav and TimeRibbon)
  const navChapters = useMemo(() => {
    return chapters.map((c) => ({ key: c.key as ChapterKey, label: c.label }));
  }, [chapters]);

  // Search-active empty state — show distinct "No thoughts found" message
  if (notes.length === 0 && isSearching) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p
            className="text-2xl mb-3"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            No thoughts found
          </p>
          <p
            className="text-base"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-tertiary)',
              lineHeight: 1.6,
            }}
          >
            Try a different search
          </p>
        </div>
      </div>
    );
  }

  // Empty state (no notes at all)
  if (notes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
            <>
              {/* Notebook icon */}
              <svg
                className="w-16 h-16 mx-auto mb-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: 'var(--color-text-tertiary)', opacity: 0.6 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <p
                className="text-2xl mb-3"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text-primary)',
                  fontWeight: 400,
                  letterSpacing: '-0.01em',
                }}
              >
                Your notes await
              </p>
              <p
                className="text-base mb-8"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-tertiary)',
                  lineHeight: 1.6,
                }}
              >
                A quiet space for your thoughts
              </p>
              {onNewNote && (
                <button
                  onClick={onNewNote}
                  className="px-6 py-3 rounded-lg font-medium transition-all duration-300 mb-4 touch-press"
                  style={{
                    fontFamily: 'var(--font-body)',
                    background: 'var(--color-cta-bg)',
                    color: 'var(--color-cta-text)',
                    boxShadow: '0 4px 20px var(--color-accent-glow)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-cta-bg-hover)';
                    e.currentTarget.style.boxShadow = '0 8px 28px var(--color-accent-glow)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--color-cta-bg)';
                    e.currentTarget.style.boxShadow = '0 4px 20px var(--color-accent-glow)';
                  }}
                >
                  Create your first note
                </button>
              )}
              <p
                className="text-xs"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                or press{' '}
                <kbd
                  className="px-1.5 py-0.5 rounded text-xs"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
                </kbd>
                {' + '}
                <kbd
                  className="px-1.5 py-0.5 rounded text-xs"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  N
                </kbd>
              </p>
            </>
        </div>
      </div>
    );
  }

  // Library content (rendered inside or outside PullToRefresh based on device)
  const libraryContent = (
    <main
      className="flex-1 overflow-y-auto pb-32 relative"
      style={{ scrollbarWidth: 'none' }}
      data-testid="library-view"
    >
      {/* Render each non-empty chapter */}
      {chapters.map((chapter) => (
        <ChapterSection
          key={chapter.key}
          chapterKey={chapter.key as ChapterKey}
          label={chapter.label}
          notes={chapter.notes}
          defaultExpanded={defaultExpansion[chapter.key as ChapterKey]}
          isPinned={chapter.isPinned}
          onNoteClick={onNoteClick}
          onNoteDelete={onNoteDelete}
          onTogglePin={onTogglePin}
          isCompact={isCompact}
          searchQuery={searchQuery}
          isSearching={isSearching}
        />
      ))}
    </main>
  );

  return (
    <>
      {/* Wrap with PullToRefresh on touch devices when onRefresh is provided */}
      {isTouchDevice && onRefresh ? (
        <PullToRefresh onRefresh={onRefresh}>
          {libraryContent}
        </PullToRefresh>
      ) : (
        libraryContent
      )}

      {/* Chapter Navigation - Desktop (right sidebar) */}
      <ChapterNav
        chapters={navChapters}
        currentChapter={currentChapter}
        onChapterClick={scrollToChapter}
      />

      {/* Time Ribbon - Mobile (bottom scrubber) */}
      <TimeRibbon
        chapters={navChapters}
        currentChapter={currentChapter}
        onChapterClick={scrollToChapter}
      />

      {/* Gesture Hint - Mobile only, shows once when notes exist */}
      <GestureHint enabled={isMobile && notes.length > 0} />
    </>
  );
}
