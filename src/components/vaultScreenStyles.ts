/** Shared inline styles for the vault screens (item 26). Theme tokens only. */

export const vaultInputStyle = {
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  border: '1px solid var(--color-input-border)',
  borderRadius: 'var(--radius-input)',
  fontFamily: 'var(--font-body)',
} as const;

export function vaultPrimaryButtonStyle(enabled: boolean) {
  return {
    background: 'var(--color-cta-bg)',
    color: 'var(--color-cta-text)',
    borderRadius: 'var(--radius-pill)',
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
    opacity: enabled ? 1 : 0.5,
    cursor: enabled ? 'pointer' : 'not-allowed',
    border: 'none',
  } as const;
}

export const vaultSecondaryButtonStyle = {
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--glass-border)',
  borderRadius: 'var(--radius-pill)',
  fontFamily: 'var(--font-body)',
  cursor: 'pointer',
} as const;

export const vaultQuietButtonStyle = {
  background: 'transparent',
  color: 'var(--color-text-tertiary)',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
} as const;
