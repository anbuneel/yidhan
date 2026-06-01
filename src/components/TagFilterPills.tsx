interface AllNotesPillProps {
  isActive: boolean;
  onClick: () => void;
}

export function AllNotesPill({ isActive, onClick }: AllNotesPillProps) {
  return (
    <button type="button"
      onClick={onClick}
      className="
        px-3 py-1.5 sm:px-4 sm:py-2
        text-xs sm:text-sm font-medium
        transition-all duration-300
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--color-accent)]
        focus:ring-offset-1
        shrink-0
      "
      style={{
        fontFamily: 'var(--font-body)',
        background: isActive
          ? 'var(--color-accent-glow)'
          : 'var(--color-card-bg)',
        backdropFilter: 'blur(10px)',
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

interface AddTagPillProps {
  onClick: () => void;
}

export function AddTagPill({ onClick }: AddTagPillProps) {
  return (
    <button type="button"
      onClick={onClick}
      className="
        size-9
        flex items-center justify-center
        transition-all duration-300
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--color-accent)]
        focus:ring-offset-1
        hover:border-[var(--color-accent)]
        shrink-0
      "
      style={{
        background: 'var(--color-card-bg)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '2px 12px 4px 12px',
        color: 'var(--color-text-tertiary)',
      }}
      aria-label="Add new tag"
    >
      <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
}
