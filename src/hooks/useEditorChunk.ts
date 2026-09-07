/**
 * The editor is a 450KB lazy chunk, and opening a note through the Suspense boundary
 * shows a loading screen for as long as the chunk takes to arrive. So the library
 * preloads it in the background and the note click *warms* it — resolving the chunk
 * before the route changes, which is why opening a note usually shows no fallback at
 * all.
 */

import { useCallback, useState } from 'react';
import { getLoadedEditorComponent, loadEditorComponent } from '../utils/editorLoader';

export interface EditorChunk {
  /** The resolved component, or null while the chunk is still a promise. */
  LoadedEditor: ReturnType<typeof getLoadedEditorComponent>;
  /** Fetch the chunk without re-rendering. Safe to call repeatedly. */
  preloadEditorRoute: () => Promise<void>;
  /** Fetch the chunk and adopt it into state, so the next render skips Suspense. */
  warmEditorRoute: () => Promise<void>;
}

export function useEditorChunk(): EditorChunk {
  const [LoadedEditor, setLoadedEditor] = useState(() => getLoadedEditorComponent());

  const preloadEditorRoute = useCallback(async () => {
    if (getLoadedEditorComponent()) return;

    try {
      await loadEditorComponent();
    } catch {
      // Fall back to the lazy boundary if the chunk cannot be preloaded.
    }
  }, []);

  const warmEditorRoute = useCallback(async () => {
    const loadedEditor = getLoadedEditorComponent();
    if (loadedEditor) {
      setLoadedEditor(() => loadedEditor);
      return;
    }

    await preloadEditorRoute();

    const preloadedEditor = getLoadedEditorComponent();
    if (preloadedEditor) {
      setLoadedEditor(() => preloadedEditor);
    }
  }, [preloadEditorRoute]);

  return { LoadedEditor, preloadEditorRoute, warmEditorRoute };
}
