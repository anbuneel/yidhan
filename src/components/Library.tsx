import Masonry from 'react-masonry-css';
import type { Note } from '../types';
import { NoteCard } from './NoteCard';

interface LibraryProps {
  notes: Note[];
  onNoteClick: (id: string) => void;
  onNoteDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  searchQuery?: string;
}

export function Library({ notes, onNoteClick, onNoteDelete, onTogglePin, searchQuery }: LibraryProps) {
  if (notes.length === 0) {
    const isSearching = searchQuery && searchQuery.trim().length > 0;

    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          {isSearching ? (
            <>
              <svg
                className="w-12 h-12 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p
                className="text-lg mb-2"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                No results for "{searchQuery}"
              </p>
              <p
                className="text-sm"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                Try searching with different keywords
              </p>
            </>
          ) : (
            <>
              <p
                className="text-lg mb-2"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                No notes yet
              </p>
              <p
                className="text-sm"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                Create your first note to get started
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <main
      className="
        flex-1
        overflow-y-auto
        pb-32
      "
      style={{
        scrollbarWidth: 'none',
      }}
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
          <NoteCard
            key={note.id}
            note={note}
            onClick={onNoteClick}
            onDelete={onNoteDelete}
            onTogglePin={onTogglePin}
          />
        ))}
      </Masonry>
    </main>
  );
}
