/**
 * Brand logo: the hand-painted enso mark beside the "Yidhan" wordmark.
 *
 * The mark is two CSS-masked layers (`.brand-mark` in index.css) filled with
 * theme colours — the arc takes the accent (terracotta on Kintsugi, gold on
 * Midnight), the seed stays brand gold — instead of a raster with terracotta
 * baked in. The masks come from `npm run logo:masks`.
 */

interface LogoProps {
  className?: string;
  onClick?: () => void;
  /** Accessible name when the logo is a button. */
  alt?: string;
}

const markClass = 'brand-mark h-[26px] sm:h-[30px] shrink-0 select-none';
const wordClass =
  'text-[1.7rem] sm:text-[1.95rem] -ml-[0.16rem] sm:-ml-[0.2rem] leading-none tracking-[-0.045em]';

const buttonClassName =
  'inline-flex items-center rounded-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]';

export function Logo({ className = '', onClick, alt = 'Yidhan' }: LogoProps) {
  const logo = (
    <span className="inline-flex items-center gap-[0.22rem] sm:gap-[0.28rem] translate-y-[-1px]">
      <span aria-hidden="true" className={markClass} data-testid="brand-logo-mark" />
      <span
        className={wordClass}
        style={{
          fontFamily: 'var(--font-display)',
          color: 'color-mix(in srgb, var(--color-text-primary) 90%, var(--color-accent) 10%)',
        }}
      >
        Yidhan
      </span>
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
