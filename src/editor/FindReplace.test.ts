import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';
import {
  FindReplace,
  getFindReplaceState,
  moveFindMatch,
  replaceAllMatches,
  setFindQuery,
} from './FindReplace';

describe('FindReplace', () => {
  it('tracks matches, moves in both directions, and replaces all in one undo step', () => {
    const editor = new Editor({
      extensions: [StarterKit, FindReplace],
      content: '<p>alpha beta alpha</p>',
    });

    setFindQuery(editor, 'alpha');
    expect(getFindReplaceState(editor)).toMatchObject({ activeIndex: 0, matches: [{ from: 1, to: 6 }, { from: 12, to: 17 }] });
    moveFindMatch(editor, -1);
    expect(getFindReplaceState(editor).activeIndex).toBe(1);

    expect(replaceAllMatches(editor, 'omega')).toBe(2);
    expect(editor.getText()).toBe('omega beta omega');
    editor.commands.undo();
    expect(editor.getText()).toBe('alpha beta alpha');
    editor.destroy();
  });

  it('keeps immediately preceding typing when replace all is undone', () => {
    const editor = new Editor({
      extensions: [StarterKit, FindReplace],
      content: '<p></p>',
    });

    editor.commands.insertContent('alpha beta alpha');
    setFindQuery(editor, 'alpha');
    expect(replaceAllMatches(editor, 'omega')).toBe(2);
    expect(editor.getText()).toBe('omega beta omega');

    editor.commands.undo();
    expect(editor.getText()).toBe('alpha beta alpha');
    editor.destroy();
  });

  it('finds and replaces the continuous text users see across adjacent marks', () => {
    const editor = new Editor({
      extensions: [StarterKit, FindReplace],
      content: '<p>plain <strong>bold</strong> tail</p>',
    });

    setFindQuery(editor, 'n bold t');
    expect(getFindReplaceState(editor).matches).toEqual([{ from: 5, to: 13 }]);
    expect(replaceAllMatches(editor, 'n joined t')).toBe(1);
    expect(editor.getText()).toBe('plain joined tail');
    editor.destroy();
  });
});
