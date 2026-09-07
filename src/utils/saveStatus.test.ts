import { describe, expect, it } from 'vitest';
import { getSaveLabel } from './saveStatus';
describe('save status', () => {
  const saved = { localSaved: true, synced: true, matchesDraft: true, hash: 'new', confirmedHash: 'new' };
  it('only says Synced for the acknowledged content', () => {
    expect(getSaveLabel(saved)).toBe('Synced');
    expect(getSaveLabel({ ...saved, synced: false })).toBe('Saved here');
    expect(getSaveLabel({ ...saved, confirmedHash: 'old' })).toBe('Saved here');
    expect(getSaveLabel({ ...saved, matchesDraft: false })).toBe('Saved here');
    expect(getSaveLabel({ ...saved, hash: undefined })).toBe('Saved here');
    expect(getSaveLabel({ ...saved, localSaved: false })).toBe('Not saved');
  });
});
