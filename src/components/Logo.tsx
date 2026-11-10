/**
 * Brand logo: the leaf that is a page, beside the "yidhan" wordmark with a sun on the i.
 *
 * The header drawings live once, as an SVG sprite in index.html outside #root
 * (written by scripts/brand/flatten.py). The landing shell and this component both draw
 * them with <use>, so the header logo adds no JS to the entry and the shell cannot
 * drift from React. Colours come from the sprite's classes: the leaf and the y take
 * --color-brand-leaf, the rest of the word --color-text-primary; the two suns are the
 * one fixed colour, marigold. The gap and the lines are holes, so the page shows through.
 *
 * Larger marks (empty states, splash-like uses) are LogoMark, in its own module.
 */

import { SMALL_MARK_VIEWBOX, SPRITE_MARK_SMALL, SPRITE_WORDMARK, WORDMARK_ASPECT, WORDMARK_VIEWBOX } from './logoSprite';

interface LogoProps {
  className?: string;
  onClick?: () => void;
  /** Accessible name when the logo is a button. */
  alt?: string;
}

// The header lockup. The mark runs from the wordmark's ascender to its descender, so
// both share one height; the gap is 0.3 of the mark's width (scripts/brand/leaf.py).
// Both sizes are under 48px, so the mark is the one-line small drawing.
// index.html's .boot-logo, .boot-mark and .boot-word copy these sizes.
const markClass = 'h-[30px] w-[30px] sm:h-[36px] sm:w-[36px] shrink-0 select-none';
const wordClass = 'h-[30px] sm:h-[36px] w-auto shrink-0 select-none';
const gapClass = 'gap-[9px] sm:gap-[10.8px]';

const buttonClassName =
  'inline-flex items-center rounded-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]';

export function Logo({ className = '', onClick, alt = 'Yidhan' }: LogoProps) {
  const logo = (
    <span className={`inline-flex items-center ${gapClass}`}>
      <svg
        viewBox={SMALL_MARK_VIEWBOX}
        className={markClass}
        aria-hidden="true"
      >
        <use href={SPRITE_MARK_SMALL} />
      </svg>
      <svg
        viewBox={WORDMARK_VIEWBOX}
        className={wordClass}
        style={{ aspectRatio: WORDMARK_ASPECT }}
        role="img"
        aria-label="Yidhan"
      >
        <use href={SPRITE_WORDMARK} />
      </svg>
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={alt}
        className={`${buttonClassName} ${className}`.trim()}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        {logo}
      </button>
    );
  }

  return <span className={`inline-flex items-center ${className}`.trim()}>{logo}</span>;
}
