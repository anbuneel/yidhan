// Copy a note to the clipboard. Kept apart from the export and import code, which
// loads on the user's click (shell-size plan A5): a held save's Copy action must work
// offline and at once, so this module stays in the app shell.
import type { Note } from '../types';
import { escapeHtml, sanitizeHtml } from './sanitize';

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
