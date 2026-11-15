import { useState, useRef, useEffect } from 'react';
import type { Tag } from '../types';

interface TagSelectorProps {
  tags: Tag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onCreateTag?: () => void;
  variant?: 'dropdown' | 'inline';
}

export function TagSelector({
  tags,
  selectedTagIds,
  onToggleTag,
  onCreateTag,
  variant = 'dropdown',
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      containerRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded]')?.focus();
    };
    document.addEventListener('keydown', dismiss, true);
    return () => document.removeEventListener('keydown', dismiss, true);
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id));

  const dropdownJSX = isOpen ? (
        <div
          data-testid="tag-selector-menu"
          className="
            absolute left-0 top-full mt-2
            min-w-[200px] max-w-[calc(100vw-2rem)]
            py-2
            rounded-lg
            shadow-[var(--shadow-lg)]
            z-50
          "
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--glass-border)',
          }}
        >
          {tags.length === 0 ? (
            <p
              className="px-4 py-2 text-sm"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              No tags yet
            </p>
          ) : (
            tags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);

              return (
                <button type="button"
                  key={tag.id}
                  onClick={() => onToggleTag(tag.id)}
                  aria-pressed={isSelected}
                  className="
                    w-full px-4 py-2
                    flex items-center justify-between gap-3
                    text-left text-sm
                    transition-colors duration-150
                    hover:bg-[var(--color-bg-tertiary)]
                  "
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  }}
                >
                  <span className="truncate">{tag.name}</span>
                  <svg
                    className="size-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    style={{ color: 'var(--color-accent-text)', visibility: isSelected ? 'visible' : 'hidden' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              );
            })
          )}

          {/* Divider */}
          {onCreateTag && (
            <>
              <div
                className="my-2 mx-3"
                style={{ borderTop: '1px solid var(--glass-border)' }}
              />

              <button type="button"
                onClick={() => {
                  setIsOpen(false);
                  onCreateTag();
                }}
                className="
                  w-full px-4 py-2
                  flex items-center gap-3
                  text-left text-sm
                  transition-colors duration-150
                  hover:bg-[var(--color-bg-tertiary)]
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-accent-text)',
                }}
              >
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                Create new tag
              </button>
            </>
          )}
        </div>
  ) : null;

  if (variant === 'inline') {
    return (
      <div className="relative flex items-center gap-1.5 flex-wrap" ref={containerRef}>
        {selectedTags.map((tag, index) => (
          <button
            key={tag.id}
            type="button"
            className="inline-flex items-baseline gap-1.5 py-0.5 text-xs italic cursor-pointer rounded-sm transition-colors duration-150 hover:text-[var(--color-text-primary)]"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
              border: 'none',
              background: 'transparent',
            }}
            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            {index > 0 && <span aria-hidden="true" className="not-italic" style={{ color: 'var(--color-text-tertiary)' }}>·</span>}
            {tag.name}
          </button>
        ))}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label="Add tag"
          className="inline-flex items-center gap-1 px-2 py-0.5 text-sm font-medium transition-colors duration-200 rounded hover:bg-[var(--color-bg-tertiary)]"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          {selectedTags.length === 0 && <span>Add tag</span>}
        </button>

        {dropdownJSX}
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Selected tags display + trigger */}
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="
          flex items-center gap-2
          px-3 py-2
          text-sm
          transition-all duration-200
          rounded-lg
          hover:bg-[var(--color-bg-tertiary)]
        "
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>

        {selectedTags.length === 0 ? (
          <span>Add tags</span>
        ) : (
          <span className="flex items-center gap-1.5">
            {selectedTags.slice(0, 2).map((tag, index) => (
              <span key={tag.id} className="inline-flex items-baseline gap-1.5 text-xs italic">
                {index > 0 && <span aria-hidden="true" className="not-italic" style={{ color: 'var(--color-text-tertiary)' }}>·</span>}
                {tag.name}
              </span>
            ))}
            {selectedTags.length > 2 && (
              <span className="text-xs">+{selectedTags.length - 2}</span>
            )}
          </span>
        )}

        <svg
          className={`size-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {dropdownJSX}
    </div>
  );
}
