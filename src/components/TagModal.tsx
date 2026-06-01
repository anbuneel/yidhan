import { useEffect, useRef, useState } from 'react';
import type { Tag, TagColor } from '../types';
import { TAG_COLORS } from '../types';
import { ModalBackdropButton } from './ModalBackdropButton';

interface TagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, color: TagColor) => Promise<void>;
  onDelete?: () => Promise<void>;
  editingTag?: Tag | null;
  existingTags?: Tag[];
}

const COLOR_OPTIONS: TagColor[] = [
  'terracotta',
  'gold',
  'forest',
  'stone',
  'indigo',
  'clay',
  'sage',
  'plum',
];
const EMPTY_TAGS: Tag[] = [];

export function TagModal({ isOpen, onClose, onSave, onDelete, editingTag, existingTags = EMPTY_TAGS }: TagModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<TagColor>('stone');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const formKeyRef = useRef<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isLoading = isSaving || isDeleting;

  // Focus the name input when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => nameInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const openFormKey = isOpen
    ? `${editingTag?.id ?? 'new'}:${editingTag?.name ?? ''}:${editingTag?.color ?? 'stone'}`
    : null;
  if (formKeyRef.current !== openFormKey) {
    formKeyRef.current = openFormKey;
    if (openFormKey) {
      setName(editingTag?.name ?? '');
      setColor(editingTag?.color ?? 'stone');
      setError(null);
      setIsSaving(false);
      setIsDeleting(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Tag name is required');
      return;
    }
    if (trimmedName.length > 20) {
      setError('Tag name must be 20 characters or less');
      return;
    }

    // Check for duplicate tag name (case-insensitive)
    const isDuplicate = existingTags.some(
      (tag) =>
        tag.name.toLowerCase() === trimmedName.toLowerCase() &&
        tag.id !== editingTag?.id // Allow same name if editing the same tag
    );
    if (isDuplicate) {
      setError('A tag with this name already exists');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmedName, color);
      onClose();
    } catch {
      setError('Failed to save tag. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch {
      setError('Failed to delete tag. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
    >
      <ModalBackdropButton label="Close tag dialog" disabled={isLoading} onClick={onClose} />
      <dialog
        open
        className="
          relative z-10 w-full max-w-[400px] mx-4
          p-8
          shadow-2xl
          animate-[modal-enter_300ms_ease-out]
          border-0
        "
        style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--glass-border)',
          margin: 0,
        }}
        aria-modal="true"
        aria-labelledby="tag-modal-title"
      >
        {/* Header */}
        <h3
          id="tag-modal-title"
          className="text-xl font-semibold mb-6"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text-primary)',
          }}
        >
          {editingTag ? 'Edit Tag' : 'Create Tag'}
        </h3>

        <form onSubmit={handleSubmit}>
          {/* Name input */}
          <div className="mb-6">
            <label
              htmlFor="tag-name"
              className="block text-sm mb-2"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Name
            </label>
            <input
              id="tag-name"
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g., Work, Personal, Ideas"
              maxLength={20}
              className="
                w-full px-4 py-3
                rounded-lg
                focus-ring
                transition-all duration-200
              "
              style={{
                fontFamily: 'var(--font-body)',
                background: 'var(--color-bg-secondary)',
                border: error
                  ? '1px solid var(--color-destructive)'
                  : '1px solid var(--glass-border)',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => {
                if (!error) {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                }
              }}
              onBlur={(e) => {
                if (!error) {
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }
              }}
            />
            {error && (
              <p
                className="mt-2 text-sm"
                style={{ color: 'var(--color-destructive)' }}
              >
                {error}
              </p>
            )}
          </div>

          {/* Color picker */}
          <div className="mb-8">
            <span
              className="block text-sm mb-3"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Color
            </span>
            <div className="flex flex-wrap gap-3">
              {COLOR_OPTIONS.map((colorOption) => {
                const colorValue = TAG_COLORS[colorOption];
                const isSelected = color === colorOption;

                return (
                  <button
                    key={colorOption}
                    type="button"
                    onClick={() => setColor(colorOption)}
                    className="
                      size-8
                      rounded-full
                      transition-all duration-200
                      focus:outline-none
                      focus:ring-2
                      focus:ring-offset-2
                    "
                    style={{
                      background: colorValue,
                      transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                      boxShadow: isSelected
                        ? `0 0 0 2px var(--color-bg-primary), 0 0 0 4px ${colorValue}`
                        : 'none',
                    }}
                    aria-label={colorOption}
                    title={colorOption.charAt(0).toUpperCase() + colorOption.slice(1)}
                  />
                );
              })}
            </div>
          </div>

          {/* Preview */}
          <div className="mb-8">
            <span
              className="block text-sm mb-3"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Preview
            </span>
            <div
              className="
                inline-flex items-center gap-2
                px-4 py-2
                text-sm font-medium
              "
              style={{
                background: `${TAG_COLORS[color]}20`,
                border: `1px solid ${TAG_COLORS[color]}`,
                borderRadius: '2px 12px 4px 12px',
                color: TAG_COLORS[color],
              }}
            >
              <span
                className="size-2 rounded-full"
                style={{ background: TAG_COLORS[color] }}
              />
              {name || 'Tag name'}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            {/* Delete button (only for editing) */}
            {editingTag && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="
                  px-4 py-2
                  text-sm font-medium
                  transition-colors duration-200
                  rounded-lg
                  disabled:opacity-50
                  flex items-center gap-2
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-destructive)',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = 'var(--color-error-light)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {isDeleting && (
                  <span
                    className="size-3 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'var(--color-destructive)', borderTopColor: 'transparent' }}
                  />
                )}
                {isDeleting ? 'Deleting...' : 'Delete Tag'}
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="
                  px-5 py-2.5
                  rounded-lg
                  text-sm font-medium
                  transition-all duration-200
                  disabled:opacity-50
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.borderColor = 'var(--color-text-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="
                  px-5 py-2.5
                  rounded-lg
                  text-sm font-medium
                  transition-all duration-200
                  disabled:opacity-50
                  flex items-center gap-2
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-cta-text)',
                  background: 'var(--color-cta-bg)',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = 'var(--color-cta-bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-cta-bg)';
                }}
              >
                {isSaving && (
                  <span
                    className="size-3 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'var(--color-cta-text)', borderTopColor: 'transparent' }}
                  />
                )}
                {isSaving
                  ? 'Saving...'
                  : editingTag
                    ? 'Save Changes'
                    : 'Create Tag'}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </div>
  );
}
