/**
 * Held saves (issue #288): words from a note the writer has left whose save failed.
 *
 * The Editor that held the words is gone, so they live here until Retry or Copy deals
 * with them. Memory only: never persisted, never exported. The entries are decrypted
 * text, so the store is cleared and closed whenever the vault locks or the user
 * changes.
 *
 * Every close starts a new session. A producer reads `session()` when its save starts
 * and passes it to `hold()`; an entry from an older session is refused even after the
 * store opens again, so a save that fails late can never put one vault's or one
 * user's words into the next one's notice.
 *
 * The store also lists the open Editors' flush functions, so a lock can save what is
 * on screen first.
 */
import { useSyncExternalStore } from 'react';

export interface HeldSave {
  /** The Editor instance that held the words. One entry per instance. */
  key: string;
  noteId: string;
  title: string;
  content: string;
  /** The stored text the words were written over, to tell whether the note changed since. */
  baseTitle: string;
  baseContent: string;
  attemptedAt: number;
  /** Error text that is safe to show, or ''. */
  detail: string;
}

/** An entry as stored: `revision` changes on every hold, so a release can name the one it handled. */
export interface StoredHeldSave extends HeldSave {
  revision: number;
}

type Listener = () => void;
/** Resolves true when what was on screen is saved. */
type Flusher = () => Promise<boolean>;

let entries: readonly StoredHeldSave[] = [];
let accepting = true;
let session = 0;
let revision = 0;
const listeners = new Set<Listener>();
const flushers = new Set<Flusher>();

function emit(next: readonly StoredHeldSave[]) {
  entries = next;
  listeners.forEach((listener) => listener());
}

export const heldSaves = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  getSnapshot(): readonly StoredHeldSave[] {
    return entries;
  },

  get(key: string): StoredHeldSave | undefined {
    return entries.find((entry) => entry.key === key);
  },

  /** The current vault session. Read it when a save starts; pass it to `hold`. */
  session(): number {
    return session;
  },

  /** True while words from `fromSession` may still be held or written. */
  isCurrent(fromSession: number): boolean {
    return accepting && fromSession === session;
  },

  /**
   * Hold words whose save failed. Replaces this instance's earlier entry. Refused
   * when the store is closed or the save started in an earlier session.
   */
  hold(entry: HeldSave, fromSession: number): void {
    if (!heldSaves.isCurrent(fromSession)) return;
    revision += 1;
    emit([...entries.filter((e) => e.key !== entry.key), { ...entry, revision }]);
  },

  /**
   * Drop an entry: its words were saved, copied, or kept as a new note. With a
   * revision, only that revision: a newer failure of the same Editor stays.
   */
  release(key: string, onlyRevision?: number): void {
    const entry = entries.find((e) => e.key === key);
    if (!entry || (onlyRevision !== undefined && entry.revision !== onlyRevision)) return;
    emit(entries.filter((e) => e.key !== key));
  },

  /** Vault locked or user gone: drop every entry, take no new ones, start a new session. */
  close(): number {
    const dropped = entries.length;
    accepting = false;
    session += 1;
    if (dropped > 0) emit([]);
    return dropped;
  },

  /** Vault unlocked for a signed-in user. */
  open(): void {
    accepting = true;
  },

  /** An open Editor registers how to save what it has on screen. */
  registerFlusher(flush: Flusher): () => void {
    flushers.add(flush);
    return () => { flushers.delete(flush); };
  },

  /** Save what every open Editor has on screen. Resolves true when all of it saved. */
  async flushOpenEditors(): Promise<boolean> {
    const results = await Promise.allSettled([...flushers].map((flush) => flush()));
    return results.every((r) => r.status === 'fulfilled' && r.value);
  },
};

export function useHeldSaves(): readonly StoredHeldSave[] {
  return useSyncExternalStore(heldSaves.subscribe, heldSaves.getSnapshot);
}

/** Test helper: an empty, open store. */
export function resetHeldSaves(): void {
  entries = [];
  accepting = true;
  session += 1;
  flushers.clear();
  listeners.forEach((listener) => listener());
}
