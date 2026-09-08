import { describe, expect, it } from 'vitest';
import { parseSearchQuery } from './searchQuery';

describe('parseSearchQuery', () => {
  it('separates every supported operator from the free-text remainder', () => {
    const parsed = parseSearchQuery(
      'tag:Journal is:pinned before:2026-03 after:2026-03-01 quiet "exact phrase"'
    );

    expect(parsed.filters).toEqual({
      tags: ['journal'],
      pinned: true,
      before: [{ value: '2026-03', precision: 'month' }],
      after: [{ value: '2026-03-01', precision: 'day' }],
    });
    expect(parsed.textTerms).toEqual([
      { value: 'quiet', normalized: 'quiet', quoted: false },
      { value: 'exact phrase', normalized: 'exact phrase', quoted: true },
    ]);
  });

  it('supports a quoted multi-word tag value', () => {
    expect(parseSearchQuery('tag:"Daily Journal"').filters.tags).toEqual(['daily journal']);
  });

  it('ignores malformed supported operators without turning them into text', () => {
    const parsed = parseSearchQuery('tag: before:notadate');
    expect(parsed.filters.tags).toEqual([]);
    expect(parsed.filters.before).toEqual([]);
    expect(parsed.textTerms).toEqual([]);
  });

  it('treats an operator inside a quoted phrase as literal text', () => {
    const parsed = parseSearchQuery('"tag:journal"');
    expect(parsed.filters.tags).toEqual([]);
    expect(parsed.textTerms).toEqual([
      { value: 'tag:journal', normalized: 'tag:journal', quoted: true },
    ]);
  });

  it('ignores impossible calendar dates', () => {
    const parsed = parseSearchQuery('before:2026-02-30 after:2026-13');
    expect(parsed.filters.before).toEqual([]);
    expect(parsed.filters.after).toEqual([]);
    expect(parsed.textTerms).toEqual([]);
  });
});
