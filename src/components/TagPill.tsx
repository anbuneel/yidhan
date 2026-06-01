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
    <div
      data-tag-pill
      className="
        group
        relative
        px-3 py-1.5 sm:px-4 sm:py-2
        flex items-center gap-1.5 sm:gap-2
        text-xs sm:text-sm font-medium
        transition-all duration-300
        focus-ring
        shrink-0
      "
      style={{
        fontFamily: 'var(--font-body)',
        cursor: onClick ? 'pointer' : 'default',
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
      {onClick && (
        <button
          type="button"
          className="absolute inset-0 z-0 h-full w-full rounded-[inherit] border-0 bg-transparent p-0 focus-ring"
          aria-label={`Filter by ${tag.name}`}
          onClick={onClick}
        />
      )}

      {/* Color dot */}
      <span
        className="relative z-10 size-2 rounded-full shrink-0 pointer-events-none"
        style={{ background: colorValue }}
      />

      <span className="relative z-10 pointer-events-none">{tag.name}</span>

      {/* Edit button */}
      {onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="
            ml-1
            relative z-20
            size-7 -m-1.5
            flex items-center justify-center
            rounded-full
            opacity-0
            group-hover:opacity-100
            focus-visible:opacity-100
            transition-opacity duration-200
            hover:bg-[var(--color-bg-tertiary)]
          "
          style={{ color: 'var(--color-text-tertiary)' }}
          aria-label="Edit tag"
        >
          <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}

      {/* Remove button */}
      {showRemove && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="
            ml-1
            relative z-20
            size-7 -m-1.5
            flex items-center justify-center
            rounded-full
            opacity-0
            group-hover:opacity-100
            focus-visible:opacity-100
            transition-opacity duration-200
            hover:bg-[var(--color-bg-tertiary)]
          "
          style={{ color: 'var(--color-text-tertiary)' }}
          aria-label="Remove tag"
        >
          <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
