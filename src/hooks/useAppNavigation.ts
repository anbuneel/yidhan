/**
 * The app's navigation vocabulary: one place that turns "go there" into a route.
 *
 * Every destination App names was a `useCallback` beside the last, and the six public
 * pages were then listed a second time to build `publicPageNav` — twelve lines saying
 * the same thing twice, in the file item 63 exists to shrink.
 *
 * Navigation runs inside a view transition. `navigateToRoute` is the general form; the
 * named ones exist because the components that call them take a bare `() => void`.
 */

import { useCallback, useMemo } from 'react';
import type { Route } from '../routing';
import type { PublicPageNav } from '../components/PublicPage';

export interface AppNavigation {
  navigateToRoute: (next: Route) => void;
  navigateHome: () => void;
  navigateToDemo: () => void;
  /** `/demo/new`: the Practice Space already in an empty note (item 45). */
  navigateToDemoDraft: () => void;
  publicPageNav: PublicPageNav;
}

export interface UseAppNavigationOptions {
  navigate: (route: Route) => void;
  runInTransition: (update: () => void) => void;
}

export function useAppNavigation({
  navigate,
  runInTransition,
}: UseAppNavigationOptions): AppNavigation {
  const navigateToRoute = useCallback((next: Route) => {
    runInTransition(() => navigate(next));
  }, [navigate, runInTransition]);

  return useMemo(() => ({
    navigateToRoute,
    navigateHome: () => navigateToRoute({ name: 'library' }),
    navigateToDemo: () => navigateToRoute({ name: 'demo' }),
    navigateToDemoDraft: () => navigateToRoute({ name: 'demo', newNote: true }),
    publicPageNav: {
      onLogoClick: () => navigateToRoute({ name: 'library' }),
      onChangelogClick: () => navigateToRoute({ name: 'changelog' }),
      onRoadmapClick: () => navigateToRoute({ name: 'roadmap' }),
      onPrivacyClick: () => navigateToRoute({ name: 'privacy' }),
      onTermsClick: () => navigateToRoute({ name: 'terms' }),
      onSupportClick: () => navigateToRoute({ name: 'support' }),
      // Reached from `/privacy` only, not the shared footer: `/privacy` says what we do
      // with your data, `/security` what an attacker would get. Item 39 stopped there
      // rather than threading it through every page.
      onSecurityClick: () => navigateToRoute({ name: 'security' }),
    },
  }), [navigateToRoute]);
}
