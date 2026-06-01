/**
 * ImpermanenceRibbon
 *
 * A slim editorial notice that reminds demo users their notes are browser-local.
 * Styled as an integrated subheader rather than an alert strip, with gentle
 * entry/exit animations aligned with Yidhan's calm aesthetic.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface ImpermanenceRibbonProps {
  onSignUp: () => void;
  onDismiss: () => void;
}

export function ImpermanenceRibbon({ onSignUp, onDismiss }: ImpermanenceRibbonProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fade in on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Clean up dismiss timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    dismissTimerRef.current = setTimeout(() => onDismiss(), 300);
  }, [isExiting, onDismiss]);

  return (
    <div
      className="relative overflow-hidden transition-all duration-300 ease-out"
      style={{
        maxHeight: isExiting ? '0px' : '40px',
        opacity: isVisible && !isExiting ? 1 : 0,
      }}
    >
      <div
        className="flex items-center justify-center gap-2.5 px-4 py-2"
        style={{
          borderBottom: '1px dashed var(--glass-border)',
        }}
      >
        {/* Pulsing dot indicator */}
        <span
          className="size-1 rounded-full flex-shrink-0"
          style={{
            background: 'var(--color-accent)',
            animation: 'demo-ribbon-pulse 3s ease-in-out infinite',
          }}
        />

        {/* Message */}
        <span
          className="text-xs"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
            letterSpacing: '0.02em',
          }}
        >
          Your notes live in this browser
          <span className="hidden sm:inline">
            {' '}&middot;{' '}
            <button type="button"
              onClick={onSignUp}
              className="transition-colors duration-200"
              style={{
                color: 'var(--color-accent)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderBottom: '1px dotted var(--color-accent)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderBottomStyle = 'solid';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderBottomStyle = 'dotted';
              }}
            >
              Sign up to keep them
            </button>
          </span>
        </span>

        {/* Mobile sign up link */}
        <button type="button"
          onClick={onSignUp}
          className="sm:hidden text-xs transition-colors duration-200"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: '1px dotted var(--color-accent)',
          }}
        >
          Keep them
        </button>

        {/* Dismiss button */}
        <button type="button"
          onClick={handleDismiss}
          className="absolute right-3 sm:right-4 p-0.5 rounded opacity-30 hover:opacity-100 transition-opacity duration-200"
          style={{ color: 'var(--color-text-tertiary)' }}
          aria-label="Dismiss"
        >
          <svg
            className="size-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
