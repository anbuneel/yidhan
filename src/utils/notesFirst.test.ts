import { describe, expect, it } from 'vitest';
import type { Note } from '../types';
import { withNotesFirst } from './notesFirst';

const note = (id: string, title = id) => ({ id, title }) as Note;

describe('withNotesFirst', () => {
  it('puts new notes at the top', () => {
    expect(withNotesFirst([note('a')], [note('b')]).map((n) => n.id)).toEqual(['b', 'a']);
  });

  // A refresh that read after the write already shows the note.
  it('replaces a copy a refresh already put in the list, rather than showing it twice', () => {
    const result = withNotesFirst([note('a'), note('b', 'from refresh')], [note('b', 'created')]);
    expect(result.map((n) => [n.id, n.title])).toEqual([['b', 'created'], ['a', 'a']]);
  });
});
