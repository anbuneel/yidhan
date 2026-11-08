// The only static import of hash-wasm. src/lib/argon2.ts loads this module with
// import(), so the chunk holds Argon2id alone, not every hash-wasm algorithm.
export { argon2id } from 'hash-wasm';
