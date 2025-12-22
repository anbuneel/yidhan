import type { Tag } from '../types';
import { TAG_COLORS } from '../types';

interface TagPillProps {
  tag: Tag;
  isActive?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  showRemove?: boolean;
  onRemove?: () => void;
}

export function TagPill({ tag, isActive = false, onClick, onEdit, showRemove, onRemove }: TagPillProps) {
  const colorValue = TAG_COLORS[tag.color];

  return (
    <button
      onClick={onClick}
      data-tag-pill
      className="
        group
        relative
        px-3 py-1.5 sm:px-4 sm:py-2
        flex items-center gap-1.5 sm:gap-2
        text-xs sm:text-sm font-medium
        transition-all duration-300
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--color-accent)]
        focus:ring-offset-1
        hover:-translate-y-0.5
        shrink-0
      "
      style={{
        fontFamily: 'var(--font-body)',
        background: isActive
          ? `${colorValue}20`
          : 'var(--color-card-bg)',
        backdropFilter: 'blur(20px)',
        border: isActive
          ? `1px solid ${colorValue}`
          : '1px solid var(--glass-border)',
        borderRadius: '2px 12px 4px 12px',
        color: isActive
          ? colorValue
          : 'var(--color-text-secondary)',
        boxShadow: isActive
          ? `0 4px 20px ${colorValue}30`
          : 'none',
      }}
    >
      {/* Color dot */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: colorValue }}
      />

      {tag.name}

      {/* Edit button */}
      {onEdit && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onEdit();
            }
          }}
          className="
            ml-1
            w-4 h-4
            flex items-center justify-center
            rounded-full
            opacity-0
            group-hover:opacity-100
            transition-opacity duration-200
            hover:bg-[var(--color-bg-tertiary)]
          "
          style={{ color: 'var(--color-text-tertiary)' }}
          aria-label="Edit tag"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </span>
      )}

      {/* Remove button */}
      {showRemove && onRemove && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onRemove();
            }
          }}
          className="
            ml-1
            w-4 h-4
            flex items-center justify-center
            rounded-full
            opacity-0
            group-hover:opacity-100
            transition-opacity duration-200
            hover:bg-[var(--color-bg-tertiary)]
          "
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      )}
    </button>
  );
}

// "All Notes" pill variant
interface AllNotesPillProps {
  isActive: boolean;
  onClick: () => void;
}

export function AllNotesPill({ isActive, onClick }: AllNotesPillProps) {
  return (
    <button
      onClick={onClick}
      className="
        px-3 py-1.5 sm:px-4 sm:py-2
        text-xs sm:text-sm font-medium
        transition-all duration-300
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--color-accent)]
        focus:ring-offset-1
        hover:-translate-y-0.5
        shrink-0
      "
      style={{
        fontFamily: 'var(--font-body)',
        background: isActive
          ? 'var(--color-accent-glow)'
          : 'var(--color-card-bg)',
        backdropFilter: 'blur(20px)',
        border: isActive
          ? '1px solid var(--color-accent)'
          : '1px solid var(--glass-border)',
        borderRadius: '2px 12px 4px 12px',
        color: isActive
          ? 'var(--color-accent)'
          : 'var(--color-text-secondary)',
        boxShadow: isActive
          ? '0 4px 20px var(--color-accent-glow)'
          : 'none',
      }}
    >
      All Notes
    </button>
  );
}

// Add tag button
interface AddTagPillProps {
  onClick: () => void;
}

export function AddTagPill({ onClick }: AddTagPillProps) {
  return (
    <button
      onClick={onClick}
      className="
        w-7 h-7 sm:w-9 sm:h-9
        flex items-center justify-center
        transition-all duration-300
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--color-accent)]
        focus:ring-offset-1
        hover:-translate-y-0.5
        hover:border-[var(--color-accent)]
        shrink-0
      "
      style={{
        background: 'var(--color-card-bg)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '2px 12px 4px 12px',
        color: 'var(--color-text-tertiary)',
      }}
      aria-label="Add new tag"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
}
