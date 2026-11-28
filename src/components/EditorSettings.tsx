import { useState } from 'react';
import { loadSmartTypographyPreference, setSmartTypographyPreference } from '../editor/smartTypographyPreference';
import { TEXT_SIZE_LABELS, TEXT_SIZES, loadTextSize, setTextSize, type TextSize } from '../editor/textSize';

/** Settings → Editor: text size and smart typography. Both are saved on this device. */
export function EditorSettings() {
  const [textSize, setTextSizeState] = useState<TextSize>(loadTextSize);
  const [smartTypography, setSmartTypographyState] = useState(loadSmartTypographyPreference);

  const chooseTextSize = (size: TextSize) => {
    setTextSize(size);
    setTextSizeState(size);
  };

  const toggleSmartTypography = () => {
    const next = !smartTypography;
    setSmartTypographyPreference(next);
    setSmartTypographyState(next);
  };

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
        These settings apply on this device.
      </p>

      <div className="mb-6 pb-5" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        <h3 id="settings-text-size" className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
          Text size
        </h3>
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
          For the editor and note cards.
        </p>
        <div role="radiogroup" aria-labelledby="settings-text-size" className="flex gap-1">
          {TEXT_SIZES.map((size) => {
            const selected = size === textSize;
            return (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => chooseTextSize(size)}
                className="min-h-11 px-4 py-2 text-sm font-medium rounded-[var(--radius-button)] transition-colors duration-200 touch-press-light focus-ring"
                style={{
                  color: selected ? 'var(--color-accent-text)' : 'var(--color-text-secondary)',
                  background: selected ? 'var(--color-accent-glow)' : 'transparent',
                  border: '1px solid var(--glass-border)',
                }}
              >
                {TEXT_SIZE_LABELS[size]}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className="flex w-full items-center justify-between text-left cursor-pointer focus-ring"
        role="switch"
        aria-checked={smartTypography}
        aria-label="Smart typography"
        onClick={toggleSmartTypography}
        style={{ color: 'var(--color-text-primary)' }}
      >
        <div>
          <span className="block text-sm">Smart typography</span>
          <span className="block text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            Curly quotes, dashes and ellipses as you type.
          </span>
        </div>
        <span
          className="relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer shrink-0 ml-4"
          style={{ background: smartTypography ? 'var(--color-accent)' : 'var(--color-bg-tertiary)' }}
          aria-hidden="true"
        >
          <span
            className="absolute top-0.5 size-5 rounded-full shadow-[var(--shadow-sm)] transition-transform duration-200"
            style={{
              background: 'var(--color-text-primary)',
              transform: smartTypography ? 'translateX(26px)' : 'translateX(2px)',
            }}
          />
        </span>
      </button>
    </div>
  );
}
