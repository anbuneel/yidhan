/**
 * Every whole-list reload from IndexedDB (issue #298): the Refresh button, conflict
 * resolution, the locked-note retry and import. Each one reads the whole library and
 * replaces the list. A read taken before a local change lands holds the old copy, so
 * each must take the same guard as the sync refresh (#297).
 *
 * These drive the real caller hooks wired to the real useNotesSync, as App wires them.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DerivedKeys } from '../lib/encryption';
import type { Note } from '../types';
import { withNotesFirst } from '../utils/notesFirst';

const mocks = vi.hoisted(() => ({
  onSyncComplete: undefined as (() => Promise<void> | void) | undefined,
  fetchDecryptedNotes: vi.fn(),
  createEncryptedNote: vi.fn(),
  resolveConflict: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock('../services/notes', () => ({
  cleanupExpiredFadedNotes: vi.fn().mockResolvedValue(0),
  subscribeToNotes: () => vi.fn(),
}));
vi.mock('../services/tags', () => ({ subscribeToTags: () => vi.fn() }));
vi.mock('../services/offlineNotes', () => ({
  countFadedNotesOffline: vi.fn().mockResolvedValue(0),
  upsertNoteFromServer: vi.fn(),
  deleteNoteFromServer: vi.fn(),
  upsertTagFromServer: vi.fn(),
  deleteTagFromServer: vi.fn(),
  addTagToNoteOffline: vi.fn(),
  getBlockedSyncReason: vi.fn(),
  retryBlockedSyncEntries: vi.fn(),
}));
vi.mock('../services/encryptedNotes', () => ({
  fetchDecryptedNotes: mocks.fetchDecryptedNotes,
  decryptNoteFromServer: vi.fn().mockImplementation(async (note: Note) => note),
  createEncryptedNote: mocks.createEncryptedNote,
  createEncryptedNotesBatch: vi.fn(),
}));
vi.mock('../services/offlineTags', () => ({
  fetchTagsOffline: vi.fn().mockResolvedValue([]),
  createTagOffline: vi.fn(),
}));
vi.mock('../services/noteTagSync', () => ({ subscribeToNoteTags: () => vi.fn() }));
vi.mock('./useStoragePersistence', () => ({ useStoragePersistence: vi.fn() }));
vi.mock('./useSyncEngine', () => ({
  useSyncEngine: (onSyncComplete?: () => Promise<void> | void) => {
    mocks.onSyncComplete = onSyncComplete;
    return { conflicts: [], removeConflict: vi.fn(), triggerSync: vi.fn() };
  },
  resolveConflict: mocks.resolveConflict,
}));
vi.mock('../services/syncEngine', () => ({
  invalidateSyncPullCursors: vi.fn(),
  reportConflict: vi.fn(),
}));
vi.mock('../utils/reliabilityTelemetry', () => ({ reportReliabilityIssue: vi.fn() }));

import { useNotesSync } from './useNotesSync';
import { useSyncActions } from './useSyncActions';
import { useLockedNotes } from './useLockedNotes';
import { useImport } from './useImport';

const KEYS = {
  encryptionKey: {} as CryptoKey,
  hashKey: {} as CryptoKey,
  salt: new Uint8Array(16),
  rawEncryptionKey: new Uint8Array(32),
  rawHashKey: new Uint8Array(32),
} satisfies DerivedKeys;
const USER = 'reload-user';

function note(id: string, title = id): Note {
  const now = new Date();
  return {
    id, userId: USER, title, content: '', pinned: false, tags: [], deletedAt: null,
    createdAt: now, updatedAt: now, syncStatus: 'synced',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const CONFLICT = {
  entityType: 'note', entityId: 'other', localVersion: {}, serverVersion: {},
} as unknown as Parameters<typeof useSyncActions>[0]['conflicts'][number];

function harness(initial: Note[]) {
  mocks.fetchDecryptedNotes.mockResolvedValue(initial);
  const openNoteIdRef = { current: null as string | null };
  const renders: string[][] = [];
  const triggerSync = vi.fn().mockResolvedValue({ outcome: 'ok' });
  const hook = renderHook(({ keys }: { keys: DerivedKeys | null }) => {
    const sync = useNotesSync({
      userId: USER, keys, isHydrating: false, openNoteIdRef, onOpenNoteRemoved: vi.fn(),
    });
    const syncActions = useSyncActions({
      userId: USER, keys, reloadFromStorage: sync.reloadFromStorage,
      conflicts: [CONFLICT], removeConflict: vi.fn(), triggerSync,
      openNoteIdRef, onOpenNoteClosed: vi.fn(),
    });
    const locked = useLockedNotes({
      openNote: undefined, userId: USER, keys,
      reloadFromStorage: sync.reloadFromStorage, onLockedNoteOpened: vi.fn(),
    });
    const importer = useImport({
      userId: USER, keys, notes: sync.notes, tags: sync.tags,
      setTags: sync.setTags, reloadFromStorage: sync.reloadFromStorage,
    });
    renders.push(sync.notes.map((n) => n.id));
    return { sync, syncActions, locked, importer };
  }, { initialProps: { keys: KEYS as DerivedKeys | null } });
  return { ...hook, renders };
}

type Harness = ReturnType<typeof harness>;

const PATHS: { name: string; start: (h: Harness) => Promise<unknown> }[] = [
  { name: 'the Refresh button', start: (h) => h.result.current.syncActions.handleRefresh() },
  { name: 'conflict resolution', start: (h) => h.result.current.syncActions.handleConflictResolve('local') },
  { name: 'the locked-note retry', start: (h) => h.result.current.locked.retryLockedNotes() },
  {
    name: 'an import',
    start: (h) => h.result.current.importer.handleImportFile(new File(['# Imported\n\nWords'], 'imported.md')),
  },
];

const ids = (notes: Note[]) => notes.map((n) => n.id).sort();

describe.each(PATHS)('whole-list reload: $name', ({ start }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveConflict.mockResolvedValue(undefined);
    mocks.createEncryptedNote.mockResolvedValue(note('imported'));
  });

  /** Start the reload and hold its first read until the test resolves it. */
  async function startHeldReload(h: Harness) {
    await waitFor(() => expect(h.result.current.sync.loading).toBe(false));
    await waitFor(() => expect(h.result.current.syncActions.activeConflict).not.toBeNull());
    const readsBefore = mocks.fetchDecryptedNotes.mock.calls.length;
    const staleRead = deferred<Note[]>();
    mocks.fetchDecryptedNotes.mockReturnValueOnce(staleRead.promise);
    let reload!: Promise<unknown>;
    act(() => { reload = start(h); });
    await waitFor(() => expect(mocks.fetchDecryptedNotes).toHaveBeenCalledTimes(readsBefore + 1));
    return { staleRead, reload };
  }

  it('keeps a note created while it was reading, and shows it once', async () => {
    const existing = note('existing');
    const created = note('created');
    const h = harness([existing]);
    const { staleRead, reload } = await startHeldReload(h);

    // handleNewNote: written to IndexedDB, then added to the list.
    mocks.fetchDecryptedNotes.mockResolvedValue([created, existing]);
    act(() => { h.result.current.sync.setNotes((prev) => withNotesFirst(prev, [created])); });
    const shownFrom = h.renders.length - 1;

    await act(async () => {
      staleRead.resolve([existing]);
      await reload;
    });

    await waitFor(() => expect(ids(h.result.current.sync.notes)).toEqual(['created', 'existing']));
    // One render without it is enough for App to close it as "no longer here".
    for (const render of h.renders.slice(shownFrom)) expect(render).toContain('created');
  });

  it('keeps an edit made while it was reading', async () => {
    const existing = note('existing', 'before');
    const h = harness([existing]);
    const { staleRead, reload } = await startHeldReload(h);

    // handleNoteUpdate: on screen first, then written.
    const write = deferred<void>();
    let saved!: Promise<void>;
    act(() => {
      saved = h.result.current.sync.applyOptimistic(
        (prev) => prev.map((n) => ({ ...n, title: 'after' })),
        () => write.promise
      );
    });

    await act(async () => { staleRead.resolve([existing]); });
    expect(h.result.current.sync.notes[0].title).toBe('after');

    mocks.fetchDecryptedNotes.mockResolvedValue([{ ...existing, title: 'after' }]);
    await act(async () => {
      write.resolve();
      await saved;
      await reload;
    });
    await waitFor(() => expect(mocks.fetchDecryptedNotes.mock.calls.length).toBeGreaterThan(2));
    expect(h.result.current.sync.notes.map((n) => n.title)).toEqual(['after']);
  });

  it('does not bring back a note deleted while it was reading', async () => {
    const existing = note('existing');
    const gone = note('gone');
    const h = harness([gone, existing]);
    const { staleRead, reload } = await startHeldReload(h);

    // handleNoteDelete: written to IndexedDB, then removed from the list.
    mocks.fetchDecryptedNotes.mockResolvedValue([existing]);
    act(() => { h.result.current.sync.setNotes((prev) => prev.filter((n) => n.id !== 'gone')); });

    await act(async () => {
      staleRead.resolve([gone, existing]);
      await reload;
    });
    expect(ids(h.result.current.sync.notes)).toEqual(['existing']);
    for (const render of h.renders.slice(-2)) expect(render).not.toContain('gone');
  });

  it('never puts decrypted notes back after the vault locks during it', async () => {
    const h = harness([note('secret')]);
    const { staleRead, reload } = await startHeldReload(h);
    const reads = mocks.fetchDecryptedNotes.mock.calls.length;

    h.rerender({ keys: null });
    await waitFor(() => expect(h.result.current.sync.notes).toEqual([]));

    await act(async () => {
      staleRead.resolve([note('secret')]);
      await reload;
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(h.result.current.sync.notes).toEqual([]);
    // No second read with the old keys either.
    expect(mocks.fetchDecryptedNotes).toHaveBeenCalledTimes(reads);
  });
});

describe('the first load against a refresh', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('does not overwrite a newer refresh that landed while it read', async () => {
    const firstRead = deferred<Note[]>();
    mocks.fetchDecryptedNotes.mockReturnValueOnce(firstRead.promise);
    const h = harness([]);
    await waitFor(() => expect(mocks.fetchDecryptedNotes).toHaveBeenCalledTimes(1));

    mocks.fetchDecryptedNotes.mockResolvedValue([note('pulled'), note('existing')]);
    await act(async () => { await mocks.onSyncComplete?.(); });
    expect(ids(h.result.current.sync.notes)).toEqual(['existing', 'pulled']);

    await act(async () => { firstRead.resolve([note('existing')]); });
    expect(ids(h.result.current.sync.notes)).toEqual(['existing', 'pulled']);
    // Skipping the result must not leave the loader up.
    expect(h.result.current.sync.loading).toBe(false);
  });

  it('still applies when no refresh landed', async () => {
    const h = harness([note('existing')]);
    await waitFor(() => expect(h.result.current.sync.loading).toBe(false));
    expect(ids(h.result.current.sync.notes)).toEqual(['existing']);
  });
});
