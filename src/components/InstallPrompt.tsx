import { useEffect, useState } from 'react';

interface InstallPromptProps {
  onInstall: () => Promise<boolean>;
  onDismiss: () => void;
}

/**
 * Zen-styled install prompt for PWA installation.
 *
 * Design philosophy:
 * - Calm, not pushy
 * - Matches wabi-sabi aesthetic
 * - Easy to dismiss
 * - Appears as gentle suggestion
 */
export function InstallPrompt({ onInstall, onDismiss }: InstallPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Animate in after short delay (feels more natural)
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    setIsInstalling(true);
    const success = await onInstall();
    if (!success) {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Wait for animation to complete
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2
        px-6 py-4
        max-w-sm w-[calc(100%-2rem)]
        shadow-lg
        transition-all duration-300 ease-out
        z-50
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-card)',
      }}
      role="dialog"
      aria-labelledby="install-prompt-title"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--color-accent-glow)' }}
        >
          <svg
            className="w-5 h-5"
            style={{ color: 'var(--color-accent)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3
            id="install-prompt-title"
            className="text-sm font-medium mb-1"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
            }}
          >
            Add Zenote to your device
          </h3>
          <p
            className="text-xs"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            Quick access, works offline
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 hover:opacity-70"
          style={{ color: 'var(--color-text-tertiary)' }}
          aria-label="Dismiss"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
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

      {/* Action button */}
      <button
        onClick={handleInstall}
        disabled={isInstalling}
        aria-busy={isInstalling}
        className="w-full mt-4 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 hover:opacity-90"
        style={{
          fontFamily: 'var(--font-body)',
          background: 'var(--color-accent)',
          color: 'var(--color-bg-primary)',
        }}
      >
        {isInstalling ? (
          <>
            <span
              className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
              style={{
                borderColor: 'var(--color-bg-primary)',
                borderTopColor: 'transparent',
              }}
            />
            Installing...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Install
          </>
        )}
      </button>
    </div>
  );
}
