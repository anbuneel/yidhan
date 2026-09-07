import { Suspense, type ComponentType, type ReactNode } from 'react';
import type { Note, Tag, Theme } from '../types';
import { ErrorBoundary } from './ErrorBoundary';
import { LoadingFallback } from './LoadingFallback';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { loadEditorComponent } from '../utils/editorLoader';

const LazyEditor = lazyWithRetry(loadEditorComponent);

export interface NoteEditorViewProps {
  note: Note;
  tags: Tag[];
  userId: string;
  theme: Theme;
  onBack: () => void;
  onRequestSearch: () => void;
  onUpdate: (note: Note) => Promise<void>;
  onDelete: (id: string) => void;
  onToggleTag: (noteId: string, tagId: string) => void;
  onCreateTag: () => void;
  onThemeToggle: () => void;
  onSettingsClick: () => void;
  /**
   * The already-resolved editor chunk, when there is one. Rendering it directly skips
   * the Suspense boundary, so opening a warmed note shows no loading screen.
   */
  loadedEditor: ComponentType<React.ComponentProps<typeof LazyEditor>> | null;
  /** Modals that belong to this screen. */
  modals?: ReactNode;
}

export function NoteEditorView({ loadedEditor, modals, ...editorProps }: NoteEditorViewProps) {
  const Editor = loadedEditor;
  const props = { ...editorProps, noteSyncStatus: editorProps.note.syncStatus };

  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      <ErrorBoundary>
        {Editor ? (
          <Editor {...props} />
        ) : (
          <Suspense fallback={<LoadingFallback message="Loading editor..." />}>
            <LazyEditor {...props} />
          </Suspense>
        )}
      </ErrorBoundary>
      {modals}
    </>
  );
}
