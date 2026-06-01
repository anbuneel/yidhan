import type { Tag } from '../types';
import { TAG_COLORS } from '../types';

interface TagBadgeProps {
  tag: Tag;
}

export function TagBadge({ tag }: TagBadgeProps) {
  const colorValue = TAG_COLORS[tag.color];

  return (
    <span
      className="
        inline-flex items-center gap-1
        px-2 py-0.5
        text-[0.65rem]
        font-medium
        uppercase
        tracking-wider
      "
      style={{
        fontFamily: 'var(--font-body)',
        background: `${colorValue}0A`, // 10% opacity (reduced from 15%)
        color: 'var(--color-text-secondary)', // Muted text, not full color
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: colorValue }} // Colored dot remains
      />
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
    <div className="flex flex-wrap items-center gap-1.5">
      {displayTags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} />
      ))}
      {remainingCount > 0 && (
        <span
          className="
            px-2 py-0.5
            text-[0.65rem]
            font-medium
          "
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}
