import { describe, it, expect } from 'vitest';
import { describeSyncFailure } from './syncErrorMessages';

describe('describeSyncFailure', () => {
  it('returns null when there is nothing to describe', () => {
    expect(describeSyncFailure(null)).toBeNull();
    expect(describeSyncFailure(undefined)).toBeNull();
    expect(describeSyncFailure('   ')).toBeNull();
  });

  it('explains a foreign-key violation as waiting on a parent', () => {
    expect(
      describeSyncFailure('[23503] insert violates foreign key constraint')
    ).toBe('Waiting for a related note to finish syncing.');
  });

  it('points an RLS rejection at the app owner rather than the writer', () => {
    const message = describeSyncFailure(
      '[42501] new row violates row-level security policy for table "notes"'
    );

    expect(message).toBe('The server refused this change. It needs attention from the app owner.');
    // The point of the mapping: no schema or policy detail reaches the reader.
    expect(message).not.toContain('row-level security');
    expect(message).not.toContain('notes');
    expect(message).not.toContain('42501');
  });

  it('treats a missing column default the same way as an RLS rejection', () => {
    expect(
      describeSyncFailure('[23502] null value in column "user_id" violates not-null constraint')
    ).toBe('The server refused this change. It needs attention from the app owner.');
  });

  it('explains the E2EE check constraint', () => {
    expect(describeSyncFailure('[23514] violates check constraint "chk_notes_e2ee_only"')).toBe(
      'This note is missing its encryption details, so it cannot be saved.'
    );
  });

  it('does not blame encryption for an unrelated check constraint', () => {
    expect(
      describeSyncFailure('[23514] violates check constraint "chk_tag_name_length"')
    ).toBe('This change could not be saved yet.');
  });

  it('explains a plaintext note guard', () => {
    expect(describeSyncFailure('Refusing update sync for unsafe plaintext note abc')).toBe(
      'This note predates the encryption upgrade and needs to be re-saved.'
    );
  });

  // Pinned deliberately: syncEngine throws this as a RetryableSyncError, so
  // the copy may only promise a retry for as long as that stays true.
  it('promises a retry only for the unconfirmed-write failure', () => {
    expect(describeSyncFailure('Rebuilt note abc did not appear on the server')).toBe(
      'The server accepted this change but did not confirm it. It will be retried.'
    );
    expect(describeSyncFailure('Created note abc did not appear on the server')).toBe(
      'The server accepted this change but did not confirm it. It will be retried.'
    );
  });

  it('falls back to calm generic copy for anything unrecognised', () => {
    expect(describeSyncFailure('[XX999] something nobody has seen before')).toBe(
      'This change could not be saved yet.'
    );
  });

  it('never returns raw technical text', () => {
    const raw = '[42P01] relation "public.notes" does not exist';
    expect(describeSyncFailure(raw)).not.toContain(raw);
  });
});
