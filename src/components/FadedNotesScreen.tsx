import { Suspense } from 'react';
import type { Note, Theme } from '../types';
import { ErrorBoundary } from './ErrorBoundary';
import { LoadingFallback } from './LoadingFallback';
import { lazyWithRetry } from '../utils/lazyWithRetry';

const FadedNotesView = lazyWithRetry(() =>
  import('./FadedNotesView').then((module) => ({ default: module.FadedNotesView }))
);

/**
 * `/faded`, with its own boundary and chunk.
 *
 * The library and the editor each became a screen component in item 63; this was the
 * one view still written out inline in App, which meant its error boundary and lazy
 * import lived somewhere different from the other two for no reason.
 */

export interface FadedNotesScreenProps {
  notes: Note[];
  isLoading: boolean;
  onBack: () => void;
  onRestore: (id: string) => Promise<void> | void;
  onPermanentDelete: (id: string) => Promise<void> | void;
  onEmptyAll: () => Promise<void> | void;
  theme: Theme;
  onThemeToggle: () => void;
  onSettingsClick: () => void;
}

export function FadedNotesScreen(props: FadedNotesScreenProps) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback message="Loading faded notes..." />}>
        <FadedNotesView {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}
