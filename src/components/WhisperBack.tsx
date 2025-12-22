import { useState, useEffect } from 'react';

interface WhisperBackProps {
  onClick: () => void;
}

export function WhisperBack({ onClick }: WhisperBackProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show earlier on mobile (300px) vs desktop (400px)
      const threshold = window.innerWidth < 640 ? 300 : 400;
      setIsVisible(window.scrollY > threshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <button
      onClick={onClick}
      className={`
        fixed z-20
        transition-all duration-500 ease-out
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--color-accent)]
        active:scale-95

        /* Mobile: bottom-right, icon only, larger touch target */
        right-4 bottom-4
        w-12 h-12
        flex items-center justify-center
        rounded-full

        /* Desktop: bottom-left, pill shape with text */
        sm:left-6 sm:right-auto sm:bottom-6
        sm:w-auto sm:h-auto
        sm:px-3 sm:py-2
        sm:gap-2

        ${isVisible
          ? 'opacity-70 sm:opacity-60 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
        }
      `}
      style={{
        fontFamily: 'var(--font-body)',
        color: 'var(--color-text-tertiary)',
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--color-accent)';
        e.currentTarget.style.background = 'var(--color-bg-secondary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--color-text-tertiary)';
        e.currentTarget.style.background = 'var(--color-bg-primary)';
      }}
      aria-label="Return to notes"
    >
      <svg
        className="w-4 h-4 sm:w-3.5 sm:h-3.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M10 19l-7-7m0 0l7-7m-7 7h18"
        />
      </svg>
      {/* Text hidden on mobile */}
      <span className="hidden sm:inline text-xs">Back</span>
    </button>
  );
}
