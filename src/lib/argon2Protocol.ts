// Messages between src/lib/argon2.ts and src/lib/argon2.worker.ts. Both sides check
// what they receive: the worker checks the request, the client checks the reply.
// A reply that does not match its request is an error, never a key.

export interface Argon2Params {
  password: string;
  salt: Uint8Array;
  parallelism: number;
  iterations: number;
  memorySize: number;
  hashLength: number;
}

export interface Argon2WorkerRequest extends Argon2Params {
  type: 'derive';
  id: number;
}

export type Argon2WorkerReply =
  | { type: 'result'; id: number; hash: ArrayBuffer }
  | { type: 'error'; id: number | null };

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** The request, or null when any field is missing or of the wrong type. */
export function parseArgon2Request(data: unknown): Argon2WorkerRequest | null {
  if (typeof data !== 'object' || data === null) return null;
  const r = data as Record<string, unknown>;
  if (
    r.type !== 'derive' ||
    !isPositiveInteger(r.id) ||
    typeof r.password !== 'string' ||
    !(r.salt instanceof Uint8Array) ||
    !isPositiveInteger(r.parallelism) ||
    !isPositiveInteger(r.iterations) ||
    !isPositiveInteger(r.memorySize) ||
    !isPositiveInteger(r.hashLength)
  ) {
    return null;
  }
  return r as unknown as Argon2WorkerRequest;
}

/**
 * The derived bytes when `data` is a result for request `id` of exactly
 * `hashLength` bytes; 'error' when the worker reported a failure for it; null for
 * anything else (a malformed reply, another request's reply, a wrong length).
 */
export function readArgon2Reply(data: unknown, id: number, hashLength: number): Uint8Array | 'error' | null {
  if (typeof data !== 'object' || data === null) return null;
  const r = data as Record<string, unknown>;
  if (r.type === 'error' && (r.id === id || r.id === null)) return 'error';
  if (r.type !== 'result' || r.id !== id) return null;
  if (!(r.hash instanceof ArrayBuffer) || r.hash.byteLength !== hashLength) return null;
  return new Uint8Array(r.hash);
}
