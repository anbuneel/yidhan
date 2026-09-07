import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { EncryptedConflictModal } from './EncryptedConflictModal';
import { encryptNote, type DerivedKeys } from '../lib/encryption';
import type { ConflictInfo } from '../services/syncEngine';

it('opens two ciphertexts as readable titles, excerpts, word counts and paragraph changes', async () => {
  const keys = {
    encryptionKey: await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
    hashKey: await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']),
    salt: new Uint8Array(16), rawEncryptionKey: new Uint8Array(32), rawHashKey: new Uint8Array(32),
  } satisfies DerivedKeys;
  const local = await encryptNote('note', 'user', 'Local title', '<p>Shared paragraph</p><p>Local ending</p>', keys);
  const server = await encryptNote('note', 'user', 'Remote title', '<p>Shared paragraph</p><p>Remote ending</p>', keys);
  const conflict: ConflictInfo = { entityType: 'note', entityId: 'note', localVersion: {
    id: 'note', userId: 'user', title: '', content: '', pinned: false, deletedAt: null,
    createdAt: 1, updatedAt: 2, localUpdatedAt: 2, syncStatus: 'conflict', lastSyncedAt: 1, serverUpdatedAt: 1,
    encryptedPayload: local.ciphertext, encryptionIv: local.iv, encryptionVersion: 1, contentHash: local.contentHash,
  }, serverVersion: { id: 'note', title: '', content: '', pinned: false, deleted_at: null,
    created_at: new Date(1).toISOString(), updated_at: new Date(3).toISOString(), encrypted_payload: server.ciphertext,
    encryption_iv: server.iv, encryption_version: 1, content_hash: server.contentHash,
  } };
  render(<EncryptedConflictModal conflict={conflict} keys={keys} onResolve={vi.fn()} onDismiss={vi.fn()} />);
  expect(await screen.findByText('Local title')).toBeVisible();
  expect(screen.getByText('Remote title')).toBeVisible();
  expect(screen.getAllByText('4 words')).toHaveLength(2);
  expect(screen.getByText('Paragraph changes')).toBeVisible();
  expect(screen.getByText('Local ending', { selector: 'ins' })).toBeVisible();
  expect(screen.getByText('Remote ending', { selector: 'del' })).toBeVisible();
  expect(conflict.localVersion.title).toBe('');
  expect(conflict.serverVersion.title).toBe('');
});
