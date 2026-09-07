import { describe, expect, it } from 'vitest';
import { createMockNote } from '../test/factories';
import { applySavedNote } from './applySavedNote';

const draft = { title: 'Groceries', content: '<p>milk, eggs, bread</p>' };

// What updateEncryptedNote hands back: the recomputed hash, and pinned/deletedAt
// as they were read before the encrypt and write.
const saved = createMockNote({
  id: '1', ...draft, contentHash: 'fresh', pinned: false, deletedAt: null,
  encryptedPayload: 'cipher', encryptionIv: 'iv', encryptionVersion: 1,
});

describe('applySavedNote', () => {
  it('takes the recomputed hash so the search index sees the edit', () => {
    const current = createMockNote({ id: '1', ...draft, contentHash: 'stale' });
    expect(applySavedNote(current, saved, draft).contentHash).toBe('fresh');
  });

  it('keeps a pin toggle that landed while the save was in flight', () => {
    const current = createMockNote({ id: '1', ...draft, contentHash: 'stale', pinned: true });
    const merged = applySavedNote(current, saved, draft);
    expect(merged.pinned).toBe(true);
    expect(merged.contentHash).toBe('fresh');
  });

  it('keeps a soft delete that landed while the save was in flight', () => {
    const deletedAt = new Date(1);
    const current = createMockNote({ id: '1', ...draft, contentHash: 'stale', deletedAt });
    expect(applySavedNote(current, saved, draft).deletedAt).toBe(deletedAt);
  });

  it('keeps tags, which the save does not carry', () => {
    const tags = [{ id: 't1', name: 'kitchen', color: 'sage' as const, createdAt: new Date(1) }];
    const current = createMockNote({ id: '1', ...draft, contentHash: 'stale', tags });
    expect(applySavedNote(current, saved, draft).tags).toBe(tags);
  });

  it('drops an acknowledgement for a draft the user has since typed past', () => {
    const current = createMockNote({ id: '1', title: 'Groceries', content: '<p>milk, eggs, bread, jam</p>', contentHash: 'stale' });
    expect(applySavedNote(current, saved, draft)).toBe(current);
  });

  it('leaves other notes alone', () => {
    const other = createMockNote({ id: '2', ...draft, contentHash: 'stale' });
    expect(applySavedNote(other, saved, draft)).toBe(other);
  });
});
