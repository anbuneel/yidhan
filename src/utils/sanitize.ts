import DOMPurify from 'dompurify';

const ALLOWED_TEXT_ALIGN_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'blockquote']);
const ALLOWED_TEXT_ALIGN_VALUES = new Set(['left', 'right', 'center', 'justify']);

// Add a hook to ensure all external links (target="_blank") have rel="noopener noreferrer"
// This prevents reverse tabnabbing attacks where the new page can access the original page's window object
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (!('tagName' in node) || !('getAttribute' in node) || !('setAttribute' in node) || !('removeAttribute' in node)) {
    return;
  }

  const tagName = node.tagName.toLowerCase();

  // Strip presentational classes from rendered note HTML.
  if (node.getAttribute('class')) {
    node.removeAttribute('class');
  }

  // Only preserve a narrow text-align style on block content elements.
  const style = node.getAttribute('style');
  if (style) {
    const match = style.trim().match(/^text-align\s*:\s*(left|right|center|justify)\s*;?$/i);
    const normalizedValue = match?.[1].toLowerCase();

    if (normalizedValue && ALLOWED_TEXT_ALIGN_TAGS.has(tagName) && ALLOWED_TEXT_ALIGN_VALUES.has(normalizedValue)) {
      node.setAttribute('style', `text-align: ${normalizedValue};`);
    } else {
      node.removeAttribute('style');
    }
  }

  if (tagName === 'a' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Allows safe HTML tags from Tiptap editor (formatting, lists, etc.)
 * but strips dangerous elements like scripts and event handlers.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      // Text formatting
      'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'mark',
      // Headings
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      // Lists (including task list elements)
      'ul', 'ol', 'li', 'label', 'input',
      // Quotes and blocks
      'blockquote', 'hr',
      // Links (href will be sanitized)
      'a',
      // Spans for styling
      'span', 'div',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'style',
      // Task list attributes (Tiptap)
      'data-type', 'data-checked', 'type', 'checked', 'disabled',
    ],
    // Force links to open safely
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
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
 * Use with innerHTML-based rendering (for HTML context).
 */
export function sanitizeText(text: string): string {
  // First strip any HTML tags, then escape remaining special chars
  const stripped = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
  return escapeHtml(stripped);
}

/**
 * Convert HTML to plain text (strips tags, decodes entities).
 * Use for text node rendering (React will handle escaping).
 * Avoids double-escaping that occurs with sanitizeText + text nodes.
 */
export function htmlToPlainText(html: string): string {
  // Strip HTML tags but decode entities (DOMPurify decodes &amp; → &)
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
}
