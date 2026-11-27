import { useState } from 'react';
import Masonry from 'react-masonry-css';
import type { Note, Theme } from '../types';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { FadedNoteCard } from './FadedNoteCard';
import { HeaderShell } from './HeaderShell';
import { ModalBackdropButton } from './ModalBackdropButton';
import { scrollRegionProps } from '../routing';

interface FadedNotesViewProps {
  notes: Note[];
  isLoading?: boolean;
  onBack: () => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onEmptyAll: () => void;
  theme: Theme;
  onThemeToggle: () => void;
  onSettingsClick: () => void;
}

export function FadedNotesView({
  notes,
  isLoading = false,
  onBack,
  onRestore,
  onPermanentDelete,
  onEmptyAll,
  theme,
  onThemeToggle,
  onSettingsClick,
}: FadedNotesViewProps) {
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const confirmDialogRef = useModalFocusTrap({
    isOpen: showEmptyConfirm,
    onClose: () => setShowEmptyConfirm(false),
  });

  const rightActions = !isLoading && notes.length > 0 ? (
    <button type="button"
      onClick={() => setShowEmptyConfirm(true)}
      className="
        px-4 py-2
        rounded-[var(--radius-button)]
        text-sm font-medium
        transition-all duration-200
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--color-destructive)]
        hover:opacity-80
      "
      style={{
        fontFamily: 'var(--font-body)',
        color: 'var(--color-destructive)',
        background: 'transparent',
        border: '1px solid var(--color-destructive)',
      }}
    >
      Delete all
    </button>
  ) : undefined;

  const handleEmptyAll = () => {
    onEmptyAll();
    setShowEmptyConfirm(false);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--page-background)' }}
    >
      <HeaderShell
        theme={theme}
        onThemeToggle={onThemeToggle}
        onLogoClick={onBack}
        rightActions={rightActions}
        onSettingsClick={onSettingsClick}
      />

      {/* Page Title */}
      <div className="px-6 md:px-12 pb-4">
        <h1
          className="text-2xl md:text-3xl font-semibold mb-1"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text-primary)',
          }}
        >
          Faded notes
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
            fontSize: '0.875rem',
          }}
        >
          Deleted notes stay here for 30 days. Restore one to move it back to your library.
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div
              className="size-8 mx-auto mb-4 animate-spin rounded-full border-2"
              style={{
                borderColor: 'var(--color-bg-tertiary)',
                borderTopColor: 'var(--color-accent)',
              }}
            />
            <p
              className="text-sm"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              Loading faded notes&hellip;
            </p>
          </div>
        </div>
      ) : notes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div
              className="size-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              <svg className="size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 12a8 8 0 11-16 0 8 8 0 0116 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l2 2" />
              </svg>
            </div>
            <p
              className="text-lg mb-2"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-secondary)',
              }}
            >
              No faded notes
            </p>
            <p
              className="text-sm"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              Notes you delete stay here for 30 days.
            </p>
          </div>
        </div>
      ) : (
        <main
          className="flex-1 overflow-y-auto pb-32"
          style={{ scrollbarWidth: 'none' }}
          {...scrollRegionProps}
        >
          <Masonry
            breakpointCols={{
              default: 3,
              1100: 2,
              700: 1,
            }}
            className="masonry-grid px-6 md:px-12 pt-4"
            columnClassName="masonry-grid-column"
          >
            {notes.map((note) => (
              <FadedNoteCard
                key={note.id}
                note={note}
                onRestore={onRestore}
                onPermanentDelete={onPermanentDelete}
              />
            ))}
          </Masonry>
        </main>
      )}

      {/* Empty All Confirmation Modal */}
      {showEmptyConfirm && (
        <div
          className="
            fixed inset-0 z-50
            flex items-center justify-center
            p-4 modal-backdrop
          "
        >
          <ModalBackdropButton
            label="Cancel deleting all faded notes"
            onClick={() => setShowEmptyConfirm(false)}
          />
          <dialog
            open
            ref={confirmDialogRef}
            tabIndex={-1}
            className="
              relative z-10 w-full max-w-sm
              p-6
              text-center
              border-0
            "
            style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-plain)',
              boxShadow: 'var(--shadow-lg)',
              margin: 0,
            }}
            aria-modal="true"
            aria-labelledby="empty-faded-notes-title"
          >
            <h3
              id="empty-faded-notes-title"
              className="text-lg font-semibold mb-2"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              Delete all faded notes?
            </h3>
            <p
              className="text-sm mb-6"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {notes.length} note{notes.length === 1 ? '' : 's'} will be deleted. This can't be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button type="button"
                onClick={() => setShowEmptyConfirm(false)}
                className="
                  px-4 py-2
                  rounded-[var(--radius-button)]
                  text-sm font-medium
                  transition-all duration-200
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                }}
              >
                Cancel
              </button>
              <button type="button"
                onClick={handleEmptyAll}
                className="
                  px-4 py-2
                  rounded-[var(--radius-button)]
                  text-sm font-medium
                  transition-all duration-200
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-destructive-text)',
                  background: 'var(--color-destructive)',
                }}
              >
                Delete all
              </button>
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
}
