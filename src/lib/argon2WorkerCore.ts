// What src/lib/argon2.worker.ts runs for each message. A module of its own so unit
// tests can drive it behind a fake Worker (jsdom has none). Only the worker imports
// it: it pulls in hash-wasm statically.
//
// It never logs, and its error reply carries no message: hash-wasm's errors name
// the parameters, and nothing about the passphrase, salt or key may leave here
// except the derived bytes themselves.

import { argon2id } from './argon2Wasm';
import { parseArgon2Request, type Argon2WorkerReply } from './argon2Protocol';

export type Argon2Reply = (message: Argon2WorkerReply, transfer?: Transferable[]) => void;

/** Derive, reply once, and keep nothing. */
export async function handleArgon2Message(data: unknown, reply: Argon2Reply): Promise<void> {
  const request = parseArgon2Request(data);
  if (!request) {
    reply({ type: 'error', id: null });
    return;
  }
  const { id, salt } = request;
  let hash: Uint8Array;
  try {
    hash = await argon2id({
      password: request.password,
      salt,
      parallelism: request.parallelism,
      iterations: request.iterations,
      memorySize: request.memorySize,
      hashLength: request.hashLength,
      outputType: 'binary',
    });
  } catch {
    reply({ type: 'error', id });
    return;
  } finally {
    salt.fill(0);
  }
  // Copy into a buffer of exactly this length, so the transfer carries nothing
  // else that may share its ArrayBuffer.
  const out = new Uint8Array(hash.length);
  out.set(hash);
  hash.fill(0);
  reply({ type: 'result', id, hash: out.buffer }, [out.buffer]);
}
