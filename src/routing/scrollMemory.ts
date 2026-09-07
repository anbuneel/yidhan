/**
 * Scroll memory, keyed by history entry.
 *
 * Back from a note must land on the library where the reader left it. Keying by path
 * would be wrong: opening a note and then navigating to the library afresh is a
 * different visit from going *back* to it, and only the second should restore. So the
 * key is the history entry, not the address.
 *
 * The offsets live in `sessionStorage` so a reload inside the same tab keeps them, and
 * every access is wrapped — a browser with site data blocked degrades to "starts at
 * the top", never to a thrown error on navigation.
 */

const STORAGE_KEY = 'yidhan-scroll-memory';

/** Beyond this, the oldest entries are dropped. A tab does not accumulate history forever. */
const MAX_ENTRIES = 50;

type ScrollMemory = Record<string, number>;

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function read(): ScrollMemory {
  const storage = getSessionStorage();
  if (!storage) return {};

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const memory: ScrollMemory = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        memory[key] = value;
      }
    }
    return memory;
  } catch {
    return {};
  }
}

function write(memory: ScrollMemory): void {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Quota or a private-mode storage refusal. Scroll position is a convenience;
    // losing it is not worth surfacing.
  }
}

/**
 * Drop the oldest keys once the memory grows past `MAX_ENTRIES`.
 * History keys are assigned in increasing order, so "oldest" is "numerically smallest".
 */
function prune(memory: ScrollMemory): ScrollMemory {
  const keys = Object.keys(memory);
  if (keys.length <= MAX_ENTRIES) return memory;

  const kept = keys
    .sort((a, b) => Number(a) - Number(b))
    .slice(keys.length - MAX_ENTRIES);

  const pruned: ScrollMemory = {};
  for (const key of kept) {
    pruned[key] = memory[key];
  }
  return pruned;
}

export function rememberScroll(historyKey: number, offset: number): void {
  if (!Number.isFinite(offset) || offset < 0) return;
  const memory = read();
  memory[String(historyKey)] = offset;
  write(prune(memory));
}

/** The remembered offset for a history entry, or `null` if this entry was never left. */
export function recallScroll(historyKey: number): number | null {
  const memory = read();
  const offset = memory[String(historyKey)];
  return typeof offset === 'number' ? offset : null;
}

export function forgetScroll(historyKey: number): void {
  const memory = read();
  if (!(String(historyKey) in memory)) return;
  delete memory[String(historyKey)];
  write(memory);
}

export function clearScrollMemory(): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // See write().
  }
}
