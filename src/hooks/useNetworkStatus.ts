import { useCallback, useSyncExternalStore } from 'react';
import toast from 'react-hot-toast';

export interface NetworkStatus {
  /** Whether the browser reports being online */
  isOnline: boolean;
  /** Callback to register for reconnect events (used by sync engine) */
  onReconnect: (callback: () => void) => () => void;
}

// Singleton state to prevent duplicate listeners across hook instances
let isInitialized = false;
let wasOffline = !navigator.onLine;
const reconnectCallbacks = new Set<() => void>();
const subscribers = new Set<() => void>();

function getSnapshot(): boolean {
  return navigator.onLine;
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);

  // Initialize listeners only once
  if (!isInitialized) {
    isInitialized = true;

    const handleOnline = () => {
      if (wasOffline) {
        toast('The path has cleared.', {
          icon: '〇',
          duration: 3000,
          style: {
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--glass-border)',
          },
        });

        // Trigger all reconnect callbacks (for sync engine)
        reconnectCallbacks.forEach((cb) => cb());
      }
      wasOffline = false;
      subscribers.forEach((sub) => sub());
    };

    const handleOffline = () => {
      wasOffline = true;
      toast('Offline. Your notes are safe locally.', {
        icon: '雲',
        duration: 4000,
        style: {
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--glass-border)',
        },
      });
      subscribers.forEach((sub) => sub());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Hook that monitors network connectivity and shows toast notifications
 * when the user goes offline or comes back online.
 *
 * Uses Zen-inspired messaging that aligns with wabi-sabi design:
 * - Offline is presented as natural, not alarming
 * - Online return is quiet, not celebratory
 *
 * Uses singleton pattern to prevent duplicate listeners when called
 * from multiple components (App, useSyncEngine, useSyncStatus).
 */
export function useNetworkStatus(): NetworkStatus {
  // Use useSyncExternalStore for singleton pattern
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const onReconnect = useCallback((callback: () => void) => {
    reconnectCallbacks.add(callback);
    return () => {
      reconnectCallbacks.delete(callback);
    };
  }, []);

  return { isOnline, onReconnect };
}
