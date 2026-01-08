import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

describe('useShareTarget', () => {
  let originalLocation: Location;

  beforeEach(async () => {
    vi.resetModules();

    // Store originals
    originalLocation = window.location;

    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    // Restore location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  function mockLocation(search: string) {
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        search,
        pathname: '/',
      },
      writable: true,
      configurable: true,
    });
    // Mock history.replaceState
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  }

  it('returns null when no share data present', async () => {
    mockLocation('');
    const { useShareTarget } = await import('./useShareTarget');
    const { result } = renderHook(() => useShareTarget());

    expect(result.current.sharedData).toBeNull();
    expect(result.current.hasStoredShare).toBe(false);
  });

  it('parses share data from URL params', async () => {
    mockLocation('?share=true&title=Test%20Title&text=Test%20text&url=https%3A%2F%2Fexample.com');
    const { useShareTarget } = await import('./useShareTarget');
    const { result } = renderHook(() => useShareTarget());

    expect(result.current.sharedData).toEqual({
      title: 'Test Title',
      text: 'Test text',
      url: 'https://example.com',
    });
    expect(result.current.hasStoredShare).toBe(true);
  });

  it('cleans URL after processing share data', async () => {
    mockLocation('?share=true&title=Test');
    const { useShareTarget } = await import('./useShareTarget');
    renderHook(() => useShareTarget());

    expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/');
  });

  it('clearSharedData removes data and updates state', async () => {
    mockLocation('?share=true&title=Test');
    const { useShareTarget } = await import('./useShareTarget');
    const { result } = renderHook(() => useShareTarget());

    expect(result.current.sharedData).not.toBeNull();

    act(() => {
      result.current.clearSharedData();
    });

    expect(result.current.sharedData).toBeNull();
    expect(result.current.hasStoredShare).toBe(false);
  });

  it('ignores share=true without any content', async () => {
    mockLocation('?share=true');
    const { useShareTarget } = await import('./useShareTarget');
    const { result } = renderHook(() => useShareTarget());

    expect(result.current.sharedData).toBeNull();
  });

  it('handles partial share data (title only)', async () => {
    mockLocation('?share=true&title=Just%20a%20title');
    const { useShareTarget } = await import('./useShareTarget');
    const { result } = renderHook(() => useShareTarget());

    expect(result.current.sharedData).toEqual({
      title: 'Just a title',
      text: null,
      url: null,
    });
  });

  it('handles partial share data (url only)', async () => {
    mockLocation('?share=true&url=https%3A%2F%2Fexample.com');
    const { useShareTarget } = await import('./useShareTarget');
    const { result } = renderHook(() => useShareTarget());

    expect(result.current.sharedData).toEqual({
      title: null,
      text: null,
      url: 'https://example.com',
    });
  });
});

describe('formatSharedContent', () => {
  it('formats title and text into note content', async () => {
    const { formatSharedContent } = await import('./useShareTarget');
    const result = formatSharedContent({
      title: 'My Title',
      text: 'Some text content',
      url: null,
    });

    expect(result.title).toBe('My Title');
    expect(result.content).toContain('Some text content');
  });

  it('creates clickable link for safe URLs', async () => {
    const { formatSharedContent } = await import('./useShareTarget');
    const result = formatSharedContent({
      title: null,
      text: null,
      url: 'https://example.com',
    });

    expect(result.content).toContain('href="https://example.com"');
    expect(result.content).toContain('<a');
  });

  it('escapes HTML in text content', async () => {
    const { formatSharedContent } = await import('./useShareTarget');
    const result = formatSharedContent({
      title: null,
      text: '<script>alert("xss")</script>',
      url: null,
    });

    expect(result.content).not.toContain('<script>');
    expect(result.content).toContain('&lt;script&gt;');
  });

  it('renders unsafe URLs as plain text (XSS prevention)', async () => {
    const { formatSharedContent } = await import('./useShareTarget');
    const result = formatSharedContent({
      title: null,
      text: null,
      url: 'javascript:alert("xss")',
    });

    // Should not create a link
    expect(result.content).not.toContain('href=');
    expect(result.content).not.toContain('<a');
    // Should still show the URL as escaped text
    expect(result.content).toContain('javascript:alert');
  });

  it('uses default title when none provided', async () => {
    const { formatSharedContent } = await import('./useShareTarget');
    const result = formatSharedContent({
      title: null,
      text: 'Some content',
      url: null,
    });

    expect(result.title).toBe('Shared note');
  });

  it('returns empty paragraph when no content', async () => {
    const { formatSharedContent } = await import('./useShareTarget');
    const result = formatSharedContent({
      title: 'Title Only',
      text: null,
      url: null,
    });

    expect(result.content).toBe('<p></p>');
  });

  it('combines text and URL', async () => {
    const { formatSharedContent } = await import('./useShareTarget');
    const result = formatSharedContent({
      title: 'Shared Link',
      text: 'Check this out',
      url: 'https://example.com',
    });

    expect(result.title).toBe('Shared Link');
    expect(result.content).toContain('Check this out');
    expect(result.content).toContain('href="https://example.com"');
  });
});
