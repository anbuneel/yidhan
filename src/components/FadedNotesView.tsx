import { useState } from 'react';
import Masonry from 'react-masonry-css';
import type { Note, Theme } from '../types';
import { FadedNoteCard } from './FadedNoteCard';
import { HeaderShell } from './HeaderShell';

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

  const rightActions = !isLoading && notes.length > 0 ? (
    <button
      onClick={() => setShowEmptyConfirm(true)}
      className="
        px-4 py-2
        rounded-full
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
      Release All
    </button>
  ) : undefined;

  const handleEmptyAll = () => {
    onEmptyAll();
    setShowEmptyConfirm(false);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-bg-primary)' }}
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
          Faded Notes
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
            fontSize: '0.875rem',
          }}
        >
          Notes rest here before releasing.
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div
              className="w-8 h-8 mx-auto mb-4 animate-spin rounded-full border-2"
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
              Loading faded notes...
            </p>
          </div>
        </div>
      ) : notes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
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
              Nothing fading away
            </p>
            <p
              className="text-sm"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              All your notes are still with you in the library
            </p>
          </div>
        </div>
      ) : (
        <main
          className="flex-1 overflow-y-auto pb-32"
          style={{ scrollbarWidth: 'none' }}
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
            p-4
          "
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowEmptyConfirm(false)}
        >
          <div
            className="
              w-full max-w-sm
              p-6
              rounded-lg
              text-center
            "
            style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--glass-border)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-lg font-semibold mb-2"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              Release all notes?
            </h3>
            <p
              className="text-sm mb-6"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {notes.length} note{notes.length === 1 ? '' : 's'} will be gone. This is a gentle goodbye.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowEmptyConfirm(false)}
                className="
                  px-4 py-2
                  rounded-lg
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
                Keep Resting
              </button>
              <button
                onClick={handleEmptyAll}
                className="
                  px-4 py-2
                  rounded-lg
                  text-sm font-medium
                  transition-all duration-200
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-bg-primary)',
                  background: 'var(--color-accent)',
                }}
              >
                Release All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
