import { describe, expect, it } from 'vitest';
import { scrubSensitiveData, scrubShareSecrets } from './sentryScrubber';

describe('sentryScrubber', () => {
  it('removes shared-note fragments and capability tokens from urls', () => {
    expect(
      scrubShareSecrets('https://yidhan.vercel.app/s/abcdefghijklmnop/letter#k=secret')
    ).toBe('https://yidhan.vercel.app/s/[REDACTED]');
  });

  it('redacts nested sensitive fields and handles cycles', () => {
    const payload: Record<string, unknown> = {
      safe: 'visible',
      nested: {
        title: 'Private note',
        url: 'https://yidhan.vercel.app/s/abcdefghijklmnop/letter#k=secret',
      },
    };
    payload.self = payload;

    expect(scrubSensitiveData(payload)).toEqual({
      safe: 'visible',
      nested: {
        title: '[REDACTED]',
        url: 'https://yidhan.vercel.app/s/[REDACTED]',
      },
      self: '[REDACTED]',
    });
  });
});

/**
 * Item 40: one case per row of `docs/reference/outbound-data.md`.
 *
 * The audit says which fields each outbound request may carry. These are the tests
 * that make that claim checkable — if a field list there changes, one of these should
 * fail, and if a new secret-carrying key appears in the app it should be added here in
 * the same commit.
 */
