import { describe, it, expect } from 'vitest';
import { NoteCard } from './NoteCard';
import { SwipeableNoteCard } from './SwipeableNoteCard';
import type { Note } from '../types';

describe('NoteCard Memoization', () => {
  const mockNote: Note = {
    id: '1',
    title: 'Test Note',
    content: '<p>Content</p>',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
    pinned: false,
  };

  const defaultProps = {
    note: mockNote,
    onClick: () => {},
    onDelete: () => {},
    onTogglePin: () => {},
    isCompact: false,
  };

  it('should not re-render when handlers change but note data is stable', () => {
    const prevProps = { ...defaultProps };
    const nextProps = {
      ...defaultProps,
      onClick: () => {}, // New reference
      onDelete: () => {}, // New reference
      onTogglePin: () => {}, // New reference
    };

    // @ts-expect-error - accessing internal compare function of React.memo
    const arePropsEqual = NoteCard.compare;

    if (!arePropsEqual) {
      throw new Error('NoteCard is not memoized');
    }

    expect(arePropsEqual(prevProps, nextProps)).toBe(true);
  });

  it('should re-render when note object reference changes', () => {
    const prevProps = { ...defaultProps };
    const nextProps = {
      ...defaultProps,
      note: { ...mockNote, title: 'Updated' },
    };

    // @ts-expect-error - accessing internal compare function
    const arePropsEqual = NoteCard.compare;

    if (!arePropsEqual) {
        throw new Error('NoteCard is not memoized');
      }

    expect(arePropsEqual(prevProps, nextProps)).toBe(false);
  });

  it('should re-render when isCompact changes', () => {
    const prevProps = { ...defaultProps, isCompact: false };
    const nextProps = { ...defaultProps, isCompact: true };

    // @ts-expect-error - accessing internal compare function
    const arePropsEqual = NoteCard.compare;

    if (!arePropsEqual) {
        throw new Error('NoteCard is not memoized');
      }

    expect(arePropsEqual(prevProps, nextProps)).toBe(false);
  });
});

describe('SwipeableNoteCard Memoization', () => {
  const mockNote: Note = {
    id: '1',
    title: 'Test Note',
    content: '<p>Content</p>',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
    pinned: false,
  };

  const defaultProps = {
    note: mockNote,
    onClick: () => {},
    onDelete: () => {},
    onTogglePin: () => {},
    disabled: false,
    isCompact: false,
  };

  it('should not re-render when handlers change', () => {
    const prevProps = { ...defaultProps };
    const nextProps = {
      ...defaultProps,
      onClick: () => {},
      onDelete: () => {},
      onTogglePin: () => {},
    };

    // @ts-expect-error - accessing internal compare function
    const arePropsEqual = SwipeableNoteCard.compare;

    if (!arePropsEqual) {
        throw new Error('SwipeableNoteCard is not memoized');
      }

    expect(arePropsEqual(prevProps, nextProps)).toBe(true);
  });

  it('should re-render when disabled prop changes', () => {
     const prevProps = { ...defaultProps, disabled: false };
     const nextProps = { ...defaultProps, disabled: true };

     // @ts-expect-error - accessing internal compare function
     const arePropsEqual = SwipeableNoteCard.compare;

     if (!arePropsEqual) {
         throw new Error('SwipeableNoteCard is not memoized');
       }

     expect(arePropsEqual(prevProps, nextProps)).toBe(false);
  });

  it('should re-render when note changes', () => {
      const prevProps = { ...defaultProps };
      const nextProps = {
        ...defaultProps,
        note: { ...mockNote, title: 'New Title' },
      };

      // @ts-expect-error - accessing internal compare function
      const arePropsEqual = SwipeableNoteCard.compare;

      if (!arePropsEqual) {
          throw new Error('SwipeableNoteCard is not memoized');
        }

      expect(arePropsEqual(prevProps, nextProps)).toBe(false);
   });
});
