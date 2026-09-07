const REDACTED = '[REDACTED]';

/**
 * Keys whose values never leave the device in a report, matched case-insensitively at
 * every depth. The field lists this has to cover are in
 * `docs/reference/outbound-data.md`, and `sentryScrubber.test.ts` has one case per row.
 *
 * `salt` is here even though an Argon2id salt is not a secret — it is public by design
 * and already rides in the JWT (issue #170 D1, item 136). It is a stable per-user
 * identifier, and an error report has no use for one.
 *
 * A tag name is deliberately *not* here: tag names are plaintext on the server until
 * item 101, and redacting them in telemetry would imply a protection the database does
 * not provide.
 */
const SENSITIVE_KEY_PATTERN =
  /passphrase|password|token|secret|key|salt|title|content|encrypted_payload|encryptedPayload|encryptionKey|hmacKey|noteTitle|noteContent/i;

export function scrubShareSecrets(value: string): string {
  return value
    .replace(/#.*$/, '')
    .replace(/\/s\/[A-Za-z0-9_-]{16,}(\/[^?#]*)?/g, '/s/[REDACTED]');
}

export function scrubSensitiveData(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') {
    return scrubShareSecrets(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubSensitiveData(item, seen));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (seen.has(value)) {
    return REDACTED;
  }
  seen.add(value);

  const scrubbed: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    scrubbed[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? REDACTED
      : scrubSensitiveData(nestedValue, seen);
  }

  return scrubbed;
}
