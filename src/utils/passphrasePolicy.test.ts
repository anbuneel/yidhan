import { describe, expect, it } from 'vitest';
import {
  evaluatePassphraseStrength,
  validatePassphrasePolicy,
} from './passphrasePolicy';

describe('passphrasePolicy', () => {
  it('rejects long single-class strings', () => {
    expect(validatePassphrasePolicy('averylonglowercasepassphrase')).toContain(
      'Mix words with spaces'
    );
  });

  it('accepts long word-based passphrases with separators', () => {
    expect(validatePassphrasePolicy('spring garden notes 2026')).toBeNull();
  });

  it('keeps strength evaluation aligned with the policy floor', () => {
    const strength = evaluatePassphraseStrength('spring garden notes 2026');

    expect(strength?.score).toBeGreaterThanOrEqual(2);
  });
});
