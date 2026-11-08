// Base64 and URL-safe base64, apart from src/lib/encryption.ts so the share-route
// parser, and through it lazyWithRetry and the error boundary, can read a share key
// without pulling hash-wasm into the landing page's path (item 61, step 5).

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Convert bytes to URL-safe base64 (no padding) */
export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Convert URL-safe base64 back to bytes */
export function fromBase64Url(b64url: string): Uint8Array {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad === 1) throw new Error('Invalid base64url string: length cannot be 4n+1');
  if (pad === 2) b64 += '==';
  else if (pad === 3) b64 += '=';
  return fromBase64(b64);
}
