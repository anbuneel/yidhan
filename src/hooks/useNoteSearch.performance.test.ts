import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createMockNote } from '../test/factories';
import { useNoteSearch } from './useNoteSearch';

// DOM sanitization is item 11's existing plaintext-cache cost. This fixture measures
// item 51's index build, incremental reconciliation, and query work in isolation.
vi.mock('../utils/sanitize', async (importOriginal) => {
  const original = await importOriginal<typeof import('../utils/sanitize')>();
  return { ...original, htmlToPlainText: (content: string) => content };
});

const TOPICS = [
  'harvest', 'lantern', 'meadow', 'riverbank', 'cedar',
  'weather', 'kitchen', 'journey', 'reading', 'garden',
];

function generateBenchmarkNotes(count: number) {
  return Array.from({ length: count }, (_, index) => createMockNote({
    id: `benchmark-${index}`,
    title: index % 25 === 0 ? `Harvest plan ${index}` : `Notebook entry ${index}`,
    content: `Field observation ${index} about ${TOPICS[index % TOPICS.length]} with marker${index} and a quiet closing sentence.`,
    contentHash: `benchmark-hash-${index}`,
  }));
}

function percentile(samples: number[], percentileRank: number): number {
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * percentileRank) - 1];
}

// Timing assertions are meaningful only when this file owns the process. The normal
// suite runs files in parallel, so opt in for the release measurement instead of
// turning unrelated CPU-heavy tests into search benchmark noise.
const performanceTest = process.env.RUN_SEARCH_BENCHMARK === '1' ? it : it.skip;

performanceTest('keeps 10k-note free-text search below the 200 ms p95 budget on the main thread', () => {
  const notes = generateBenchmarkNotes(10_000);
  const buildStarted = performance.now();
  const { result, rerender } = renderHook(
    ({ items, query }) => useNoteSearch(items, query),
    { initialProps: { items: notes, query: '' } }
  );
  const initialBuildMs = performance.now() - buildStarted;
  expect(result.current).toBe(notes);

  const queries = [
    'field', 'harvest', 'harvst', 'lantern', 'river',
    'quiet closing', 'marker9999', 'notebook',
  ];
  const querySamples = Array.from({ length: 40 }, (_, index) => {
    const started = performance.now();
    rerender({ items: notes, query: queries[index % queries.length] });
    return performance.now() - started;
  });
  const p95Ms = percentile(querySamples, 0.95);

  const edited = [...notes];
  edited[5_000] = {
    ...edited[5_000],
    title: 'Singular benchmark needle',
    contentHash: 'benchmark-hash-edited',
  };
  const updateStarted = performance.now();
  rerender({ items: edited, query: 'singular' });
  const incrementalUpdateMs = performance.now() - updateStarted;
  expect(result.current.map(({ id }) => id)).toEqual(['benchmark-5000']);

  console.info('search-index-benchmark', JSON.stringify({
    notes: notes.length,
    initialBuildMs: Number(initialBuildMs.toFixed(2)),
    incrementalUpdateMs: Number(incrementalUpdateMs.toFixed(2)),
    p95Ms: Number(p95Ms.toFixed(2)),
    maxMs: Number(Math.max(...querySamples).toFixed(2)),
    samples: querySamples.length,
  }));

  expect(p95Ms).toBeLessThan(200);
}, 60_000);
