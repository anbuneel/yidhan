import {
  CHAPTER_BASIS_LABELS,
  CHAPTER_BASIS_VALUES,
  NOTE_SORT_LABELS,
  NOTE_SORT_VALUES,
  type ChapterArrangement,
  type ChapterBasis,
  type NoteSortKey,
} from '../utils/temporalGrouping';

interface ArrangeGroupProps<T extends string> {
  /** Visible label, kept to two words so the row stays quiet */
  label: string;
  /**
   * Spoken label for the group, which the visible one is too terse to serve as, and the
   * prefix each option is announced with. Both groups offer an "Edited" and a "Written",
   * so the option text alone would name two different buttons the same thing.
   */
  description: string;
  values: readonly T[];
  labels: Record<T, string>;
  active: T;
  onChange: (value: T) => void;
}

function ArrangeGroup<T extends string>({
  label,
  description,
  values,
  labels,
  active,
  onChange,
}: ArrangeGroupProps<T>) {
  return (
    <div role="group" aria-label={description} className="flex items-center gap-1">
      <span
        className="text-xs mr-1"
        style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-tertiary)' }}
      >
        {label}
      </span>
      {values.map((value) => {
        const isActive = value === active;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            aria-label={`${description} ${labels[value].toLowerCase()}`}
            aria-pressed={isActive}
            className="
              px-2.5 py-1.5
              text-xs font-medium
              transition-all duration-300
              focus:outline-none
              focus:ring-2
              focus:ring-[var(--color-accent)]
              focus:ring-offset-1
              shrink-0
              touch-press
            "
            style={{
              fontFamily: 'var(--font-body)',
              borderRadius: '2px 12px 4px 12px',
              background: isActive ? 'var(--color-accent-glow)' : 'transparent',
              border: isActive ? '1px solid var(--color-accent)' : '1px solid transparent',
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
            }}
          >
            {labels[value]}
          </button>
        );
      })}
    </div>
  );
}

export interface LibraryArrangeBarProps {
  arrangement: ChapterArrangement;
  onBasisChange: (basis: ChapterBasis) => void;
  onSortChange: (sort: NoteSortKey) => void;
}

/**
 * The reader's choice of how the library is arranged: which timestamp decides a
 * chapter, and how notes are ordered inside one.
 *
 * It scrolls away with the notes rather than following the reader down the page — a
 * setting consulted rarely does not need to be permanently in view.
 */
export function LibraryArrangeBar({
  arrangement,
  onBasisChange,
  onSortChange,
}: LibraryArrangeBarProps) {
  return (
    <div className="px-4 md:px-12 pb-3 flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
      <ArrangeGroup
        label="Chapters by"
        description="Group chapters by"
        values={CHAPTER_BASIS_VALUES}
        labels={CHAPTER_BASIS_LABELS}
        active={arrangement.basis}
        onChange={onBasisChange}
      />
      <ArrangeGroup
        label="Notes by"
        description="Order notes by"
        values={NOTE_SORT_VALUES}
        labels={NOTE_SORT_LABELS}
        active={arrangement.sort}
        onChange={onSortChange}
      />
    </div>
  );
}
