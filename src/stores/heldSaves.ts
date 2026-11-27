/**
 * Held saves (issue #288): words from a note the writer has left whose save failed.
 *
 * The Editor that held the words is gone, so they live here until Retry or Copy deals
 * with them. Memory only: never persisted, never exported. The entries are decrypted
 * text, so the store is cleared and closed whenever the vault locks or the user
 * changes, and a closed store takes no new entries.
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

type Listener = () => void;
type Flusher = () => Promise<void>;

let entries: readonly HeldSave[] = [];
let accepting = true;
const listeners = new Set<Listener>();
const flushers = new Set<Flusher>();

function emit(next: readonly HeldSave[]) {
  entries = next;
  listeners.forEach((listener) => listener());
}

export const heldSaves = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  getSnapshot(): readonly HeldSave[] {
    return entries;
  },

  get(key: string): HeldSave | undefined {
    return entries.find((entry) => entry.key === key);
  },

  /** Hold words whose save failed. Replaces this instance's earlier entry. */
  hold(entry: HeldSave): void {
    if (!accepting) return;
    emit([...entries.filter((e) => e.key !== entry.key), entry]);
  },

  /** Drop one entry: its words were saved, copied, or kept as a new note. */
  release(key: string): void {
    if (!entries.some((e) => e.key === key)) return;
    emit(entries.filter((e) => e.key !== key));
  },

  /** Vault locked or user gone: drop every entry and take no new ones. */
  close(): void {
    accepting = false;
    if (entries.length > 0) emit([]);
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

  /** Save what every open Editor has on screen. Failures stay with their Editor. */
  async flushOpenEditors(): Promise<void> {
    await Promise.allSettled([...flushers].map((flush) => flush()));
  },
};

export function useHeldSaves(): readonly HeldSave[] {
  return useSyncExternalStore(heldSaves.subscribe, heldSaves.getSnapshot);
}

/** Test helper: an empty, open store. */
export function resetHeldSaves(): void {
  entries = [];
  accepting = true;
  flushers.clear();
  listeners.forEach((listener) => listener());
}
