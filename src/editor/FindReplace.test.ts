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

function editorWith(content: string) {
  return new Editor({ extensions: [StarterKit, FindReplace], content });
}

describe('FindReplace', () => {
  describe('treats the query as literal text, not a pattern', () => {
    // The query is escaped before it reaches the RegExp. Without that, a note
    // about code or maths turns ordinary characters into wildcards and the
    // highlights land on text the reader never asked for.
    it.each([
      ['a.b', '<p>a.b and axb</p>', 1],
      ['(x)', '<p>(x) and x</p>', 1],
      ['[y]', '<p>[y] and y</p>', 1],
      ['a*', '<p>a* and aaa</p>', 1],
      ['c++', '<p>c++ and c+</p>', 1],
      ['^start', '<p>^start and start</p>', 1],
      ['end$', '<p>end$ and end</p>', 1],
      ['a|b', '<p>a|b and a and b</p>', 1],
      ['{2}', '<p>{2} and 22</p>', 1],
      ['back\\slash', '<p>back\\slash and backslash</p>', 1],
    ])('matches %j literally', (query, content, expected) => {
      const editor = editorWith(content);

      setFindQuery(editor, query);

      expect(getFindReplaceState(editor).matches).toHaveLength(expected);
      editor.destroy();
    });

    it('replaces a metacharacter query without the replacement being reinterpreted', () => {
      const editor = editorWith('<p>cost is $5 and $5 again</p>');

      setFindQuery(editor, '$5');

      expect(replaceAllMatches(editor, '$10')).toBe(2);
      // '$&' and friends are replacement-string specials; the replacement must
      // land verbatim rather than expanding to the matched text.
      expect(editor.getText()).toBe('cost is $10 and $10 again');
      editor.destroy();
    });

    it('does not throw on a query that is only metacharacters', () => {
      const editor = editorWith('<p>a \\ b ( c [ d</p>');

      // An unescaped one of these is an invalid pattern, which would throw
      // inside the plugin and take the editor down mid-keystroke.
      for (const query of ['\\', '(', '[', '*', '+', '?', '{', '|', '^', '$']) {
        expect(() => setFindQuery(editor, query)).not.toThrow();
      }
      editor.destroy();
    });
  });

  it('stays linear on a large note', () => {
    // Measured on this machine: ~3.3ms/query at 6.5k chars, 5.2ms at 26k,
    // 17.4ms at 105k, 53.2ms at 263k — linear in document size, and under a
    // frame for any note a person plausibly writes. The issue asked whether
    // debouncing or indexing was needed; on this evidence it is not, so none
    // was added.
    //
    // The bound below is deliberately loose. It exists to catch a change that
    // makes this quadratic, not to police milliseconds — a tight bound here
    // would pin the speed of the CI runner rather than this function.
    let content = '';
    for (let i = 0; i < 800; i++) {
      content += `<p>Paragraph ${i} of prose about alpha and beta, long enough to resemble a real note, with alpha twice.</p>`;
    }
    const editor = editorWith(content);

    const started = performance.now();
    setFindQuery(editor, 'alpha');
    const elapsed = performance.now() - started;

    expect(getFindReplaceState(editor).matches).toHaveLength(1600);
    expect(elapsed).toBeLessThan(2000);
    editor.destroy();
  });

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
