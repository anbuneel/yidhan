import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

/**
 * Hook that monitors network connectivity and shows toast notifications
 * when the user goes offline or comes back online.
 *
 * Uses Zen-inspired messaging that aligns with wabi-sabi design:
 * - Offline is presented as natural, not alarming
 * - Online return is quiet, not celebratory
 */
export function useNetworkStatus() {
  const wasOffline = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      if (wasOffline.current) {
        toast('The path has cleared.', {
          icon: '〇',
          duration: 3000,
          style: {
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--glass-border)',
          },
        });
      }
      wasOffline.current = false;
    };

    const handleOffline = () => {
      wasOffline.current = true;
      toast('Connection lost. Changes may not be saved.', {
        icon: '雲',
        duration: 4000,
        style: {
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--glass-border)',
        },
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      wasOffline.current = true;
      toast('Connection lost. Changes may not be saved.', {
        icon: '雲',
        duration: 4000,
        style: {
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--glass-border)',
        },
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
}
