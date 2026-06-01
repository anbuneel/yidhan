import { useRef, useState, useEffect, useCallback, useLayoutEffect, useSyncExternalStore } from 'react';
import type { Tag } from '../types';
import { TagPill } from './TagPill';
import { AllNotesPill, AddTagPill } from './TagFilterPills';

interface TagFilterBarProps {
  tags: Tag[];
  selectedTagIds: string[];
  onTagToggle: (tagId: string) => void;
  onClearFilter: () => void;
  onAddTag: () => void;
  onEditTag: (tag: Tag) => void;
}

const subscribeToResize = (notify: () => void) => {
  window.addEventListener('resize', notify, { passive: true });
  return () => window.removeEventListener('resize', notify);
};

// Hook to detect mobile breakpoint
function useIsMobile() {
  return useSyncExternalStore(
    subscribeToResize,
    () => window.innerWidth < 640,
    () => false
  );
}

export function TagFilterBar({
  tags,
  selectedTagIds,
  onTagToggle,
  onClearFilter,
  onAddTag,
  onEditTag,
}: TagFilterBarProps) {
  const isAllNotesActive = selectedTagIds.length === 0;
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);
  const isMobile = useIsMobile();

  // Row configuration based on screen size
  const collapsedHeight = isMobile ? 52 : 108; // 1 row mobile, 2 rows desktop

  // Calculate how many tags are hidden (overflow beyond visible rows)
  const calculateHiddenCount = useCallback(() => {
    if (!contentRef.current || isExpanded) {
      setHiddenCount(0);
      return;
    }

    const content = contentRef.current;
    const pills = content.querySelectorAll('[data-tag-pill]');
    const containerRect = content.getBoundingClientRect();

    let hidden = 0;
    pills.forEach((pill) => {
      const pillRect = pill.getBoundingClientRect();
      // Check if pill bottom extends beyond the collapsed height
      const relativeBottom = pillRect.bottom - containerRect.top;
      if (relativeBottom > collapsedHeight - 8) {
        hidden++;
      }
    });

    setHiddenCount(hidden);
  }, [isExpanded, collapsedHeight]);

  // Recalculate on tags change, expansion state, or resize
  useLayoutEffect(() => {
    calculateHiddenCount();

    // Also recalculate on resize
    const handleResize = () => {
      // Small delay to let layout settle
      requestAnimationFrame(calculateHiddenCount);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [tags, isExpanded, isMobile, calculateHiddenCount]);

  // Recalculate after initial render when refs are available
  useEffect(() => {
    const timer = setTimeout(calculateHiddenCount, 50);
    return () => clearTimeout(timer);
  }, [calculateHiddenCount]);

  // On mobile: always show all tags (no collapse)
  // On desktop: use collapse/expand with 2 rows default
  const shouldCollapse = !isMobile && !isExpanded && hiddenCount > 0;

  return (
    <div
      className="relative z-20"
      style={{
        background: 'var(--color-bg-primary)',
        // Mobile: no height restriction, Desktop: collapse to 2 rows
        ...(shouldCollapse ? {
          maxHeight: '108px',
          overflow: 'hidden',
        } : {}),
      }}
    >
      {/* Wrap container */}
      <div
        ref={contentRef}
        className="
          px-4 sm:px-12
          py-2 sm:py-3
          flex flex-wrap
          items-center
          gap-2 sm:gap-3
        "
      >
        {/* All Notes pill */}
        <AllNotesPill
          isActive={isAllNotesActive}
          onClick={onClearFilter}
        />

        {/* Divider */}
        {tags.length > 0 && (
          <div
            className="w-px h-5 sm:h-6 shrink-0"
            style={{ background: 'var(--glass-border)' }}
          />
        )}

        {/* Tag pills */}
        {tags.map((tag) => (
          <TagPill
            key={tag.id}
            tag={tag}
            isActive={selectedTagIds.includes(tag.id)}
            onClick={() => onTagToggle(tag.id)}
            onEdit={() => onEditTag(tag)}
          />
        ))}

        {/* Add tag button */}
        <AddTagPill onClick={onAddTag} />

        {/* Expand button - shows on desktop when tags overflow */}
        {!isMobile && !isExpanded && hiddenCount > 0 && (
          <button type="button"
            onClick={() => setIsExpanded(true)}
            className="
              px-2 py-1 sm:px-3 sm:py-1.5
              flex items-center gap-1
              text-xs sm:text-sm font-medium
              shrink-0
              transition-all duration-200
              hover:border-[var(--color-accent)]
              hover:text-[var(--color-accent)]
            "
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-tertiary)',
              background: 'var(--color-bg-secondary)',
              borderRadius: '2px 8px 4px 8px',
              border: '1px solid var(--glass-border)',
            }}
            aria-expanded="false"
            aria-label={`Show ${hiddenCount} more tags`}
          >
            +{hiddenCount}
            <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Collapse button when expanded (desktop only) */}
        {!isMobile && isExpanded && (
          <button type="button"
            onClick={() => setIsExpanded(false)}
            className="
              px-2 py-1 sm:px-3 sm:py-1.5
              flex items-center gap-1
              text-xs sm:text-sm font-medium
              shrink-0
              transition-all duration-200
            "
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-accent)',
              background: 'var(--color-accent-glow)',
              borderRadius: '2px 8px 4px 8px',
              border: '1px solid var(--color-accent)',
            }}
            aria-expanded="true"
            aria-label="Collapse tags"
          >
            <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
