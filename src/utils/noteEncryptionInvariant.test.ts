import { describe, expect, it } from 'vitest';
import {
  assertLaunchEncryptedAppNote,
  assertLaunchEncryptedDbNote,
  isLaunchEncryptedAppNote,
  isLaunchEncryptedDbNote,
  requireEncryptedQueuePayload,
} from './noteEncryptionInvariant';

const encryptedAppNote = {
  title: '',
  content: '',
  encryptedPayload: 'ciphertext',
  encryptionIv: 'iv',
  encryptionVersion: 1,
  contentHash: 'hash',
};

const encryptedDbNote = {
  title: '',
  content: '',
  encrypted_payload: 'ciphertext',
  encryption_iv: 'iv',
  encryption_version: 1,
  content_hash: 'hash',
};

describe('noteEncryptionInvariant', () => {
  it('accepts launch-safe encrypted app and database notes', () => {
    expect(isLaunchEncryptedAppNote(encryptedAppNote)).toBe(true);
    expect(isLaunchEncryptedDbNote(encryptedDbNote)).toBe(true);

    expect(() => assertLaunchEncryptedAppNote(encryptedAppNote, 'note-1', 'cache')).not.toThrow();
    expect(() => assertLaunchEncryptedDbNote(encryptedDbNote, 'note-1', 'cache')).not.toThrow();
  });

  it('rejects notes with non-empty plaintext columns even when encrypted fields exist', () => {
    expect(isLaunchEncryptedAppNote({ ...encryptedAppNote, title: 'plaintext' })).toBe(false);
    expect(isLaunchEncryptedDbNote({ ...encryptedDbNote, content: '<p>plaintext</p>' })).toBe(false);

    expect(() =>
      assertLaunchEncryptedAppNote({ ...encryptedAppNote, title: 'plaintext' }, 'note-1', 'cache')
    ).toThrow('Refusing cache for unsafe plaintext note note-1');
    expect(() =>
      assertLaunchEncryptedDbNote({ ...encryptedDbNote, content: '<p>plaintext</p>' }, 'note-1', 'cache')
    ).toThrow('Refusing cache for unsafe plaintext server note note-1');
  });

  it('rejects partial encryption metadata', () => {
    expect(isLaunchEncryptedAppNote({ ...encryptedAppNote, contentHash: '' })).toBe(false);
    expect(isLaunchEncryptedDbNote({ ...encryptedDbNote, encryption_version: null })).toBe(false);
  });

  it('normalizes encrypted queue payload versions after validation', () => {
    expect(
      requireEncryptedQueuePayload(
        {
          ...encryptedDbNote,
          encryption_version: '1',
        },
        'note-1',
        'update'
      )
    ).toEqual({
      encrypted_payload: 'ciphertext',
      encryption_iv: 'iv',
      encryption_version: 1,
      content_hash: 'hash',
    });
  });

  it('rejects unsafe queue payloads', () => {
    expect(() =>
      requireEncryptedQueuePayload(
        {
          ...encryptedDbNote,
          title: 'plaintext',
        },
        'note-1',
        'update'
      )
    ).toThrow('Refusing update sync for unsafe plaintext note note-1');
  });
});
