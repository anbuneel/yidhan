import { useRef, useState } from 'react';
import type { Tag, TagColor } from '../types';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { ModalBackdropButton } from './ModalBackdropButton';

interface TagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, color: TagColor) => Promise<void>;
  onDelete?: () => Promise<void>;
  editingTag?: Tag | null;
  existingTags?: Tag[];
}

// Tags no longer have a colour in the UI. New tags get the stored default; an edit
// keeps whatever colour the tag already has, so older data and backups stay intact.
const DEFAULT_TAG_COLOR: TagColor = 'stone';
const EMPTY_TAGS: Tag[] = [];

export function TagModal({ isOpen, onClose, onSave, onDelete, editingTag, existingTags = EMPTY_TAGS }: TagModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const formKeyRef = useRef<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isLoading = isSaving || isDeleting;
  const dialogRef = useModalFocusTrap({
    isOpen,
    onClose: isLoading ? undefined : onClose,
    initialFocusRef: nameInputRef,
  });

  const openFormKey = isOpen
    ? `${editingTag?.id ?? 'new'}:${editingTag?.name ?? ''}`
    : null;
  if (formKeyRef.current !== openFormKey) {
    formKeyRef.current = openFormKey;
    if (openFormKey) {
      setName(editingTag?.name ?? '');
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
      await onSave(trimmedName, editingTag?.color ?? DEFAULT_TAG_COLOR);
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
        ref={dialogRef}
        tabIndex={-1}
        className="
          relative z-10 w-full max-w-[400px] mx-4
          p-8
          shadow-[var(--shadow-lg)]
          animate-[modal-enter_300ms_ease-out]
          border-0
        "
        style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-plain)',
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
          {editingTag ? 'Edit tag' : 'New tag'}
        </h3>

        <form onSubmit={handleSubmit}>
          {/* Name input */}
          <div className="mb-8">
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
              placeholder="Tag name"
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
                  : '1px solid var(--color-input-border)',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => {
                if (!error) {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                }
              }}
              onBlur={(e) => {
                if (!error) {
                  e.currentTarget.style.borderColor = 'var(--color-input-border)';
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
                  rounded-[var(--radius-button)]
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
                {isDeleting ? 'Deleting...' : 'Delete tag'}
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
                  rounded-[var(--radius-button)]
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
                  rounded-[var(--radius-button)]
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
                    ? 'Save changes'
                    : 'Create tag'}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </div>
  );
}
