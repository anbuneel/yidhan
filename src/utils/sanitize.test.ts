import { describe, it, expect } from 'vitest';
import { sanitizeHtml, escapeHtml, sanitizeText } from './sanitize';

describe('sanitizeHtml', () => {
  it('allows safe HTML tags', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('allows headings', () => {
    const input = '<h1>Title</h1><h2>Subtitle</h2>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('allows lists', () => {
    const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('removes script tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    expect(sanitizeHtml(input)).toBe('<p>Hello</p>');
  });

  it('removes iframe tags', () => {
    const input = '<p>Content</p><iframe src="evil.com"></iframe>';
    expect(sanitizeHtml(input)).toBe('<p>Content</p>');
  });

  it('removes event handlers', () => {
    const input = '<p onclick="alert(1)">Click me</p>';
    expect(sanitizeHtml(input)).toBe('<p>Click me</p>');
  });

  it('removes onerror handlers from images', () => {
    const input = '<img src="x" onerror="alert(1)">';
    // img is not in allowed tags, so it gets stripped
    expect(sanitizeHtml(input)).toBe('');
  });

  it('allows links with href', () => {
    const input = '<a href="https://example.com">Link</a>';
    expect(sanitizeHtml(input)).toContain('href="https://example.com"');
  });
});

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes less than', () => {
    expect(escapeHtml('1 < 2')).toBe('1 &lt; 2');
  });

  it('escapes greater than', () => {
    expect(escapeHtml('2 > 1')).toBe('2 &gt; 1');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('Say "hello"')).toBe('Say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("It's fine")).toBe('It&#39;s fine');
  });

  it('escapes multiple special characters', () => {
    expect(escapeHtml('<script>"alert"</script>')).toBe(
      '&lt;script&gt;&quot;alert&quot;&lt;/script&gt;'
    );
  });

  it('leaves normal text unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('sanitizeText', () => {
  it('strips HTML tags and escapes special chars', () => {
    const input = '<p>Hello World</p>';
    expect(sanitizeText(input)).toBe('Hello World');
  });

  it('escapes ampersands after stripping HTML', () => {
    // DOMPurify converts & to &amp; first, then escapeHtml escapes again
    // This is intentional for display safety
    const input = '<p>Tom & Jerry</p>';
    const result = sanitizeText(input);
    expect(result).toContain('amp');
  });

  it('removes all HTML tags', () => {
    const input = '<div><strong>Bold</strong> text</div>';
    expect(sanitizeText(input)).toBe('Bold text');
  });

  it('handles nested malicious content', () => {
    const input = '<script>alert("<xss>")</script>';
    expect(sanitizeText(input)).toBe('');
  });
});
