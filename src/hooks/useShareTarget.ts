import { useState, useCallback } from 'react';

/**
 * Hook to handle Share Target API data.
 *
 * When the app opens from a share action:
 * 1. Parse query params for shared content
 * 2. Store in localStorage (for unauthenticated users)
 * 3. Clean URL params to prevent re-processing
 * 4. Return shared data for component consumption
 */

export interface SharedData {
  title: string | null;
  text: string | null;
  url: string | null;
}

const SHARE_STORAGE_KEY = 'zenote-shared-content';

/**
 * Format shared data into note content
 */
export function formatSharedContent(data: SharedData): {
  title: string;
  content: string;
} {
  const parts: string[] = [];

  if (data.text) {
    parts.push(`<p>${escapeHtml(data.text)}</p>`);
  }

  if (data.url) {
    // Only create clickable link for safe URLs (http/https)
    if (isSafeUrl(data.url)) {
      parts.push(`<p><a href="${escapeHtml(data.url)}">${escapeHtml(data.url)}</a></p>`);
    } else {
      // Show URL as plain text if protocol is unsafe
      parts.push(`<p>${escapeHtml(data.url)}</p>`);
    }
  }

  return {
    title: data.title || 'Shared note',
    content: parts.length > 0 ? parts.join('') : '<p></p>',
  };
}

/**
 * Escape HTML special characters for safe insertion
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate URL has safe protocol (prevents javascript: XSS)
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Get initial share data from URL params or localStorage
 * This runs once during state initialization
 */
function getInitialShareData(): { data: SharedData | null; hasStored: boolean } {
  if (typeof window === 'undefined') {
    return { data: null, hasStored: false };
  }

  const params = new URLSearchParams(window.location.search);
  const isShare = params.get('share') === 'true';

  if (isShare) {
    const data: SharedData = {
      title: params.get('title'),
      text: params.get('text'),
      url: params.get('url'),
    };

    // Only process if there's actual content
    if (data.title || data.text || data.url) {
      // Store in localStorage for unauthenticated users
      localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(data));

      // Clean URL (prevents re-processing on refresh)
      window.history.replaceState({}, '', window.location.pathname);

      return { data, hasStored: true };
    }
  }

  // Check for previously stored share data
  const stored = localStorage.getItem(SHARE_STORAGE_KEY);
  if (stored) {
    try {
      return { data: JSON.parse(stored), hasStored: true };
    } catch {
      localStorage.removeItem(SHARE_STORAGE_KEY);
    }
  }

  return { data: null, hasStored: false };
}

export function useShareTarget(): {
  sharedData: SharedData | null;
  clearSharedData: () => void;
  hasStoredShare: boolean;
} {
  const [{ data: sharedData, hasStored: hasStoredShare }, setShareState] = useState(
    getInitialShareData
  );

  const clearSharedData = useCallback(() => {
    localStorage.removeItem(SHARE_STORAGE_KEY);
    setShareState({ data: null, hasStored: false });
  }, []);

  return { sharedData, clearSharedData, hasStoredShare };
}
