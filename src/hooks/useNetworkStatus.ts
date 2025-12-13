import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

/**
 * Hook that monitors network connectivity and shows toast notifications
 * when the user goes offline or comes back online.
 */
export function useNetworkStatus() {
  const wasOffline = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      if (wasOffline.current) {
        toast.success('Back online', {
          icon: '🌐',
          duration: 3000,
        });
      }
      wasOffline.current = false;
    };

    const handleOffline = () => {
      wasOffline.current = true;
      toast.error('You are offline. Changes may not be saved.', {
        icon: '📡',
        duration: 5000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      wasOffline.current = true;
      toast.error('You are offline. Changes may not be saved.', {
        icon: '📡',
        duration: 5000,
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
}
