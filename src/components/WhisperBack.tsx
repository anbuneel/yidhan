import { useState, useEffect, type RefObject } from 'react';

interface WhisperBackProps {
  scrollContainerRef?: RefObject<HTMLElement | null>;
}

export function WhisperBack({ scrollContainerRef }: WhisperBackProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const scrollContainer = scrollContainerRef?.current;

    const handleScroll = () => {
      // Show earlier on mobile (300px) vs desktop (400px)
      const threshold = window.innerWidth < 640 ? 300 : 400;
      const scrollY = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
      setIsVisible(scrollY > threshold);
    };

    const target = scrollContainer || window;
    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef]);

  const handleScrollToTop = () => {
    const scrollContainer = scrollContainerRef?.current;
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button
      onClick={handleScrollToTop}
      className={`
        fixed z-20
        transition-all duration-300 ease-out
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--color-accent)]
        active:scale-95

        /* Mobile: bottom-right, icon only, larger touch target */
        right-4 bottom-4
        w-12 h-12
        flex items-center justify-center
        rounded-full

        /* Desktop: bottom-right, same position */
        sm:right-6 sm:bottom-6

        ${isVisible
          ? 'opacity-90 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
        }
      `}
      style={{
        fontFamily: 'var(--font-body)',
        color: 'var(--color-text-primary)',
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--color-accent)';
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--color-text-primary)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
      }}
      aria-label="Scroll to top"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
    </button>
  );
}
