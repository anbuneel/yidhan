/**
 * The bare leaf mark at a given size, for uses other than the header: empty states and
 * anything large. Its own module so the full drawing stays out of the landing's entry.
 *
 * Size rule in logoSizeRule.ts. The small drawing comes from the index.html sprite.
 */

import { FULL_MARK, MARIGOLD } from './logoPaths';
import { SMALL_MARK_VIEWBOX, SPRITE_MARK_SMALL } from './logoSprite';
import { markDrawingFor } from './logoSizeRule';

interface LogoMarkProps {
  /** Rendered size in px. Picks the drawing. */
  size: number;
  className?: string;
  /** Accessible name. Without one the mark is decorative. */
  label?: string;
}

export function LogoMark({ size, className = '', label }: LogoMarkProps) {
  const drawing = markDrawingFor(size);
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  return (
    <svg
      viewBox={drawing === 'small' ? SMALL_MARK_VIEWBOX : FULL_MARK.viewBox}
      width={size}
      height={size}
      className={`shrink-0 select-none ${className}`.trim()}
      focusable="false"
      data-testid="brand-logo-mark"
      data-drawing={drawing}
      {...a11y}
    >
      {drawing === 'small' ? (
        <use href={SPRITE_MARK_SMALL} />
      ) : (
        <>
          <path d={FULL_MARK.sun} style={{ fill: MARIGOLD }} />
          <path d={FULL_MARK.leaf} style={{ fill: 'var(--color-brand-leaf)' }} />
        </>
      )}
    </svg>
  );
}
