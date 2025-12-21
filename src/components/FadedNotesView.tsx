import { useState } from 'react';
import Masonry from 'react-masonry-css';
import type { Note } from '../types';
import { FadedNoteCard } from './FadedNoteCard';

interface FadedNotesViewProps {
  notes: Note[];
  onBack: () => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onEmptyAll: () => void;
}

export function FadedNotesView({
  notes,
  onBack,
  onRestore,
  onPermanentDelete,
  onEmptyAll,
}: FadedNotesViewProps) {
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  const handleEmptyAll = () => {
    onEmptyAll();
    setShowEmptyConfirm(false);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      {/* Header */}
      <header
        className="
          h-16
          px-6 md:px-12
          flex
          items-center
          justify-between
          shrink-0
        "
      >
        {/* Left: Back button + Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="
              w-9 h-9
              rounded-full
              flex items-center justify-center
              transition-all duration-200
              focus:outline-none
              focus:ring-2
              focus:ring-[var(--color-accent)]
              hover:bg-[var(--color-bg-secondary)]
            "
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h1
            className="text-xl md:text-2xl font-semibold"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
            }}
          >
            Faded Notes
          </h1>
        </div>

        {/* Right: Empty All button */}
        {notes.length > 0 && (
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
            Empty All
          </button>
        )}
      </header>

      {/* Subtitle */}
      <div
        className="px-6 md:px-12 pb-4"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-text-tertiary)',
          fontSize: '0.875rem',
        }}
      >
        Notes here will be permanently removed after 30 days.
      </div>

      {/* Content */}
      {notes.length === 0 ? (
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
              Nothing fading here
            </p>
            <p
              className="text-sm"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              Deleted notes will appear in this space
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
              Empty all faded notes?
            </h3>
            <p
              className="text-sm mb-6"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
              }}
            >
              This will permanently delete {notes.length} note{notes.length === 1 ? '' : 's'}. This cannot be undone.
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
                Cancel
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
                  color: '#fff',
                  background: 'var(--color-destructive)',
                }}
              >
                Empty All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
