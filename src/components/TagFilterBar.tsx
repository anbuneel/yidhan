import type { Tag } from '../types';
import { TagPill, AllNotesPill, AddTagPill } from './TagPill';

interface TagFilterBarProps {
  tags: Tag[];
  selectedTagIds: string[];
  onTagToggle: (tagId: string) => void;
  onClearFilter: () => void;
  onAddTag: () => void;
  onEditTag: (tag: Tag) => void;
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

  return (
    <div
      className="
        h-[60px]
        px-6 md:px-12
        flex items-center
        gap-3
        overflow-x-auto
        shrink-0
      "
      style={{
        scrollbarWidth: 'none',
        maskImage: tags.length > 5
          ? 'linear-gradient(to right, black 24px, black calc(100% - 24px), transparent)'
          : 'none',
      }}
    >
      {/* All Notes pill */}
      <AllNotesPill
        isActive={isAllNotesActive}
        onClick={onClearFilter}
      />

      {/* Divider */}
      {tags.length > 0 && (
        <div
          className="w-px h-6 shrink-0"
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
    </div>
  );
}
