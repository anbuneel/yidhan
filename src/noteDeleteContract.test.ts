import type { ComponentProps } from 'react';
import { describe, expectTypeOf, it } from 'vitest';
import type { NoteDeleteHandler } from './types';
import type { ChapterSection } from './components/ChapterSection';
import type { ChapteredLibrary } from './components/ChapteredLibrary';
import type { Editor } from './components/Editor';
import type { NoteCard } from './components/NoteCard';
import type { NoteEditorView } from './components/NoteEditorView';
import type { SwipeableNoteCard } from './components/SwipeableNoteCard';
import type { useLibraryCardNavigation } from './hooks/useLibraryCardNavigation';

describe('NoteDeleteHandler', () => {
  it('is preserved through every library and editor boundary', () => {
    expectTypeOf<ComponentProps<typeof NoteCard>['onDelete']>()
      .toEqualTypeOf<NoteDeleteHandler>();
    expectTypeOf<ComponentProps<typeof SwipeableNoteCard>['onDelete']>()
      .toEqualTypeOf<NoteDeleteHandler>();
    expectTypeOf<ComponentProps<typeof ChapterSection>['onNoteDelete']>()
      .toEqualTypeOf<NoteDeleteHandler>();
    expectTypeOf<ComponentProps<typeof ChapteredLibrary>['onNoteDelete']>()
      .toEqualTypeOf<NoteDeleteHandler>();
    expectTypeOf<Parameters<typeof useLibraryCardNavigation>[0]['onDelete']>()
      .toEqualTypeOf<NoteDeleteHandler>();
    expectTypeOf<ComponentProps<typeof Editor>['onDelete']>()
      .toEqualTypeOf<NoteDeleteHandler>();
    expectTypeOf<ComponentProps<typeof NoteEditorView>['onDelete']>()
      .toEqualTypeOf<NoteDeleteHandler>();
    expectTypeOf<(id: string) => void>()
      .not.toExtend<NoteDeleteHandler>();
    expectTypeOf<(id: string) => Promise<void>>()
      .not.toExtend<NoteDeleteHandler>();
  });
});
