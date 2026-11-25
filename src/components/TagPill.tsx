import type { Tag } from '../types';
import { tagWordClass, tagWordStyle } from './tagWord';

interface TagPillProps {
  tag: Tag;
  isActive?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  showRemove?: boolean;
  onRemove?: () => void;
}

const editButtonClass = `
  relative z-20
  h-7 w-0 overflow-hidden
  sm:w-7 sm:overflow-visible
  group-hover:w-7 group-hover:overflow-visible
  focus:w-7 focus:overflow-visible focus:opacity-100
  focus-visible:w-7 focus-visible:overflow-visible
  flex items-center justify-center
  rounded-full
  opacity-0
  group-hover:opacity-100
  focus-visible:opacity-100
  transition-opacity duration-150
  focus-ring
  hover:bg-[var(--color-bg-tertiary)]
`;

const removeButtonClass = `
  relative z-20
  size-7
  flex items-center justify-center
  rounded-full
  opacity-0
  group-hover:opacity-100
  focus:opacity-100
  focus-visible:opacity-100
  transition-opacity duration-150
  focus-ring
  hover:bg-[var(--color-bg-tertiary)]
`;

// A tag in the filter row. It never reads the tag's stored colour: every tag looks
// the same, and only the active one takes the accent.
export function TagPill({ tag, isActive = false, onClick, onEdit, showRemove, onRemove }: TagPillProps) {
  return (
    <div data-tag-pill className="group relative flex items-center shrink-0">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-pressed={isActive}
          aria-label={`Filter by ${tag.name}`}
          className={`${tagWordClass} rounded-sm hover:text-[var(--color-text-primary)]`}
          style={tagWordStyle(isActive)}
        >
          {tag.name}
        </button>
      ) : (
        <span className={tagWordClass} style={tagWordStyle(isActive)}>
          {tag.name}
        </span>
      )}

      {onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className={editButtonClass}
          style={{ color: 'var(--color-text-tertiary)' }}
          aria-label="Edit tag"
        >
          <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}

      {showRemove && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={removeButtonClass}
          style={{ color: 'var(--color-text-tertiary)' }}
          aria-label="Remove tag"
        >
          <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
