import { useState, useEffect, type CSSProperties, type RefObject } from 'react';

interface WhisperBackProps {
  scrollContainerRef?: RefObject<HTMLElement | null>;
  /** The phone bottom toolbar. Under 768px the button sits above it, the keyboard and
   *  the safe area (`.whisper-back-above-toolbar` in index.css). The toolbar's height,
   *  safe-area padding included, is measured rather than guessed. */
  bottomToolbarRef?: RefObject<HTMLElement | null>;
}

export function WhisperBack({ scrollContainerRef, bottomToolbarRef }: WhisperBackProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [toolbarHeight, setToolbarHeight] = useState<number | null>(null);

  useEffect(() => {
    const toolbar = bottomToolbarRef?.current;
    if (!toolbar) return;
    const measure = () => setToolbarHeight(toolbar.offsetHeight || null);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [bottomToolbarRef]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = scrollContainerRef?.current;
      // Show earlier on mobile (300px) vs desktop (400px)
      const threshold = window.innerWidth < 640 ? 300 : 400;
      const scrollY = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
      setIsVisible(scrollY > threshold);
    };

    // Try container first, fall back to window
    const scrollContainer = scrollContainerRef?.current;
    const target = scrollContainer || window;
    target.addEventListener('scroll', handleScroll, { passive: true });

    // If ref wasn't ready, also listen on window temporarily
    // and re-check when container becomes available
    if (!scrollContainer && scrollContainerRef) {
      let attachedContainer: HTMLElement | null = null;
      const checkRef = setInterval(() => {
        if (scrollContainerRef.current) {
          clearInterval(checkRef);
          window.removeEventListener('scroll', handleScroll);
          attachedContainer = scrollContainerRef.current;
          attachedContainer.addEventListener('scroll', handleScroll, { passive: true });
        }
      }, 100);
      return () => {
        clearInterval(checkRef);
        window.removeEventListener('scroll', handleScroll);
        attachedContainer?.removeEventListener('scroll', handleScroll);
      };
    }

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
    <button type="button"
      onClick={handleScrollToTop}
      className={`
        fixed z-20
        ${bottomToolbarRef ? 'whisper-back-above-toolbar' : ''}
        transition-all duration-300 ease-out
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--color-accent)]
        active:scale-95

        /* Mobile: bottom-right, icon only, larger touch target */
        right-4 bottom-4
        size-12
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
        ...(toolbarHeight ? ({ '--whisper-toolbar-offset': `${toolbarHeight}px` } as CSSProperties) : {}),
        fontFamily: 'var(--font-body)',
        color: 'var(--color-text-primary)',
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--color-accent)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--color-text-primary)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
      aria-label="Scroll to top"
    >
      <svg
        className="size-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M5 15l7-7 7 7"
        />
      </svg>
    </button>
  );
}
