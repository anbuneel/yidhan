/**
 * Text size for the editor and note cards: three steps, saved per device.
 *
 * The choice is a `data-text-size` attribute on <html>. CSS turns it into
 * `--reading-scale`, which only the editor body and note card previews read, so the
 * landing shell and public pages do not change. Shared notes reset the scale.
 */
export const TEXT_SIZES = ['small', 'default', 'large'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  small: 'Small',
  default: 'Default',
  large: 'Large',
};

const TEXT_SIZE_STORAGE_KEY = 'yidhan:editor:text-size';

function isTextSize(value: unknown): value is TextSize {
  return typeof value === 'string' && (TEXT_SIZES as readonly string[]).includes(value);
}

export function loadTextSize(): TextSize {
  try {
    const stored = localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
    return isTextSize(stored) ? stored : 'default';
  } catch {
    return 'default';
  }
}

function applyTextSize(size: TextSize): void {
  if (size === 'default') delete document.documentElement.dataset.textSize;
  else document.documentElement.dataset.textSize = size;
}

/** Called once at startup, before the first render, so text does not jump. */
export function applyStoredTextSize(): void {
  applyTextSize(loadTextSize());
}

export function setTextSize(size: TextSize): void {
  try {
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, size);
  } catch {
    // The size still applies for this visit when storage is unavailable.
  }
  applyTextSize(size);
}
