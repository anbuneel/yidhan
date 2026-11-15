import { tagWordClass, tagWordStyle } from './tagWord';

interface AllNotesPillProps {
  isActive: boolean;
  onClick: () => void;
}

export function AllNotesPill({ isActive, onClick }: AllNotesPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      // mr-7 matches the space each tag keeps for its edit control, so the gaps are even.
      className={`${tagWordClass} mr-7 rounded-sm hover:text-[var(--color-text-primary)]`}
      style={tagWordStyle(isActive)}
    >
      All notes
    </button>
  );
}

interface AddTagPillProps {
  onClick: () => void;
}

export function AddTagPill({ onClick }: AddTagPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add tag"
      className={`${tagWordClass} gap-1 rounded-sm text-xs sm:text-sm hover:text-[var(--color-accent-text)]`}
      style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-tertiary)' }}
    >
      <span aria-hidden="true">+</span>
      <span>Tag</span>
    </button>
  );
}
