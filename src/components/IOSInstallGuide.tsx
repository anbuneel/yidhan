import { useEffect, useState, useMemo } from 'react';

// Animation timing constants
const ENTRANCE_DELAY = 300; // Delay before showing guide
const SPRING_TRANSITION_DURATION = 400; // Must match CSS transition duration

interface IOSInstallGuideProps {
  onDismiss: () => void;
}

/**
 * Detect which iOS browser the user is on.
 * All iOS browsers use WebKit, but only Safari can install PWAs.
 */
function detectIOSBrowser(): 'safari' | 'chrome' | 'firefox' | 'edge' | 'other' {
  const ua = navigator.userAgent;

  // Check for non-Safari browsers first (they include Safari in UA but add their own identifier)
  if (/CriOS/.test(ua)) return 'chrome';
  if (/FxiOS/.test(ua)) return 'firefox';
  if (/EdgiOS/.test(ua)) return 'edge';

  // If it says Safari and none of the above, it's actual Safari
  if (/Safari/.test(ua)) return 'safari';

  return 'other';
}

/**
 * Visual tutorial for iOS users to install Yidhan as a PWA.
 *
 * iOS Safari doesn't support the beforeinstallprompt API, so users must
 * manually "Add to Home Screen" via the share sheet. This component
 * provides a clear, step-by-step visual guide.
 *
 * For non-Safari iOS browsers (Chrome, Firefox, Edge), it explains that
 * they need to open in Safari since only Safari can install PWAs on iOS.
 *
 * Design philosophy:
 * - Matches wabi-sabi aesthetic
 * - Clear visual steps with Safari icons
 * - Non-intrusive, easy to dismiss
 * - Appears as a gentle guide, not a demand
 */
export function IOSInstallGuide({ onDismiss }: IOSInstallGuideProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Detect browser once on mount
  const browser = useMemo(() => detectIOSBrowser(), []);
  const isNonSafariBrowser = browser !== 'safari';

  // Get friendly browser name for display
  const browserName = useMemo(() => {
    switch (browser) {
      case 'chrome': return 'Chrome';
      case 'firefox': return 'Firefox';
      case 'edge': return 'Edge';
      default: return 'this browser';
    }
  }, [browser]);

  // Animate in after short delay
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), ENTRANCE_DELAY);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    // Wait for spring transition to complete before unmounting
    setTimeout(onDismiss, SPRING_TRANSITION_DURATION);
  };

  const steps = [
    {
      icon: <ShareIcon />,
      title: 'Tap the Share button',
      description: 'Find the share icon in Safari\'s toolbar',
    },
    {
      icon: <AddToHomeIcon />,
      title: 'Scroll and tap "Add to Home Screen"',
      description: 'It\'s in the action list below',
    },
    {
      icon: <ConfirmIcon />,
      title: 'Tap "Add" to confirm',
      description: 'Yidhan will appear on your home screen',
    },
  ];

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-end justify-center
        transition-all duration-300
        ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-guide-title"
    >
      {/* Guide panel */}
      <div
        className={`
          w-full max-w-md mx-4 mb-4 p-6
          ${isVisible ? 'translate-y-0' : 'translate-y-8'}
        `}
        style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-card)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          transition: 'transform 0.4s var(--spring-bounce), opacity 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2
              id="ios-guide-title"
              className="text-lg font-medium mb-1"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              {isNonSafariBrowser ? 'Open in Safari' : 'Add Yidhan to Home Screen'}
            </h2>
            <p
              className="text-sm"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {isNonSafariBrowser
                ? 'Safari is required to install apps on iOS'
                : 'Quick access, works offline'}
            </p>
          </div>

          <button
            onClick={handleDismiss}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:opacity-70"
            style={{
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-secondary)',
            }}
            aria-label="Close guide"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isNonSafariBrowser ? (
          /* Non-Safari browser message */
          <>
            <div
              className="p-5 rounded-lg mb-4"
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--glass-border)',
              }}
            >
              {/* Safari icon */}
              <div className="flex justify-center mb-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #0066CC 0%, #00A8E8 100%)',
                  }}
                >
                  <SafariIcon />
                </div>
              </div>

              <p
                className="text-sm text-center mb-4"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-primary)',
                  lineHeight: 1.6,
                }}
              >
                {browserName} can't install apps on iOS.
                <br />
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  Copy this link and open it in Safari:
                </span>
              </p>

              {/* URL display with copy button */}
              <div
                className="flex items-center gap-2 p-3 rounded-lg"
                style={{
                  background: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <span
                  className="flex-1 text-xs truncate"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {typeof window !== 'undefined' ? window.location.href : 'yidhan.vercel.app'}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                  }}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{
                    background: 'var(--color-accent)',
                    color: 'var(--color-bg-primary)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Steps for Safari */}
            <p
              className="text-xs text-center"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              Once in Safari, tap Share → "Add to Home Screen"
            </p>
          </>
        ) : (
          /* Safari install steps */
          <>
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={`
                    flex items-start gap-4 p-4 rounded-lg
                    transition-all duration-300 cursor-pointer
                    ${currentStep === index ? 'scale-[1.02]' : 'hover:scale-[1.01]'}
                  `}
                  style={{
                    background: currentStep === index
                      ? 'var(--color-accent-glow)'
                      : 'var(--color-bg-secondary)',
                    border: currentStep === index
                      ? '1px solid var(--color-accent)'
                      : '1px solid transparent',
                  }}
                  onClick={() => setCurrentStep(index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setCurrentStep(index)}
                >
                  {/* Step number */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-medium"
                    style={{
                      background: currentStep === index ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                      color: currentStep === index ? 'var(--color-bg-primary)' : 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {index + 1}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-5 h-5"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        {step.icon}
                      </span>
                      <h3
                        className="text-sm font-medium"
                        style={{
                          fontFamily: 'var(--font-body)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {step.title}
                      </h3>
                    </div>
                    <p
                      className="text-xs"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <p
              className="mt-6 text-center text-xs"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              Yidhan will appear on your home screen
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// Safari Share Icon (matches iOS Safari exactly)
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3v11.25" />
    </svg>
  );
}

// Add to Home Screen Icon
function AddToHomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      <rect x="3" y="3" width="18" height="18" rx="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Confirm/Check Icon
function ConfirmIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

// Safari Compass Icon (for non-Safari browser message)
function SafariIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8">
      {/* Compass needle */}
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fillOpacity={0.3} />
      <path d="M12 12l-4 6 6-4 4-6-6 4z" />
    </svg>
  );
}
