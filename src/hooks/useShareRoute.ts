/**
 * The shared-letter route, and the key that arrives with it.
 *
 * The key lives in the URL fragment so it never reaches the server. Once it has been
 * copied to sessionStorage the fragment is stripped — defense in depth against the
 * address bar, browser history, or a screenshot carrying it further than the link did.
 * The strip only happens *after* the copy succeeds, so the URL stays the fallback when
 * sessionStorage is unavailable.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  clearPersistedShareKey,
  parseShareRoute,
  preserveShareKeyFromLocation,
  type ShareRouteState,
} from '../utils/shareRoute';

export interface ShareRoute {
  shareRoute: ShareRouteState | null;
  /** Forget an invalid or revoked token and stop showing the shared view. */
  dismissShareRoute: () => void;
}

export function useShareRoute(): ShareRoute {
  const [shareRoute, setShareRoute] = useState<ShareRouteState | null>(() =>
    parseShareRoute(window.location.pathname, window.location.hash)
  );

  useEffect(() => {
    if (!shareRoute || !window.location.hash.startsWith('#k=')) return;

    if (preserveShareKeyFromLocation(window.location.pathname, window.location.hash)) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [shareRoute]);

  const dismissShareRoute = useCallback(() => {
    setShareRoute((current) => {
      if (current) clearPersistedShareKey(current.token);
      return null;
    });
  }, []);

  return { shareRoute, dismissShareRoute };
}
