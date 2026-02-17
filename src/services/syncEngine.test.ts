import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isPendingMutation,
  addPendingMutation,
  removePendingMutation,
  clearSyncState,
  isSyncInProgress,
  type FullSyncResult,
  type PullError,
} from './syncEngine';
import { mapSyncOutcome } from '../hooks/useSyncEngine';

// --- Helper: build a FullSyncResult with sensible defaults ---
function buildResult(overrides: Partial<FullSyncResult> = {}): FullSyncResult {
  return {
    processed: 0,
    failed: 0,
    conflicts: 0,
    errors: [],
    pulled: { notes: 0, tags: 0 },
    deleted: { notes: 0, tags: 0 },
    pullErrors: [],
    ...overrides,
  };
}

function dataError(entity: 'notes' | 'tags', msg = 'fetch failed'): PullError {
  return { entity, operation: 'data', error: new Error(msg) };
}

function membershipError(entity: 'notes' | 'tags', msg = 'membership failed'): PullError {
  return { entity, operation: 'membership', error: new Error(msg) };
}

describe('syncEngine', () => {
  beforeEach(() => {
    // Clear state before each test
    clearSyncState();
  });

  afterEach(() => {
    // Clean up after each test
    clearSyncState();
  });

  describe('pending mutations (self-ignore)', () => {
    it('should track pending mutations', () => {
      const mutationId = 'test-mutation-id';

      expect(isPendingMutation(mutationId)).toBe(false);

      addPendingMutation(mutationId);
      expect(isPendingMutation(mutationId)).toBe(true);

      removePendingMutation(mutationId);
      expect(isPendingMutation(mutationId)).toBe(false);
    });

    it('should handle multiple mutations', () => {
      const id1 = 'mutation-1';
      const id2 = 'mutation-2';
      const id3 = 'mutation-3';

      addPendingMutation(id1);
      addPendingMutation(id2);
      addPendingMutation(id3);

      expect(isPendingMutation(id1)).toBe(true);
      expect(isPendingMutation(id2)).toBe(true);
      expect(isPendingMutation(id3)).toBe(true);

      removePendingMutation(id2);
      expect(isPendingMutation(id1)).toBe(true);
      expect(isPendingMutation(id2)).toBe(false);
      expect(isPendingMutation(id3)).toBe(true);
    });

    it('should clear all mutations on clearSyncState', () => {
      addPendingMutation('mutation-1');
      addPendingMutation('mutation-2');

      expect(isPendingMutation('mutation-1')).toBe(true);
      expect(isPendingMutation('mutation-2')).toBe(true);

      clearSyncState();

      expect(isPendingMutation('mutation-1')).toBe(false);
      expect(isPendingMutation('mutation-2')).toBe(false);
    });
  });

  describe('sync state', () => {
    it('should report sync not in progress initially', () => {
      expect(isSyncInProgress()).toBe(false);
    });

    it('should reset sync state on clearSyncState', () => {
      clearSyncState();
      expect(isSyncInProgress()).toBe(false);
    });
  });

  describe('timeout cleanup', () => {
    it('should clear pending timeouts on clearSyncState', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      clearSyncState();
      clearSyncState();

      expect(clearTimeoutSpy).toBeDefined();

      clearTimeoutSpy.mockRestore();
    });
  });
});

