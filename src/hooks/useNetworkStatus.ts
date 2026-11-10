import { useCallback, useSyncExternalStore } from 'react';
import toast from 'react-hot-toast';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

export interface NetworkStatus {
  /** Whether the device/browser reports being online */
  isOnline: boolean;
  /** Callback to register for reconnect events (used by sync engine) */
  onReconnect: (callback: () => void) => () => void;
}

// Singleton state to prevent duplicate listeners across hook instances
let isInitialized = false;
let currentOnlineStatus = typeof navigator !== 'undefined' ? navigator.onLine : true;
let wasOffline = !currentOnlineStatus;
const reconnectCallbacks = new Set<() => void>();
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((sub) => sub());
}

function handleStatusChange(isOnline: boolean) {
  const previousStatus = currentOnlineStatus;
  currentOnlineStatus = isOnline;

  if (isOnline && wasOffline) {
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
  } else if (!isOnline && previousStatus) {
    toast('Offline. Your notes are safe locally.', {
      icon: '雲',
      duration: 4000,
      style: {
        background: 'var(--color-bg-secondary)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--glass-border)',
      },
    });
  }

  wasOffline = !isOnline;
  notifySubscribers();
}

async function initializeCapacitorNetwork() {
  try {
    // Get initial status
    const status = await Network.getStatus();
    currentOnlineStatus = status.connected;
    wasOffline = !status.connected;
    notifySubscribers();

    // Listen for changes
    await Network.addListener('networkStatusChange', (status) => {
      handleStatusChange(status.connected);
    });
  } catch (error) {
    console.warn('Capacitor Network plugin error, falling back to browser API:', error);
    // Fall back to browser API
    initializeBrowserNetwork();
  }
}

function initializeBrowserNetwork() {
  currentOnlineStatus = navigator.onLine;
  wasOffline = !navigator.onLine;
  notifySubscribers();

  window.addEventListener('online', () => handleStatusChange(true));
  window.addEventListener('offline', () => handleStatusChange(false));
}

function getSnapshot(): boolean {
  return currentOnlineStatus;
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);

  // Initialize listeners only once
  if (!isInitialized) {
    isInitialized = true;

    if (Capacitor.isNativePlatform()) {
      // Use Capacitor Network plugin for native apps
      initializeCapacitorNetwork();
    } else {
      // Use browser API for web
      initializeBrowserNetwork();
    }
  }

  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Hook that monitors network connectivity and shows toast notifications
 * when the user goes offline or comes back online.
 *
 * Uses Capacitor Network plugin for native apps (Android/iOS) which provides
 * more reliable network detection than the browser's navigator.onLine API.
 *
 * Uses calm messaging:
 * - Offline is presented as natural, not alarming
 * - Online return is quiet, not celebratory
 *
 * Uses singleton pattern to prevent duplicate listeners when called
 * from multiple components (App, useSyncEngine, useSyncStatus).
 */
export function useNetworkStatus(): NetworkStatus {
  // Use useSyncExternalStore for singleton pattern
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, () => true);

  const onReconnect = useCallback((callback: () => void) => {
    reconnectCallbacks.add(callback);
    return () => {
      reconnectCallbacks.delete(callback);
    };
  }, []);

  return { isOnline, onReconnect };
}
