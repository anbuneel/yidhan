import type { Note, Tag, TagColor } from '../types';
import { TAG_COLORS } from '../types';
import { escapeHtml, sanitizeHtml } from './sanitize';

// Maximum file size for imports (10MB)
export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

// Maximum number of notes that can be imported at once
export const MAX_IMPORT_NOTES = 1000;

// Maximum length for note title and tag name
export const MAX_TITLE_LENGTH = 500;
export const MAX_TAG_NAME_LENGTH = 20;

// JSON Export/Import types
interface ExportedNote {
  title: string;
  content: string;
  tags: string[]; // Tag names
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ExportedTag {
  name: string;
  color: string;
}

interface ExportData {
  version: 1 | 2;
  exportedAt: string;
  notes: ExportedNote[];
  tags: ExportedTag[];
}

// Validation error class for better error handling
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate that a value is a non-empty string
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Validate that a value is a valid ISO date string
 */
function isValidDateString(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

function sanitizeImportedDate(value: unknown, nowMs: number): number {
  if (!isValidDateString(value)) {
    return nowMs;
  }

  const timestamp = new Date(value as string).getTime();
  return Math.min(timestamp, nowMs);
}

/**
 * Validate that a color is a valid TagColor
 */
function isValidTagColor(color: unknown): color is TagColor {
  return typeof color === 'string' && color in TAG_COLORS;
}

/**
 * Validate and sanitize an exported note
 */
function validateExportedNote(note: unknown, index: number): ExportedNote {
  if (!note || typeof note !== 'object') {
    throw new ValidationError(`Note at index ${index} is invalid`);
  }

  const n = note as Record<string, unknown>;

  // Title: required string, truncate if too long
  if (!isNonEmptyString(n.title)) {
    throw new ValidationError(`Note at index ${index} has invalid title`);
  }
  const title = n.title.slice(0, MAX_TITLE_LENGTH);

  // Content: required string (can be empty)
  if (typeof n.content !== 'string') {
    throw new ValidationError(`Note at index ${index} has invalid content`);
  }
  const content = n.content;

  // Tags: optional array of strings
  let tags: string[] = [];
  if (Array.isArray(n.tags)) {
    tags = n.tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.slice(0, MAX_TAG_NAME_LENGTH));
  }

  // Dates: optional, use current date if invalid, and never trust future values.
  const nowMs = Date.now();
  const createdAtMs = sanitizeImportedDate(n.createdAt, nowMs);
  const updatedAtMs = Math.max(createdAtMs, sanitizeImportedDate(n.updatedAt, nowMs));
  const createdAt = new Date(createdAtMs).toISOString();
  const updatedAt = new Date(updatedAtMs).toISOString();

  return { title, content, tags, pinned: n.pinned === true, createdAt, updatedAt };
}

/**
 * Validate and sanitize an exported tag
 */
function validateExportedTag(tag: unknown, index: number): ExportedTag {
  if (!tag || typeof tag !== 'object') {
    throw new ValidationError(`Tag at index ${index} is invalid`);
  }

  const t = tag as Record<string, unknown>;

  // Name: required non-empty string
  if (!isNonEmptyString(t.name) || t.name.trim().length === 0) {
    throw new ValidationError(`Tag at index ${index} has invalid name`);
  }
  const name = t.name.trim().slice(0, MAX_TAG_NAME_LENGTH);

  // Color: must be valid, default to 'stone' if invalid
  const color = isValidTagColor(t.color) ? t.color : 'stone';

  return { name, color };
}

/**
 * Export notes to JSON format
 */
/**
 * Split notes into the ones an export can carry and the ones it cannot (item 41).
 *
 * A note whose ciphertext would not open has no title and no content to write, so
 * including it would put an empty note in the file where the reader's words should be.
 * It is left out — and the count is returned so the caller can say so, rather than
 * handing over a file that is quietly short.
 */
export interface ExportableNotes {
  exportable: Note[];
  /** Notes left out because they could not be decrypted. */
  omittedCount: number;
}

export function partitionExportableNotes(notes: Note[]): ExportableNotes {
  const exportable = notes.filter((note) => !note.decryptionFailed);
  return { exportable, omittedCount: notes.length - exportable.length };
}

/** The sentence to show when an export left notes behind. Empty when it did not. */
export function describeOmittedNotes(omittedCount: number): string {
  if (omittedCount <= 0) return '';
  return omittedCount === 1
    ? '1 note could not be included — it could not be opened on this device.'
    : `${omittedCount} notes could not be included — they could not be opened on this device.`;
}

export function exportNotesToJSON(notes: Note[], tags: Tag[]): string {
  const { exportable } = partitionExportableNotes(notes);

  const exportData: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: exportable.map((note) => ({
      title: note.title,
      content: note.content,
      tags: note.tags.map((t) => t.name),
      pinned: note.pinned,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
    tags: tags.map((tag) => ({
      name: tag.name,
      color: tag.color,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Full account export interface (version 2)
 * Includes profile info, notes, tags, and share links
 */
export interface FullAccountExport {
  version: 2;
  exportedAt: string;
  profile: {
    displayName: string | null;
    email: string;
  };
  notes: Array<{
    title: string;
    content: string;
    tags: string[];
    pinned: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  tags: ExportedTag[];
  shareLinks: Array<{
    noteTitle: string;
    noteId: string;
    token: string;
    expiresAt: string | null;
    createdAt: string;
  }>;
}

/**
 * Export full account data including profile, notes, tags, and share links
 * Used during offboarding ("Letting Go") for complete data backup
 */
export function exportFullAccountData(
  notes: Note[],
  tags: Tag[],
  shareLinks: Array<{
    noteTitle: string;
    noteId: string;
    token: string;
    expiresAt: string | null;
    createdAt: string;
  }>,
  profile: { displayName: string | null; email: string }
): string {
  const { exportable } = partitionExportableNotes(notes);

  const exportData: FullAccountExport = {
    version: 2,
    exportedAt: new Date().toISOString(),
    profile: {
      displayName: profile.displayName,
      email: profile.email,
    },
    notes: exportable.map((note) => ({
      title: note.title,
      content: note.content,
      tags: note.tags.map((t) => t.name),
      pinned: note.pinned,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
    tags: tags.map((tag) => ({
      name: tag.name,
      color: tag.color,
    })),
    shareLinks: shareLinks.map((share) => ({
      noteTitle: notes.find(note => note.id === share.noteId)?.title || 'Untitled',
      noteId: share.noteId,
      token: share.token,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Download a string as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse and validate imported JSON data.
 * Performs strict validation on all fields to prevent data corruption and security issues.
 * @throws {ValidationError} If the data is invalid
 */
export function parseImportedJSON(jsonString: string): ExportData {
  let data: unknown;

  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new ValidationError('Invalid JSON format');
  }

  if (!data || typeof data !== 'object') {
    throw new ValidationError('Invalid export format: expected an object');
  }

  const d = data as Record<string, unknown>;

  // Validate version
  if (d.version !== 1 && d.version !== 2) {
    throw new ValidationError('Invalid or unsupported export version');
  }

  // Validate notes array
  if (!Array.isArray(d.notes)) {
    throw new ValidationError('Invalid export format: notes must be an array');
  }

  if (d.notes.length > MAX_IMPORT_NOTES) {
    throw new ValidationError(`Too many notes: maximum ${MAX_IMPORT_NOTES} allowed`);
  }

  // Validate and sanitize each note
  const notes: ExportedNote[] = d.notes.map((note, index) =>
    validateExportedNote(note, index)
  );

  // Validate tags array (optional, default to empty)
  let tags: ExportedTag[] = [];
  if (Array.isArray(d.tags)) {
    tags = d.tags.map((tag, index) => validateExportedTag(tag, index));
  }

  // Validate exportedAt (optional)
  const exportedAt = isValidDateString(d.exportedAt)
    ? (d.exportedAt as string)
    : new Date().toISOString();

  return {
    version: d.version,
    exportedAt,
    notes,
    tags,
  };
}

/**
 * Read file contents as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Convert HTML to Markdown (basic conversion)
 */
export function htmlToMarkdown(html: string): string {
  const original = sanitizeHtml(html);
  let md = html;

  // Headers
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');

  md = md.replace(/<h([4-6])[^>]*>(.*?)<\/h\1>/gi, (_match, level, text) => '#'.repeat(Number(level)) + ' ' + text + '\n\n');

  // Bold and italic
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Underline (no markdown equivalent, use HTML)
  md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, '<u>$1</u>');

  // Strikethrough
  md = md.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~');
  md = md.replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~');

  // Code — fenced blocks first, or the inline rule consumes the <code> inside
  // <pre> and leaves a block that can never match.
  md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n\n');
  md = md.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n\n');
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

  // Task lists (Tiptap format: ul[data-type="taskList"] with li[data-type="taskItem"])
  md = md.replace(/<ul[^>]*data-type="taskList"[^>]*>([\s\S]*?)<\/ul>/gi, (_match, content) => {
    const items = content.match(/<li[^>]*data-type="taskItem"[^>]*>([\s\S]*?)<\/li>/gi) || [];
    return items.map((item: string) => {
      const isChecked = /data-checked="true"/i.test(item);
      const text = item.replace(/<li[^>]*>([\s\S]*?)<\/li>/i, '$1').trim();
      // Remove any nested label/div/p tags that Tiptap might add
      const cleanText = text.replace(/<[^>]+>/g, '').trim();
      return `- [${isChecked ? 'x' : ' '}] ${cleanText}`;
    }).join('\n') + '\n\n';
  });

  // Ordered lists
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_match, content) => {
    let index = 0;
    const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    return items.map((item: string) => {
      index++;
      const text = item.replace(/<li[^>]*>([\s\S]*?)<\/li>/i, '$1').trim();
      return `${index}. ${text}`;
    }).join('\n') + '\n\n';
  });

  // Unordered lists (must come after task lists to not interfere)
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_match, content) => {
    const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    return items.map((item: string) => {
      const text = item.replace(/<li[^>]*>([\s\S]*?)<\/li>/i, '$1').trim();
      return `- ${text}`;
    }).join('\n') + '\n\n';
  });

  // Blockquote
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_match, content) => {
    return content.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n\n';
  });

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Paragraphs and line breaks
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n\n');

  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');

  // Clean up extra whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();

  // Markdown permits raw HTML. Keep a sanitized block when the basic serializer
  // cannot preserve it (marks, alignment, nested structures, whitespace).
  // The tag list must match the top-level nodes RichTextEditor's extensions can
  // produce; a new block type added there without being added here would skip
  // this check silently and export corrupted Markdown.
  if (/^<(?:p|h[1-6]|ul|ol|pre|blockquote|hr)(?:\s|>)/i.test(original) &&
      sanitizeHtml(markdownToHtml(md)) !== original) return original;
  return md;
}

/**
 * Convert Markdown to HTML (basic conversion)
 */
export function markdownToHtml(md: string): string {
  if (/^\s*<(?:p|h[1-6]|ul|ol|pre|blockquote|hr)(?:\s|>)/i.test(md)) return sanitizeHtml(md.trim());
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

/**
 * Export a single note to JSON format
 */
export function exportNoteToJSON(note: Note): string {
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    note: {
      title: note.title,
      content: note.content,
      tags: note.tags.map(t => t.name),
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    },
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Get sanitized filename for a note (used for downloads)
 */
export function getSanitizedFilename(title: string): string {
  return (title || 'Untitled')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50) || 'Untitled';
}

/**
 * Export a single note to Markdown (uses same format as bulk export for consistency)
 * Format: ---\n# Title\nTags: ...\n---\n\ncontent
 */
export function exportNoteToMarkdown(note: Note): string {
  const title = note.title || 'Untitled';
  const tags = note.tags.length > 0 ? `\nTags: ${note.tags.map(t => t.name).join(', ')}` : '';
  const content = htmlToMarkdown(note.content);

  return `---\n# ${title}${tags}\n---\n\n${content}`;
}

/**
 * Export all notes to Markdown (as individual files)
 */
export function exportAllNotesToMarkdown(notes: Note[]): { filename: string; content: string }[] {
  return partitionExportableNotes(notes).exportable.map((note, index) => {
    const sanitizedTitle = (note.title || `Untitled-${index + 1}`)
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);

    return {
      filename: `${sanitizedTitle}.md`,
      content: exportNoteToMarkdown(note),
    };
  });
}

/**
 * Create and download a combined markdown file with all notes
 */
export async function downloadMarkdownZip(notes: Note[]): Promise<void> {
  const { exportable } = partitionExportableNotes(notes);

  // Each note uses the same format, joined by separator
  const combined = exportable.map(note => exportNoteToMarkdown(note)).join('\n\n---\n\n');

  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS
  downloadFile(combined, `yidhan-export-${date}-${time}.md`, 'text/markdown');
}

/**
 * Parsed note from combined markdown export
 */
export interface ParsedMarkdownNote {
  title: string;
  content: string;
  tags: string[];
}

/**
 * Parse a combined markdown export file back into individual notes.
 * Returns an array of parsed notes, or null if the file is not in combined format.
 *
 * Combined format:
 * ---
 * # Note Title
 * Tags: tag1, tag2
 * ---
 *
 * content...
 *
 * ---
 *
 * ---
 * # Another Note
 * ---
 *
 * content...
 */
export function parseMultiNoteMarkdown(content: string): ParsedMarkdownNote[] | null {
  // Check if this looks like a combined export (starts with the note header pattern)
  if (!content.startsWith('---\n# ')) {
    return null; // Not a combined format
  }

  const notes: ParsedMarkdownNote[] = [];

  // Split by the note separator pattern
  // Each note block ends with content, then \n\n---\n\n before next note's ---\n#
  const noteBlocks = content.split(/\n\n---\n\n(?=---\n# )/);

  for (const block of noteBlocks) {
    // Each block is: ---\n# Title\n[Tags: ...]\n---\n\ncontent
    // The Tags line is optional
    const match = block.match(/^---\n# (.+)\n(?:Tags: ([^\n]*)\n)?---\n\n([\s\S]*)$/);
    if (match) {
      const title = match[1].trim();
      const tagsLine = match[2] || '';
      const noteContent = match[3].trim();

      // Parse tags from comma-separated list
      const tags = tagsLine
        ? tagsLine.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : [];

      notes.push({
        title,
        content: noteContent,
        tags,
      });
    }
  }

  return notes.length > 0 ? notes : null;
}

/**
 * Convert HTML content to clean plain text
 */
export function htmlToPlainText(html: string): string {
  // Create a temporary DOM element to parse HTML
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Handle task list checkboxes
  doc.querySelectorAll('li[data-type="taskItem"]').forEach((li) => {
    const isChecked = li.getAttribute('data-checked') === 'true';
    const checkbox = isChecked ? '[x] ' : '[ ] ';
    li.insertBefore(document.createTextNode(checkbox), li.firstChild);
  });

  // Handle list items with bullets/numbers
  doc.querySelectorAll('ul:not([data-type="taskList"]) > li').forEach((li) => {
    li.insertBefore(document.createTextNode('• '), li.firstChild);
  });

  let counter = 0;
  doc.querySelectorAll('ol > li').forEach((li) => {
    counter++;
    li.insertBefore(document.createTextNode(`${counter}. `), li.firstChild);
  });

  // Handle blockquotes
  doc.querySelectorAll('blockquote').forEach((bq) => {
    const lines = (bq.textContent || '').split('\n');
    bq.textContent = lines.map((line) => `> ${line}`).join('\n');
  });

  // Handle horizontal rules
  doc.querySelectorAll('hr').forEach((hr) => {
    hr.replaceWith(document.createTextNode('\n---\n'));
  });

  // Get text content and clean up whitespace
  let text = doc.body.textContent || '';

  // Normalize whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

/**
 * Format a note for clipboard (plain text format)
 */
export function formatNoteForClipboard(note: Note): string {
  const title = note.title || 'Untitled';
  const tags =
    note.tags.length > 0
      ? `Tags: ${note.tags.map((t) => t.name).join(', ')}\n\n`
      : '';
  const content = htmlToPlainText(note.content);

  return `${title}\n\n${tags}${content}`;
}

/**
 * Format a note for clipboard with HTML formatting
 */
export function formatNoteForClipboardHtml(note: Note): string {
  const title = escapeHtml(note.title || 'Untitled');
  const tagsHtml =
    note.tags.length > 0
      ? `<p style="color: #666; font-size: 0.9em;">Tags: ${note.tags.map((t) => escapeHtml(t.name)).join(', ')}</p>`
      : '';
  const content = sanitizeHtml(note.content);

  return `<h1>${title}</h1>${tagsHtml}${content}`;
}

/**
 * Copy note to clipboard as plain text
 */
export async function copyNoteToClipboard(note: Note): Promise<void> {
  const text = formatNoteForClipboard(note);
  await navigator.clipboard.writeText(text);
}

/**
 * Copy note to clipboard with HTML formatting (for rich paste targets)
 */
export async function copyNoteWithFormatting(note: Note): Promise<void> {
  const plainText = formatNoteForClipboard(note);
  const html = formatNoteForClipboardHtml(note);

  // Use ClipboardItem API to provide both formats
  const clipboardItem = new ClipboardItem({
    'text/plain': new Blob([plainText], { type: 'text/plain' }),
    'text/html': new Blob([html], { type: 'text/html' }),
  });

  await navigator.clipboard.write([clipboardItem]);
}
