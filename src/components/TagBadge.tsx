import type { Tag } from '../types';

interface TagBadgeProps {
  tag: Tag;
}

// Tags on a card are small italic words, not chips. They never read the tag's
// stored colour.
export function TagBadge({ tag }: TagBadgeProps) {
  return (
    <span
      className="text-xs italic"
      style={{
        fontFamily: 'var(--font-body)',
        color: 'var(--color-text-tertiary)',
      }}
    >
      {tag.name}
    </span>
  );
}

interface TagBadgeListProps {
  tags: Tag[];
  maxDisplay?: number;
}

export function TagBadgeList({ tags, maxDisplay = 1 }: TagBadgeListProps) {
  if (tags.length === 0) return null;

  const displayTags = tags.slice(0, maxDisplay);
  const remainingCount = tags.length - maxDisplay;

  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5 min-w-0">
      {displayTags.map((tag, index) => (
        <span key={tag.id} className="inline-flex items-baseline gap-x-1.5">
          {index > 0 && (
            <span aria-hidden="true" className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              ·
            </span>
          )}
          <TagBadge tag={tag} />
        </span>
      ))}
      {remainingCount > 0 && (
        <span
          className="text-xs"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
          }}
          aria-label={`${remainingCount} more ${remainingCount === 1 ? 'tag' : 'tags'}`}
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );
}
