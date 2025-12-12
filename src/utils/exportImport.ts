import type { Note, Tag, TagColor } from '../types';
import { TAG_COLORS } from '../types';

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
  createdAt: string;
  updatedAt: string;
}

interface ExportedTag {
  name: string;
  color: string;
}

interface ExportData {
  version: 1;
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

  // Dates: optional, use current date if invalid
  const now = new Date().toISOString();
  const createdAt = isValidDateString(n.createdAt) ? (n.createdAt as string) : now;
  const updatedAt = isValidDateString(n.updatedAt) ? (n.updatedAt as string) : now;

  return { title, content, tags, createdAt, updatedAt };
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
export function exportNotesToJSON(notes: Note[], tags: Tag[]): string {
  const exportData: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: notes.map((note) => ({
      title: note.title,
      content: note.content,
      tags: note.tags.map((t) => t.name),
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
  if (d.version !== 1) {
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
    version: 1,
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
  let md = html;

  // Headers
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');

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

  // Code
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n\n');
  md = md.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n\n');

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

  // Unordered lists
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

  return md;
}

/**
 * Convert Markdown to HTML (basic conversion)
 */
export function markdownToHtml(md: string): string {
  let html = md;

  // Escape HTML
  html = html.replace(/&/g, '&amp;');
  html = html.replace(/</g, '&lt;');
  html = html.replace(/>/g, '&gt;');

  // Code blocks (before other processing)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
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
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Unordered lists
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Paragraphs (lines that aren't already wrapped)
  const lines = html.split('\n\n');
  html = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<h') ||
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

  // Line breaks within paragraphs
  html = html.replace(/\n/g, '<br>');

  return html;
}

/**
 * Export a single note to Markdown
 */
export function exportNoteToMarkdown(note: Note): string {
  let md = '';

  // Title
  if (note.title) {
    md += `# ${note.title}\n\n`;
  }

  // Tags as frontmatter-style
  if (note.tags.length > 0) {
    md += `Tags: ${note.tags.map(t => t.name).join(', ')}\n\n`;
  }

  // Content
  md += htmlToMarkdown(note.content);

  return md;
}

/**
 * Export all notes to Markdown (as a single combined file or for zip)
 */
export function exportAllNotesToMarkdown(notes: Note[]): { filename: string; content: string }[] {
  return notes.map((note, index) => {
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
 * Create and download a zip file containing multiple markdown files
 */
export async function downloadMarkdownZip(notes: Note[]): Promise<void> {
  const files = exportAllNotesToMarkdown(notes);

  // For simplicity, we'll create a combined markdown file
  // A proper zip would require a library like JSZip
  const combined = files.map(f =>
    `---\n# ${f.filename.replace('.md', '')}\n---\n\n${f.content}`
  ).join('\n\n---\n\n');

  const date = new Date().toISOString().split('T')[0];
  downloadFile(combined, `zenote-export-${date}.md`, 'text/markdown');
}
