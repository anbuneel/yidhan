/**
 * validation.test.ts — Phase 2a
 *
 * Tests input validation for note titles and content.
 * Pure functions — no mocking needed.
 */

import { describe, it, expect } from 'vitest';
import {
  validateNoteTitle,
  validateNoteContentLength,
  MAX_NOTE_TITLE_LENGTH,
  MAX_NOTE_CONTENT_LENGTH,
} from './validation';

describe('validateNoteTitle', () => {
  it('should return empty string for empty input', () => {
    expect(validateNoteTitle('')).toBe('');
  });

  it('should return empty string for nullish input', () => {
    expect(validateNoteTitle(undefined as unknown as string)).toBe('');
  });

  it('should trim whitespace', () => {
    expect(validateNoteTitle('  Hello  ')).toBe('Hello');
  });

  it('should strip HTML tags from titles', () => {
    expect(validateNoteTitle('<b>Bold</b> title')).toBe('Bold title');
  });

  it('should strip script tags (XSS prevention)', () => {
    expect(validateNoteTitle('<script>alert("xss")</script>Title')).toBe('Title');
  });

  it('should handle complex HTML injection', () => {
    const xss = '<img src=x onerror=alert(1)>Note';
    const result = validateNoteTitle(xss);
    expect(result).not.toContain('<img');
    expect(result).not.toContain('onerror');
    expect(result).toContain('Note');
  });

  it('should allow plain text at the limit', () => {
    const atLimit = 'a'.repeat(MAX_NOTE_TITLE_LENGTH);
    expect(validateNoteTitle(atLimit)).toBe(atLimit);
  });

  it('should throw for titles exceeding max length', () => {
    const tooLong = 'a'.repeat(MAX_NOTE_TITLE_LENGTH + 1);
    expect(() => validateNoteTitle(tooLong)).toThrow(`Title must be less than ${MAX_NOTE_TITLE_LENGTH} characters`);
  });

  it('should handle unicode characters', () => {
    expect(validateNoteTitle('日本語のタイトル')).toBe('日本語のタイトル');
  });

  it('should handle emoji', () => {
    expect(validateNoteTitle('📝 My Notes')).toBe('📝 My Notes');
  });

  it('should handle whitespace-only input', () => {
    expect(validateNoteTitle('   ')).toBe('');
  });

  it('should handle HTML entities in input', () => {
    const result = validateNoteTitle('Tom &amp; Jerry');
    // DOMPurify strips tags; entity decoding depends on DOM environment
    expect(result).not.toContain('<');
    expect(result).toContain('Tom');
    expect(result).toContain('Jerry');
  });
});

describe('validateNoteContentLength', () => {
  it('should not throw for empty content', () => {
    expect(() => validateNoteContentLength('')).not.toThrow();
  });

  it('should not throw for nullish content', () => {
    expect(() => validateNoteContentLength(undefined as unknown as string)).not.toThrow();
  });

  it('should not throw for content at the limit', () => {
    const atLimit = 'x'.repeat(MAX_NOTE_CONTENT_LENGTH);
    expect(() => validateNoteContentLength(atLimit)).not.toThrow();
  });

  it('should throw for content exceeding the limit', () => {
    const tooLong = 'x'.repeat(MAX_NOTE_CONTENT_LENGTH + 1);
    expect(() => validateNoteContentLength(tooLong)).toThrow(
      `Content must be less than ${MAX_NOTE_CONTENT_LENGTH} characters`
    );
  });

  it('should not throw for normal-length content', () => {
    expect(() => validateNoteContentLength('<p>Hello world</p>')).not.toThrow();
  });
});
