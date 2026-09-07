import { expect, it } from 'vitest';
import { htmlToMarkdown, markdownToHtml, exportFullAccountData, parseImportedJSON } from './exportImport';
import { sanitizeHtml } from './sanitize';
import { createMockNote, createMockTag } from '../test/factories';
it('roundtrips combinations of editor blocks, alignment, marks, Unicode and escaped punctuation', () => {
  const texts = ['Quiet &amp; warm', 'வணக்கம்', 'words * _ [ ]', '&lt;not a tag&gt;'];
  const marks = ['', 'strong', 'em', 'u', 'mark', 's', 'code'];
  for (const block of ['p','h1','h2','h3','h4','h5','h6']) for (const align of ['', 'left','center','right','justify']) {
    const mark = marks[(['p','h1','h2','h3','h4','h5','h6'].indexOf(block) + ['', 'left','center','right','justify'].indexOf(align)) % marks.length];
    const text = texts[(marks.indexOf(mark) + block.length + align.length) % texts.length];
    const body = mark ? '<'+mark+'>'+text+'</'+mark+'>' : text;
    const html = '<'+block+(align ? ' style="text-align: '+align+';"' : '')+'>'+body+'</'+block+'>';
    expect(sanitizeHtml(markdownToHtml(htmlToMarkdown(html)))).toBe(sanitizeHtml(html));
  }
  for (const html of ['<p><u><mark>Both</mark></u></p><p></p>', '<ul><li><p>Outer</p><ul><li><p>Inner</p></li></ul></li></ul>', '<ol start="4"><li><p>Fourth</p></li></ol>', '<pre><code>line 1\nline 2 * &lt;safe&gt;</code></pre>', '<p>One<br>Two</p><hr>', '<p><a href="https://example.com">Example</a></p>']) {
    expect(sanitizeHtml(markdownToHtml(htmlToMarkdown(html)))).toBe(sanitizeHtml(html));
  }
}, 20000);
it('accepts a full v2 backup without losing note metadata and labels shares from decrypted titles', () => {
  const tag = createMockTag({ name: 'Journal' });
  const notes = [createMockNote({ id: 'one', title: 'Readable title', tags: [tag], pinned: true }), createMockNote({ id: 'two' })];
  const backup = exportFullAccountData(notes, [tag], [{ noteId: 'one', noteTitle: '', token: 'token', expiresAt: null, createdAt: notes[0].createdAt.toISOString() }], { email: 'fixture@example.com', displayName: null });
  expect(JSON.parse(backup).shareLinks[0].noteTitle).toBe('Readable title');
  const imported = parseImportedJSON(backup);
  expect(imported.notes).toHaveLength(2);
  expect(imported.notes[0]).toMatchObject({ title: notes[0].title, content: notes[0].content, tags: ['Journal'], pinned: true, createdAt: notes[0].createdAt.toISOString(), updatedAt: notes[0].updatedAt.toISOString() });
  expect(imported.tags).toEqual([{ name: tag.name, color: tag.color }]);
});
it('sanitizes raw HTML in Markdown instead of restoring scripts or unsafe attributes', () => {
  const html = markdownToHtml('<p onclick="alert(1)"><u>Safe</u><script>alert(1)</script></p>');
  expect(html).toBe('<p><u>Safe</u></p>');
});
