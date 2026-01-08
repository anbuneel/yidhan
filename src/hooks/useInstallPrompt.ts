import { useState, useCallback, useSyncExternalStore } from 'react';

/**
 * Hook to manage PWA install prompt with engagement tracking.
 *
 * Features:
 * - Captures beforeinstallprompt event (singleton pattern)
 * - Tracks user engagement (notes created, visits)
 * - Shows custom prompt after engagement threshold
 * - Respects user dismissal
 */

// Engagement thresholds
const ENGAGEMENT_THRESHOLD = {
  notesCreated: 3,
  visits: 2,
};

const STORAGE_KEYS = {
  engagement: 'zenote-engagement',
  installDismissed: 'zenote-install-dismissed',
  installPrompted: 'zenote-install-prompted',
};

interface EngagementData {
  notesCreated: number;
  visits: number;
  lastVisit: string;
}

// BeforeInstallPromptEvent type (not in standard TypeScript lib)
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Singleton state for deferred prompt
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let isInitialized = false;
const subscribers = new Set<() => void>();

function getSnapshot(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

function getServerSnapshot(): BeforeInstallPromptEvent | null {
  return null;
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);

  // Set up event listeners only once
  if (!isInitialized) {
    isInitialized = true;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      subscribers.forEach((cb) => cb());
    };

    const handleAppInstalled = () => {
      deferredPrompt = null;
      subscribers.forEach((cb) => cb());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
  }

  return () => {
    subscribers.delete(callback);
  };
}

function getInitialEngagement(): EngagementData {
  const today = new Date().toDateString();
  let data: EngagementData = { notesCreated: 0, visits: 0, lastVisit: '' };

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.engagement);
    if (stored) {
      data = JSON.parse(stored);
    }
  } catch {
    // Fallback to defaults
  }

  // Track visit if last visit was a different day
  if (data.lastVisit !== today) {
    data = {
      ...data,
      visits: data.visits + 1,
      lastVisit: today,
    };
    localStorage.setItem(STORAGE_KEYS.engagement, JSON.stringify(data));
  }

  return data;
}

export function useInstallPrompt() {
  const prompt = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [engagement, setEngagement] = useState<EngagementData>(getInitialEngagement);

  const [isDismissed, setIsDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEYS.installDismissed) === 'true'
  );

  const [hasBeenPrompted, setHasBeenPrompted] = useState(
    () => localStorage.getItem(STORAGE_KEYS.installPrompted) === 'true'
  );

  // Track note creation (called by App.tsx)
  const trackNoteCreated = useCallback(() => {
    setEngagement((prev) => {
      // Skip update if threshold already met (optimization)
      if (prev.notesCreated >= ENGAGEMENT_THRESHOLD.notesCreated) {
        return prev;
      }
      const updated = {
        ...prev,
        notesCreated: prev.notesCreated + 1,
      };
      localStorage.setItem(STORAGE_KEYS.engagement, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Check if engagement threshold is met
  const isEngaged =
    engagement.notesCreated >= ENGAGEMENT_THRESHOLD.notesCreated ||
    engagement.visits >= ENGAGEMENT_THRESHOLD.visits;

  // Should show custom install prompt
  const shouldShowPrompt =
    prompt !== null && isEngaged && !isDismissed && !hasBeenPrompted;

  // Trigger native install prompt
  const triggerInstall = useCallback(async () => {
    if (!prompt) return false;

    setHasBeenPrompted(true);
    localStorage.setItem(STORAGE_KEYS.installPrompted, 'true');

    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      return choice.outcome === 'accepted';
    } catch (error) {
      console.error('Install prompt failed:', error);
      return false;
    } finally {
      // Clear prompt after any completion (accept or dismiss)
      // A consumed prompt cannot be reused
      deferredPrompt = null;
      subscribers.forEach((cb) => cb());
    }
  }, [prompt]);

  // Dismiss prompt permanently
  const dismissPrompt = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(STORAGE_KEYS.installDismissed, 'true');
  }, []);

  // Check if app is installable (prompt available)
  const isInstallable = prompt !== null;

  // Check if running as installed PWA
  const isInstalled =
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches;

  return {
    isInstallable,
    isInstalled,
    shouldShowPrompt,
    triggerInstall,
    dismissPrompt,
    trackNoteCreated,
  };
}
