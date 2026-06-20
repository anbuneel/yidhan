export const MIN_PASSPHRASE_LENGTH = 12;
export const MIN_PASSPHRASE_STRENGTH_SCORE = 2;

export type PassphraseStrengthLabel = 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';

export interface PassphraseStrength {
  label: PassphraseStrengthLabel;
  score: number;
}

export function evaluatePassphraseStrength(passphrase: string): PassphraseStrength | null {
  if (!passphrase) {
    return null;
  }

  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return { label: 'Too short', score: 1 };
  }

  let score = 0;
  if (passphrase.length >= MIN_PASSPHRASE_LENGTH) score++;
  if (passphrase.length >= 16) score++;
  if (passphrase.length >= 20) score++;

  const characterClasses = [
    /[a-z]/.test(passphrase),
    /[A-Z]/.test(passphrase),
    /\d/.test(passphrase),
    /[^A-Za-z0-9]/.test(passphrase),
  ].filter(Boolean).length;

  if (characterClasses >= 2) score++;
  if (characterClasses >= 3) score++;
  if (characterClasses === 4) score++;

  if (score <= 1) {
    return { label: 'Weak', score: 1 };
  }
  if (score <= 3) {
    return { label: 'Fair', score: 2 };
  }
  if (score <= 5) {
    return { label: 'Good', score: 3 };
  }

  return { label: 'Strong', score: 4 };
}

export function validatePassphrasePolicy(passphrase: string): string | null {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`;
  }

  const strength = evaluatePassphraseStrength(passphrase);
  if (!strength || strength.score < MIN_PASSPHRASE_STRENGTH_SCORE) {
    return 'Use a stronger passphrase. Add length, spaces, numbers, or symbols.';
  }

  return null;
}
