import lockup720 from '../assets/brand/yidhan-logo-lockup-tight-720.webp';
import lockup1200 from '../assets/brand/yidhan-logo-lockup-tight-1200.webp';
import mark256 from '../assets/brand/yidhan-logo-mark-256.webp';
import mark512 from '../assets/brand/yidhan-logo-mark-512.webp';

type LogoVariant = 'header' | 'hero' | 'auth';

interface LogoProps {
  className?: string;
  imageClassName?: string;
  onClick?: () => void;
  variant?: LogoVariant;
  alt?: string;
  priority?: boolean;
}

const lockupImageClasses: Record<'hero' | 'auth', string> = {
  hero: 'w-[172px] sm:w-[220px] lg:w-[256px]',
  auth: 'w-[150px] sm:w-[178px]',
};

const lockupSizes: Record<'hero' | 'auth', string> = {
  hero: '(max-width: 640px) 172px, (max-width: 1024px) 220px, 256px',
  auth: '(max-width: 640px) 150px, 178px',
};

const compactImageClass = 'h-[26px] sm:h-[30px]';
const compactWordClass =
  'text-[1.7rem] sm:text-[1.95rem] -ml-[0.16rem] sm:-ml-[0.2rem]';
const compactImageSizes = '(max-width: 640px) 26px, 30px';

const buttonClassName =
  'inline-flex items-center rounded-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]';

function isLockupVariant(variant: LogoVariant): variant is 'hero' | 'auth' {
  return variant === 'hero' || variant === 'auth';
}

export function Logo({
  className = '',
  imageClassName = '',
  onClick,
  variant = 'header',
  alt = 'Yidhan',
  priority = true,
}: LogoProps) {
  if (isLockupVariant(variant)) {
    const image = (
      <img
        src={lockup1200}
        srcSet={`${lockup720} 720w, ${lockup1200} 1200w`}
        sizes={lockupSizes[variant]}
        alt={onClick ? '' : alt}
        aria-hidden={onClick ? true : undefined}
        className={`${lockupImageClasses[variant]} h-auto max-w-none select-none ${imageClassName}`.trim()}
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        draggable={false}
        data-testid="brand-logo-lockup"
      />
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
          {image}
        </button>
      );
    }

    return (
      <span className={`inline-flex items-center ${className}`.trim()}>
        {image}
      </span>
    );
  }

  const compactMark = (
    <img
      src={mark512}
      srcSet={`${mark256} 256w, ${mark512} 512w`}
      sizes={compactImageSizes}
      alt=""
      aria-hidden="true"
      className={`${compactImageClass} w-auto shrink-0 select-none ${imageClassName}`.trim()}
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      draggable={false}
      data-testid="brand-logo-mark"
    />
  );

  const compactWord = (
    <span
      className={`${compactWordClass} leading-none tracking-[-0.045em]`.trim()}
      style={{
        fontFamily: 'var(--font-display)',
        color: 'color-mix(in srgb, var(--color-text-primary) 90%, var(--color-accent) 10%)',
      }}
    >
      Yidhan
    </span>
  );

  const compactLogo = (
    <span className="inline-flex items-center gap-[0.22rem] sm:gap-[0.28rem] translate-y-[-1px]">
      {compactMark}
      {compactWord}
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
        {compactLogo}
      </button>
    );
  }

  return (
    <span
      className={`inline-flex items-center ${className}`.trim()}
      role="img"
      aria-label={alt}
    >
      {compactLogo}
    </span>
  );
}
