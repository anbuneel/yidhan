const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_PATTERN =
  /passphrase|password|token|secret|key|title|content|encrypted_payload|encryptedPayload|encryptionKey|hmacKey|noteTitle|noteContent/i;

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
