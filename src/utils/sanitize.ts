import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Allows safe HTML tags from Tiptap editor (formatting, lists, etc.)
 * but strips dangerous elements like scripts and event handlers.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      // Text formatting
      'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
      // Headings
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      // Lists
      'ul', 'ol', 'li',
      // Quotes and blocks
      'blockquote', 'hr',
      // Links (href will be sanitized)
      'a',
      // Spans for styling
      'span', 'div',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'style',
    ],
    // Force links to open safely
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  });
}

/**
 * Sanitize plain text by escaping HTML special characters.
 * Use this for user-provided text that should NOT contain HTML (e.g., titles, tag names).
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

/**
 * Sanitize a plain text string for safe display.
 * Strips any HTML tags and escapes special characters.
 */
export function sanitizeText(text: string): string {
  // First strip any HTML tags, then escape remaining special chars
  const stripped = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
  return escapeHtml(stripped);
}