describe('outbound data audit — every field the app can send', () => {
  describe('§1 notes', () => {
    it('redacts the encrypted payload under either spelling', () => {
      expect(
        scrubSensitiveData({ encrypted_payload: 'ciphertext', encryptedPayload: 'ciphertext' })
      ).toEqual({ encrypted_payload: '[REDACTED]', encryptedPayload: '[REDACTED]' });
    });

    it('redacts a note title and body wherever they appear', () => {
      expect(
        scrubSensitiveData({ title: 'Therapy', content: '<p>…</p>', noteTitle: 'x', noteContent: 'y' })
      ).toEqual({
        title: '[REDACTED]',
        content: '[REDACTED]',
        noteTitle: '[REDACTED]',
        noteContent: '[REDACTED]',
      });
    });

    it('redacts the content hash, which is keyed to the note', () => {
      // `content_hash` matches on "hash"? It does not — it matches on "content".
      expect(scrubSensitiveData({ content_hash: 'abc' })).toEqual({ content_hash: '[REDACTED]' });
    });

    it('keeps the metadata the audit says is visible anyway', () => {
      // Pin state and timestamps are already server-visible; redacting them would
      // make an error report useless without protecting anything.
      const meta = { pinned: true, created_at: '2026-01-01', deleted_at: null, id: 'note-1' };
      expect(scrubSensitiveData(meta)).toEqual(meta);
    });
  });

  describe('§2 tags', () => {
    it('leaves a tag name visible, because it is already plaintext on the server', () => {
      // Not an oversight: item 101. Redacting it here would suggest a protection the
      // database does not provide.
      expect(scrubSensitiveData({ name: 'Therapy', color: 'plum' })).toEqual({
        name: 'Therapy',
        color: 'plum',
      });
    });

    it('leaves membership ids visible', () => {
      expect(scrubSensitiveData({ note_id: 'n1', tag_id: 't1' })).toEqual({
        note_id: 'n1',
        tag_id: 't1',
      });
    });
  });

  describe('§3 shares', () => {
    it('redacts the share token wherever it is named', () => {
      expect(scrubSensitiveData({ share_token_param: 'abc', shareToken: 'abc' })).toEqual({
        share_token_param: '[REDACTED]',
        shareToken: '[REDACTED]',
      });
    });

    it('strips the fragment carrying a share key from any string', () => {
      expect(scrubShareSecrets('opened /s/abcdefghijklmnopqrstuv#k=AAAA')).toBe(
        'opened /s/[REDACTED]'
      );
    });

    it('strips a share token even without a fragment', () => {
      expect(scrubShareSecrets('GET /s/abcdefghijklmnopqrstuv')).toBe('GET /s/[REDACTED]');
    });

    it('strips the slug a share link may carry', () => {
      // The slug is built from the note title.
      expect(scrubShareSecrets('/s/abcdefghijklmnopqrstuv/a-note-about-my-health')).toBe(
        '/s/[REDACTED]'
      );
    });

    it('leaves an ordinary path alone', () => {
      expect(scrubShareSecrets('https://yidhan.vercel.app/privacy')).toBe(
        'https://yidhan.vercel.app/privacy'
      );
    });

    it('drops any fragment, not only a share key', () => {
      // A fragment is where a capability lives; none of them belong in a report.
      expect(scrubShareSecrets('https://yidhan.vercel.app/#anything')).toBe(
        'https://yidhan.vercel.app/'
      );
    });
  });

  describe('§4 authentication and key material', () => {
    it('redacts passwords and passphrases', () => {
      expect(scrubSensitiveData({ password: 'p', passphrase: 'p', newPassphrase: 'p' })).toEqual({
        password: '[REDACTED]',
        passphrase: '[REDACTED]',
        newPassphrase: '[REDACTED]',
      });
    });

    it('redacts every shape of key material', () => {
      expect(
        scrubSensitiveData({
          encryptionKey: 'k',
          hmacKey: 'k',
          rawEncryptionKey: 'k',
          hashKey: 'k',
          encryption_key_check: 'k',
          shareKey: 'k',
        })
      ).toEqual({
        encryptionKey: '[REDACTED]',
        hmacKey: '[REDACTED]',
        rawEncryptionKey: '[REDACTED]',
        hashKey: '[REDACTED]',
        encryption_key_check: '[REDACTED]',
        shareKey: '[REDACTED]',
      });
    });

    it('redacts session and access tokens', () => {
      expect(
        scrubSensitiveData({ access_token: 'a', refresh_token: 'r', confirmationToken: 'c' })
      ).toEqual({
        access_token: '[REDACTED]',
        refresh_token: '[REDACTED]',
        confirmationToken: '[REDACTED]',
      });
    });

    it('redacts the salt, which is key-derivation material', () => {
      expect(scrubSensitiveData({ encryption_salt: 's' })).toEqual({
        encryption_salt: '[REDACTED]',
      });
    });

    it('leaves an email visible, because an error report needs to name an account', () => {
      expect(scrubSensitiveData({ email: 'a@b.c' })).toEqual({ email: 'a@b.c' });
    });
  });

  describe('§7 the reliability telemetry that is sent on purpose', () => {
    it('passes through the categories and operations it is built from', () => {
      const payload = {
        category: 'sync',
        message: 'Realtime change could not be persisted locally',
        level: 'warning',
        data: { entity: 'note', operation: 'insert', userId: 'user-1' },
      };
      expect(scrubSensitiveData(payload)).toEqual(payload);
    });

    it('still redacts anything sensitive that reaches it by accident', () => {
      expect(
        scrubSensitiveData({ category: 'vault', data: { source: 'unlock', passphrase: 'oops' } })
      ).toEqual({ category: 'vault', data: { source: 'unlock', passphrase: '[REDACTED]' } });
    });
  });

  describe('the scrubber itself', () => {
    it('reaches into arrays', () => {
      expect(scrubSensitiveData([{ title: 'secret' }, { safe: 'ok' }])).toEqual([
        { title: '[REDACTED]' },
        { safe: 'ok' },
      ]);
    });

    it('reaches through several levels', () => {
      expect(scrubSensitiveData({ a: { b: { c: { title: 'deep' } } } })).toEqual({
        a: { b: { c: { title: '[REDACTED]' } } },
      });
    });

    it('matches keys case-insensitively', () => {
      expect(scrubSensitiveData({ TITLE: 'x', PassPhrase: 'y' })).toEqual({
        TITLE: '[REDACTED]',
        PassPhrase: '[REDACTED]',
      });
    });

    it('leaves primitives and dates intact', () => {
      const date = new Date('2026-01-01T00:00:00.000Z');
      expect(scrubSensitiveData({ n: 1, b: true, nul: null, undef: undefined, date })).toEqual({
        n: 1,
        b: true,
        nul: null,
        undef: undefined,
        date,
      });
    });

    it('does not throw on a cycle nested inside an array', () => {
      const inner: Record<string, unknown> = { safe: 'ok' };
      inner.loop = [inner];
      expect(() => scrubSensitiveData(inner)).not.toThrow();
    });
  });
});