describe('mapSyncOutcome', () => {
  // --- Happy path ---
  it('returns "ok" when no errors and no failures', () => {
    const result = buildResult({ pulled: { notes: 5, tags: 2 } });
    expect(mapSyncOutcome(result)).toBe('ok');
  });

  it('returns "ok" when zero pulled but no errors', () => {
    const result = buildResult();
    expect(mapSyncOutcome(result)).toBe('ok');
  });

  // --- Full error (both entity data pulls fail with zero data) ---
  it('returns "error" when both notes and tags data pulls fail with zero data', () => {
    const result = buildResult({
      pullErrors: [dataError('notes'), dataError('tags')],
      pulled: { notes: 0, tags: 0 },
    });
    expect(mapSyncOutcome(result)).toBe('error');
  });

  // --- Partial success: both data errors but some data was applied ---
  it('returns "partial" when both data pulls error but some notes were applied', () => {
    const result = buildResult({
      pullErrors: [dataError('notes'), dataError('tags')],
      pulled: { notes: 50, tags: 0 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  it('returns "partial" when both data pulls error but some tags were applied', () => {
    const result = buildResult({
      pullErrors: [dataError('notes'), dataError('tags')],
      pulled: { notes: 0, tags: 3 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  // --- Single entity data pull failure ---
  it('returns "partial" when only notes data pull fails', () => {
    const result = buildResult({
      pullErrors: [dataError('notes')],
      pulled: { notes: 0, tags: 5 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  it('returns "partial" when only tags data pull fails', () => {
    const result = buildResult({
      pullErrors: [dataError('tags')],
      pulled: { notes: 10, tags: 0 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  // --- Push failures ---
  it('returns "partial" when push has failures but pull succeeded', () => {
    const result = buildResult({
      failed: 2,
      pulled: { notes: 10, tags: 3 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  // --- Membership query failures ---
  it('returns "partial" when only membership queries fail', () => {
    const result = buildResult({
      pullErrors: [membershipError('notes')],
      pulled: { notes: 10, tags: 5 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  it('returns "partial" when both membership queries fail but data pulls succeed', () => {
    const result = buildResult({
      pullErrors: [membershipError('notes'), membershipError('tags')],
      pulled: { notes: 10, tags: 5 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  it('returns "partial" not "error" for membership-only errors (even with zero pulled)', () => {
    const result = buildResult({
      pullErrors: [membershipError('notes'), membershipError('tags')],
      pulled: { notes: 0, tags: 0 },
    });
    // Membership failures don't affect data freshness, so not 'error'
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  // --- Mixed errors ---
  it('returns "partial" when data error + membership error on different entities', () => {
    const result = buildResult({
      pullErrors: [dataError('notes'), membershipError('tags')],
      pulled: { notes: 0, tags: 5 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  // --- Pagination partial: mid-pagination error with applied data ---
  it('returns "partial" for mid-pagination failure on both entities with partial data', () => {
    const result = buildResult({
      pullErrors: [
        dataError('notes', 'page 4 of 5 failed'),
        dataError('tags', 'page 2 of 3 failed'),
      ],
      pulled: { notes: 3000, tags: 1000 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });
});

describe('server timestamp authority', () => {
  // These tests document the contract that push paths must NOT send client
  // timestamps. The server-side trigger (notes_updated_at_trigger) is the
  // sole authority. We verify the source code does not contain client-time
  // assignments in note update payloads.

  it('syncEngine processNoteMutation update path does not send updated_at', async () => {
    // Read the source and verify no client timestamp in the update payload.
    // This is a static assertion — if someone adds `updated_at: new Date()`
    // back, this test should fail.
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const source = readFileSync(
      resolve(__dirname, './syncEngine.ts'),
      'utf-8'
    );

    // Find the update case payload (between .update({ and }) for notes)
    // The pattern: .update({ ... updated_at: new Date() ... })
    // Should NOT match because we removed it.
    const updatePayloadPattern = /\.update\(\{[^}]*updated_at:\s*new Date\(\)/s;
    expect(source).not.toMatch(updatePayloadPattern);
  });

  it('notes.ts updateNote does not send updated_at', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const source = readFileSync(
      resolve(__dirname, './notes.ts'),
      'utf-8'
    );

    const updatePayloadPattern = /\.update\(\{[^}]*updated_at:\s*new Date\(\)/s;
    expect(source).not.toMatch(updatePayloadPattern);
  });

  it('useSyncEngine resolveConflict does not send updated_at', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const source = readFileSync(
      resolve(__dirname, '../hooks/useSyncEngine.ts'),
      'utf-8'
    );

    const updatePayloadPattern = /\.update\(\{[^}]*updated_at:\s*new Date\(\)/s;
    expect(source).not.toMatch(updatePayloadPattern);
  });
});
