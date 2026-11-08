// Argon2id, loaded on first use (item 61, step 7). hash-wasm is about 11 KB gzip and
// only key derivation needs it, so it stays out of the app shell's static path. Every
// Argon2id call goes through here; never import hash-wasm statically from app code,
// or Rollup folds it back into the app shell. The chunk is precached by the JS glob,
// so offline unlock still works.
//
// The app shell warms the chunk on idle after sign-in (preloadArgon2), so a tab
// holds it in memory before any lock screen needs it, even without a service
// worker or after a deploy removes the old chunk URL. A failed load throws
// KdfLoadError and is not cached here, so the next attempt imports again; a browser
// may still hold the failed fetch, which is why the message says to reload.
// Callers must let it propagate: it is not a wrong passphrase.

import type { IArgon2Options } from 'hash-wasm';
import type * as Argon2Wasm from './argon2Wasm';

type HashWasm = typeof Argon2Wasm;

export class KdfLoadError extends Error {
  constructor(cause: unknown) {
    super('Could not load the encryption module. Check your connection, then reload the page and try again.');
    this.name = 'KdfLoadError';
    this.cause = cause;
  }
}

let loading: Promise<HashWasm> | null = null;

function loadHashWasm(): Promise<HashWasm> {
  if (!loading) {
    loading = import('./argon2Wasm').catch((err: unknown) => {
      loading = null;
      throw new KdfLoadError(err);
    });
  }
  return loading;
}

/** Fetch the chunk now, so a later unlock does not wait on it. A failure is ignored here. */
export function preloadArgon2(): void {
  void loadHashWasm().catch(() => undefined);
}

/** hash-wasm's argon2id, fetched on first call. Throws KdfLoadError if the chunk does not load. */
export async function argon2id<T extends IArgon2Options>(options: T): ReturnType<typeof Argon2Wasm.argon2id<T>> {
  const { argon2id: run } = await loadHashWasm();
  return run(options);
}
