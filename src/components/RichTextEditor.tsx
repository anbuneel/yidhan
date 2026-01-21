import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useEffect, useRef, useMemo, useCallback } from 'react';
import { SlashCommand } from './SlashCommand';
import {
  saveCursorPosition as persistCursorPosition,
  getEditorPosition,
  createThrottledSave,
  type CursorPosition,
} from '../utils/editorPosition';

// Module-level cache to store cursor positions by noteId
// This persists across component remounts (including React StrictMode double-mount)
// and allows restoring cursor position when switching browser tabs
// Works alongside localStorage for cross-session persistence
const cursorPositionCache = new Map<string, { from: number; to: number }>();

// Track which notes have had their initial focus applied (for new notes)
const initialFocusApplied = new Set<string>();

// Get cursor position: prefer in-memory cache (fast), fallback to localStorage (cross-session)
function getCursorPosition(noteId: string): CursorPosition | null {
  // Fast path: in-memory cache for tab switches
  const cached = cursorPositionCache.get(noteId);
  if (cached) return cached;

  // Slow path: localStorage for cross-session
  const stored = getEditorPosition(noteId);
  if (stored) {
    // Warm the cache for next time
    cursorPositionCache.set(noteId, stored.cursor);
    return stored.cursor;
  }

  return null;
}

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onBlur?: () => void;
  noteId?: string; // Used to reset editor when switching notes
  autoFocus?: boolean; // Focus editor at end of content on mount
  onEditorReady?: (editor: Editor) => void; // Callback when editor is ready
}

export function RichTextEditor({ content, onChange, onBlur, noteId, autoFocus, onEditorReady }: RichTextEditorProps) {
  // Track previous noteId to detect actual note switches
  const prevNoteIdRef = useRef<string | undefined>(noteId);
  // Track if we've set up selection listener for this editor instance
  const selectionListenerSetupRef = useRef(false);
  // Throttled localStorage save (created once per noteId)
  const throttledPersistRef = useRef<(() => void) | null>(null);

  // Memoize extensions to prevent recreation on every render
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
    }),
    Placeholder.configure({
      placeholder: 'Start writing... (type / for commands)',
    }),
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Highlight.configure({
      multicolor: false,
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    SlashCommand,
  ], []);

  const editor = useEditor({
    extensions,
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: () => {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: 'prose-editor',
      },
    },
  });

  // Save cursor position whenever selection changes
  // This allows restoring position when editor remounts (e.g., after tab switch)
  // Also persists to localStorage (throttled) for cross-session restoration
  const saveCursorPosition = useCallback(() => {
    if (editor && noteId && !editor.isDestroyed) {
      try {
        const { from, to } = editor.state.selection;
        // Always update in-memory cache (fast)
        cursorPositionCache.set(noteId, { from, to });

        // Throttled persist to localStorage (slower but cross-session)
        if (!throttledPersistRef.current) {
          throttledPersistRef.current = createThrottledSave(() => {
            const cached = cursorPositionCache.get(noteId);
            if (cached) {
              persistCursorPosition(noteId, cached);
            }
          }, 2000); // Save at most every 2 seconds
        }
        throttledPersistRef.current();
      } catch {
        // Ignore errors if editor state is not accessible
      }
    }
  }, [editor, noteId]);

  // Set up selection change listener to continuously save cursor position
  useEffect(() => {
    if (!editor || !noteId || selectionListenerSetupRef.current) return;

    selectionListenerSetupRef.current = true;
    editor.on('selectionUpdate', saveCursorPosition);

    return () => {
      editor.off('selectionUpdate', saveCursorPosition);
      selectionListenerSetupRef.current = false;
    };
  }, [editor, noteId, saveCursorPosition]);

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Update content only when switching to a different note
  // Compare with previous noteId to avoid resetting on re-renders or real-time updates
  useEffect(() => {
    if (editor && noteId && prevNoteIdRef.current !== noteId) {
      editor.commands.setContent(content);
      // Clear initial focus flag for previous note so it will focus at end when reopened
      if (prevNoteIdRef.current) {
        initialFocusApplied.delete(prevNoteIdRef.current);
        // Don't clear cursor position cache - keep it for when user returns
      }
      // Reset throttled persist for new note
      throttledPersistRef.current = null;
    }
    prevNoteIdRef.current = noteId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, editor]);

  // Restore cursor position or focus at end for new notes
  useEffect(() => {
    if (!editor || !noteId || !autoFocus) return;

    // Get position from memory (fast) or localStorage (cross-session)
    const savedPosition = getCursorPosition(noteId);
    const hasHadInitialFocus = initialFocusApplied.has(noteId);

    // Use requestAnimationFrame to ensure editor view is ready
    requestAnimationFrame(() => {
      if (!editor || editor.isDestroyed) return;

      try {
        if (savedPosition) {
          // Restore saved cursor position
          const docLength = editor.state.doc.content.size;
          // Ensure position is valid within document bounds
          const safeFrom = Math.min(savedPosition.from, docLength);
          const safeTo = Math.min(savedPosition.to, docLength);
          editor.commands.setTextSelection({ from: safeFrom, to: safeTo });
          editor.commands.focus();
        } else if (!hasHadInitialFocus) {
          // First time opening this note - focus at end
          initialFocusApplied.add(noteId);
          editor.commands.focus('end');
        }
        // If hasHadInitialFocus but no saved position, do nothing - let user click to focus
      } catch {
        // Fallback: just focus without position if something goes wrong
        try {
          editor.commands.focus();
        } catch {
          // Editor not ready, ignore
        }
      }
    });
  }, [editor, autoFocus, noteId]);

  if (!editor) {
    return null;
  }

  return (
    <div className="rich-text-editor" data-testid="rich-text-editor">
      <EditorContent editor={editor} />
    </div>
  );
}
