// Markdown to HTML, for imports and for Markdown pasted into the editor. Its own
// module so the Editor can use it without the export and import code, which loads on
// the user's click (shell-size plan A5).
import { sanitizeHtml } from './sanitize';

/**
 * Convert Markdown to HTML (basic conversion)
 */
export function markdownToHtml(md: string): string {
  let pos = skipBlankLines(md, 0);
  if (!startsRawBlock(md, pos)) return convertMarkdownBody(md);

  // A leading raw-HTML block no longer swallows the file. htmlToMarkdown's
  // fallback stores a whole note as one such block with nothing after it, so
  // that still returns verbatim; a hand-authored file that merely opens with a
  // literal tag keeps the Markdown below it.
  //
  // Walked with an index rather than by recursing on the remainder. A valid
  // import may hold thousands of blank-line-separated blocks, and both
  // recursing and re-slicing copy what is left on every block, which is
  // quadratic — a file well under the 10MB import limit could stall the
  // import outright.
  // Each block is sanitized on its own, not as one joined string. Sanitizing
  // the run together lets HTML parsing nest an unclosed tag in one block over
  // the next — `<blockquote>unclosed` followed by `<p>next</p>` comes back as
  // `<blockquote>unclosed` alone, silently dropping the second block. Separate
  // passes also match CommonMark, which treats these as separate blocks.
  const parts: string[] = [];
  while (pos < md.length && startsRawBlock(md, pos)) {
    const end = rawBlockEnd(md, pos);
    parts.push(sanitizeHtml(md.slice(pos, end).trim()));
    pos = skipBlankLines(md, end);
  }
  if (pos < md.length) parts.push(convertMarkdownBody(md.slice(pos)));
  return parts.join('');
}

// The tag list mirrors htmlToMarkdown's fallback check — both describe the
// top-level nodes RichTextEditor's extensions can emit. Sticky rather than
// anchored so the scan can test at an offset without slicing.
const RAW_BLOCK_AT = /[ \t]*<(?:p|h[1-6]|ul|ol|pre|blockquote|hr)(?:\s|>|\/)/iy;
// Whole blank lines only — indentation on the first line of content is
// significant in Markdown, so trimming all leading whitespace would be wrong.
const BLANK_LINE_RUN_AT = /(?:[ \t]*\r?\n)+/y;
const BLANK_LINE_FROM = /\r?\n[ \t]*\r?\n/g;
const PRE_OPEN_AT = /[ \t]*<pre\b/iy;
const PRE_CLOSE_FROM = /<\/pre\s*>/gi;

function startsRawBlock(md: string, pos: number): boolean {
  RAW_BLOCK_AT.lastIndex = pos;
  return RAW_BLOCK_AT.test(md);
}

function skipBlankLines(md: string, pos: number): number {
  BLANK_LINE_RUN_AT.lastIndex = pos;
  return BLANK_LINE_RUN_AT.test(md) ? BLANK_LINE_RUN_AT.lastIndex : pos;
}

// Where the raw-HTML block starting at `pos` ends, per CommonMark's two
// relevant end conditions. `<pre>` is a type 1 block: it runs to its closing
// tag, so a blank line inside a code sample does not split it — treating it
// like the rest would cut the sample in half and escape the tags after the
// break into visible text. Everything else here is type 6: it ends at the
// first blank line. Both always advance past `pos`, since a block starts with
// a tag rather than a newline.
function rawBlockEnd(md: string, pos: number): number {
  PRE_OPEN_AT.lastIndex = pos;
  if (PRE_OPEN_AT.test(md)) {
    PRE_CLOSE_FROM.lastIndex = pos;
    const closing = PRE_CLOSE_FROM.exec(md);
    // An unclosed <pre> runs to the end of the input, as CommonMark specifies.
    return closing ? closing.index + closing[0].length : md.length;
  }
  BLANK_LINE_FROM.lastIndex = pos;
  const blankLine = BLANK_LINE_FROM.exec(md);
  return blankLine ? blankLine.index : md.length;
}

function convertMarkdownBody(md: string): string {
  let html = md;

  // Escape HTML
  html = html.replace(/&/g, '&amp;');
  html = html.replace(/</g, '&lt;');
  html = html.replace(/>/g, '&gt;');

  // Code blocks (before other processing)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code: string) => `<pre><code>${code.replace(/\n$/, '')}</code></pre>`);

  // Hold fenced blocks aside: everything below treats a newline as prose, and
  // the newlines inside a code block are part of the code.
  const fenced: string[] = [];
  html = html.replace(/<pre[\s\S]*?<\/pre>/gi, (block) => `\uE000FENCE${fenced.push(block) - 1}\uE000`);

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^(#{4,6}) (.*)$/gm, (_match, marks, text) => '<h' + marks.length + '>' + text + '</h' + marks.length + '>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>');

  // Horizontal rule
  html = html.replace(/^---$/gim, '<hr>');

  // Blockquotes
  html = html.replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>');

  // Task lists (must come before regular unordered lists)
  // Match lines like "- [ ] text" or "- [x] text"
  html = html.replace(/^- \[([ xX])\] (.*)$/gim, (_match, checked, text) => {
    const isChecked = checked.toLowerCase() === 'x';
    return `<li data-type="taskItem" data-checked="${isChecked}"><p>${text}</p></li>`;
  });
  // Wrap consecutive task items in taskList
  html = html.replace(/(?:<li data-type="taskItem"[^>]*>.*?<\/li>\n?)+/g, (items) => `<ul data-type="taskList">${items.replace(/\n+$/, '')}</ul>\n`);

  // Unordered lists (regular, without checkboxes)
  html = html.replace(/^- (?!\[[ xX]\])(.*)$/gim, '<li>$1</li>');
  html = html.replace(/(?:<li>(?!<p>).*<\/li>\n?)+/g, (items) => `<ul>${items.replace(/\n+$/, '')}</ul>\n`);

  // Ordered lists — marked so the unordered wrap above cannot claim them
  html = html.replace(/^\d+\. (.*$)/gim, '<li data-ordered>$1</li>');
  html = html.replace(/(?:<li data-ordered>.*?<\/li>\n?)+/g, (items) => `<ol>${items.replace(/\n+$/, '')}</ol>\n`);
  html = html.replace(/ data-ordered/g, '');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Paragraphs (lines that aren't already wrapped)
  const lines = html.split('\n\n');
  html = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('\uE000FENCE') ||
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<li') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<pre') ||
        trimmed.startsWith('<hr')) {
      return trimmed;
    }
    return `<p>${trimmed}</p>`;
  }).join('');

  // Line breaks within paragraphs. Newlines that merely separate block
  // elements are structure, not breaks, so drop those first.
  html = html.replace(/\n+(?=<\/?(?:li|ul|ol|blockquote|pre|h[1-6]|hr|p)\b)/g, '');
  html = html.replace(/\n/g, '<br>');

  return html.replace(/\uE000FENCE(\d+)\uE000/g, (_match, index: string) => fenced[Number(index)]);
}
