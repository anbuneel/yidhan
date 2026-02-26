import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

interface WelcomeBackPromptProps {
  daysRemaining: number;
  onStay: () => void;
  onContinue: () => void;
}

export function WelcomeBackPrompt({ daysRemaining, onStay, onContinue }: WelcomeBackPromptProps) {
  const { cancelOffboarding, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleStay = async () => {
    setIsLoading(true);
    try {
      const { error } = await cancelOffboarding();
      if (error) {
        toast.error('Something went wrong. Please try again.');
        return;
      }

      toast.success('Welcome home');
      onStay();
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    await signOut();
    onContinue();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div
        className="
          w-full max-w-sm
          shadow-2xl
          animate-[modal-enter_300ms_ease-out]
        "
        style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--glass-border)',
        }}
      >
        {/* Content */}
        <div className="px-8 py-8 text-center">
          {/* Welcome back header */}
          <h2
            className="text-2xl mb-6"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
            }}
          >
            Welcome back
          </h2>

          {/* Status message */}
          <p
            className="text-sm mb-2"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Your account is fading quietly.
          </p>

          {/* Days remaining */}
          <p
            className="text-sm mb-8"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            Releasing in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}.
          </p>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleContinue}
              className="
                flex-1 py-3
                rounded-lg
                font-medium
                transition-all duration-200
              "
              style={{
                fontFamily: 'var(--font-body)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--glass-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-accent)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--glass-border)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              Continue letting go
            </button>
            <button
              onClick={handleStay}
              disabled={isLoading}
              className="
                flex-1 py-3
                rounded-lg
                font-medium
                transition-all duration-200
                disabled:opacity-50
              "
              style={{
                fontFamily: 'var(--font-body)',
                background: 'var(--color-cta-bg)',
                color: 'var(--color-cta-text)',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'var(--color-cta-bg-hover)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-cta-bg)';
              }}
            >
              {isLoading ? 'Staying...' : 'Stay'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
