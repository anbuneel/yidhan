import { useState, useEffect, useRef, useCallback } from 'react';
import type { Note, Tag, Theme } from '../types';
import { RichTextEditor } from './RichTextEditor';
import { TagSelector } from './TagSelector';
import { formatShortDate, formatRelativeTime } from '../utils/formatTime';
import { HeaderShell } from './HeaderShell';
import { WhisperBack } from './WhisperBack';

interface EditorProps {
  note: Note;
  tags: Tag[];
  onBack: () => void;
  onUpdate: (note: Note) => void;
  onDelete: (id: string) => void;
  onToggleTag: (noteId: string, tagId: string) => void;
  onCreateTag?: () => void;
  theme: Theme;
  onThemeToggle: () => void;
  onSettingsClick: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

export function Editor({ note, tags, onBack, onUpdate, onDelete, onToggleTag, onCreateTag, theme, onThemeToggle, onSettingsClick }: EditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Separate refs for save indicator phases to avoid nested timeout issues
  const savePhaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentNoteId, setCurrentNoteId] = useState(note.id);

  // Reset local state when switching to a different note
  useEffect(() => {
    if (currentNoteId !== note.id) {
      setCurrentNoteId(note.id);
      setTitle(note.title);
      setContent(note.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  // Perform the actual save
  const performSave = useCallback(() => {
    if (title === note.title && content === note.content) return;

    setSaveStatus('saving');
    onUpdate({
      ...note,
      title,
      content,
      updatedAt: new Date(),
    });

    // Clear any existing indicator timeouts (flat structure, no nesting)
    if (savePhaseTimeoutRef.current) {
      clearTimeout(savePhaseTimeoutRef.current);
    }
    if (hideIndicatorTimeoutRef.current) {
      clearTimeout(hideIndicatorTimeoutRef.current);
    }

    // After 500ms, transition from "Saving..." to "Saved"
    savePhaseTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
    }, 500);

    // After 2500ms total, hide the indicator
    hideIndicatorTimeoutRef.current = setTimeout(() => {
      setSaveStatus('idle');
    }, 2500);
  }, [title, content, note, onUpdate]);

  // Auto-save when content changes (debounced)
  useEffect(() => {
    // Don't auto-save if nothing changed
    if (title === note.title && content === note.content) return;

    // Clear any existing auto-save timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Schedule auto-save after 1.5 seconds of inactivity
    autoSaveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 1500);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [title, content, note.title, note.content, performSave]);

  // Handle Escape key to save and go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        performSave();
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performSave, onBack]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (savePhaseTimeoutRef.current) {
        clearTimeout(savePhaseTimeoutRef.current);
      }
      if (hideIndicatorTimeoutRef.current) {
        clearTimeout(hideIndicatorTimeoutRef.current);
      }
      // Note: Don't clear focus cache here - it causes issues with React StrictMode
      // The cache is cleared when switching to a different note in RichTextEditor
    };
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTitle(e.target.value);
    // Auto-resize
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Focus will move to the editor naturally
    }
  };

  // Check if note has meaningful content (not just empty HTML)
  const hasContent = (() => {
    const stripped = note.content.replace(/<[^>]*>/g, '').trim();
    return stripped.length > 0;
  })();

  // Auto-resize title on mount and handle initial focus
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px';

      // Focus title if note is empty (new note)
      if (!hasContent) {
        titleRef.current.focus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    onDelete(note.id);
  };

  // Handle logo click: save and go back
  const handleLogoClick = () => {
    performSave();
    onBack();
  };

  // Left content: Logo + Breadcrumb (integrated for visual continuity)
  const leftContent = (
    <div className="flex items-center min-w-0">
      {/* Clickable Logo */}
      <button
        onClick={handleLogoClick}
        className="text-xl md:text-[1.75rem] font-semibold tracking-tight transition-colors duration-200 hover:text-[var(--color-accent)] shrink-0"
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.5px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Zenote
      </button>

      {/* Separator - visible on desktop */}
      <span
        className="hidden sm:inline mx-2 md:mx-3 text-xl"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        /
      </span>

      {/* Note Title - visible on desktop */}
      <span
        className="hidden sm:inline truncate text-xl max-w-[200px] md:max-w-[300px]"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontStyle: 'italic',
          color: 'var(--color-text-primary)',
        }}
        title={title || 'Untitled'}
      >
        {title || 'Untitled'}
      </span>
    </div>
  );

  // Center content: Mobile note title only
  const centerContent = (
    <div className="sm:hidden flex items-center min-w-0">
      <span
        className="truncate text-sm font-medium"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-text-primary)',
        }}
      >
        {title || 'Untitled'}
      </span>
    </div>
  );

  // Right actions: Save status + Delete button
  const rightActions = (
    <div className="flex items-center gap-2">
      {/* Save Status Indicator */}
      {saveStatus !== 'idle' && (
        <span
          className={`
            shrink-0 text-xs px-2 py-1 rounded-full flex items-center gap-1.5
            transition-opacity duration-300
            ${saveStatus === 'saved' ? 'opacity-80' : 'opacity-100'}
          `}
          style={{
            fontFamily: 'var(--font-body)',
            color: saveStatus === 'saving' ? 'var(--color-accent)' : 'var(--color-success)',
            background: saveStatus === 'saving' ? 'var(--color-accent-glow)' : 'var(--color-success-glow)',
          }}
        >
          {saveStatus === 'saving' ? (
            <>
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: 'var(--color-accent)' }}
              />
              Saving...
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </>
          )}
        </span>
      )}

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="
          w-9 h-9
          rounded-full
          flex items-center justify-center
          transition-all duration-200
          focus:outline-none
          focus:ring-2
          focus:ring-[var(--color-accent)]
        "
        style={{ color: 'var(--color-text-tertiary)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-destructive)';
          e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-tertiary)';
          e.currentTarget.style.background = 'transparent';
        }}
        aria-label="Delete note"
        title="Delete note"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      {/* Editor Header - Uses HeaderShell for consistent positioning */}
      <div className="sticky top-0 z-10" style={{ background: 'var(--color-bg-primary)' }}>
        <HeaderShell
          theme={theme}
          onThemeToggle={onThemeToggle}
          leftContent={leftContent}
          center={centerContent}
          rightActions={rightActions}
          onSettingsClick={onSettingsClick}
        />
      </div>

      {/* Editor Content */}
      <main className="flex-1">
        <div className="max-w-[800px] mx-auto px-10 pb-40">
          {/* Title */}
          <textarea
            ref={titleRef}
            value={title}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            onBlur={performSave}
            placeholder="Untitled"
            className="
              w-full
              font-semibold
              bg-transparent
              border-none
              outline-none
              resize-none
              overflow-hidden
              leading-tight
              mb-1
            "
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.75rem',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
            }}
            rows={1}
          />

          {/* Timestamps */}
          <div
            className="text-xs mb-3"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            Created {formatShortDate(note.createdAt)} · Edited {formatRelativeTime(note.updatedAt)}
          </div>

          {/* Tag Selector */}
          <div className="mb-3">
            <TagSelector
              tags={tags}
              selectedTagIds={note.tags.map((t) => t.id)}
              onToggleTag={(tagId) => onToggleTag(note.id, tagId)}
              onCreateTag={onCreateTag}
            />
          </div>

          {/* Rich Text Content */}
          <RichTextEditor
            content={content}
            onChange={handleContentChange}
            onBlur={performSave}
            noteId={note.id}
            autoFocus={hasContent}
          />

          {/* Organic Footer - appears at natural end of content */}
          <footer
            className="mt-16 mb-8 flex flex-col items-center gap-4"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {/* Decorative dots - like end of a letter */}
            <div className="flex gap-2 opacity-40">
              <span className="w-1 h-1 rounded-full bg-current" />
              <span className="w-1 h-1 rounded-full bg-current" />
              <span className="w-1 h-1 rounded-full bg-current" />
            </div>

            {/* Return link - larger touch target on mobile */}
            <button
              onClick={handleLogoClick}
              className="
                flex items-center gap-2
                px-4 py-3
                min-h-[44px]
                text-sm
                transition-colors duration-300
                hover:text-[var(--color-accent)]
                active:text-[var(--color-accent)]
              "
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Return to notes
            </button>

            {/* Keyboard hint - desktop only */}
            <span
              className="hidden sm:block text-xs opacity-50"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Press <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-bg-secondary)]">Esc</kbd> to save & exit
            </span>
          </footer>
        </div>
      </main>

      {/* Whisper Float - fixed position back button */}
      <WhisperBack onClick={handleLogoClick} />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="
              w-[400px]
              p-8
              shadow-2xl
            "
            style={{
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--glass-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-xl font-semibold mb-3"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              Delete this note?
            </h3>
            <p
              className="mb-8"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
                fontSize: '0.95rem',
                lineHeight: 1.6,
              }}
            >
              This action cannot be undone. The note will be permanently removed from your library.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="
                  px-5 py-2.5
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-text-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="
                  px-5 py-2.5
                  rounded-lg
                  text-sm font-medium
                  transition-all duration-200
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: '#fff',
                  background: '#DC2626',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#B91C1C';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#DC2626';
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
