/**
 * The public shell (item 61, step 5): the landing page and the six public pages,
 * rendered without Supabase, Dexie, the sync engine or the rest of the app.
 *
 * It renders only for a visitor src/appGate.ts found signed out. It never signs
 * anyone in: opening sign-in or sign-up, or leaving the public routes (the Practice
 * Space, a shared letter, a 404), hands over to the app shell, which loads lazily and
 * renders the same page with the auth modal open. No reload either way.
 *
 * Keep this file's imports small: everything it imports statically is on the landing
 * page's critical path, and scripts/check-bundle-budget.mjs holds that path to its
 * budget.
 */

import { useEffect, useState } from 'react';
import { isPublicShellRoute } from '../appGate';
import { LandingPage } from '../components/LandingPage';
import { LoadingFallback } from '../components/LoadingFallback';
import { PublicPage } from '../components/PublicPage';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { useAppTheme } from '../hooks/useAppTheme';
import { useViewTransition } from '../hooks/useViewTransition';
import { isPublicPageRoute, routeToDocumentTitle, useRouter, type Route } from '../routing';

type AuthIntent = 'login' | 'signup';

export interface AppStart {
  /** True when the visitor came from the public shell rather than straight in. */
  fromPublicShell: boolean;
  /** The auth modal to open once the app shell has loaded. */
  authModal?: AuthIntent;
}

interface PublicShellProps {
  onStartApp: (start: AppStart) => void;
}

const noop = () => {};

export function PublicShell({ onStartApp }: PublicShellProps) {
  const { route, navigate } = useRouter({ allowPlayground: import.meta.env.DEV });
  const { startTransition } = useViewTransition();
  const { navigateToDemo, navigateToDemoDraft, publicPageNav } = useAppNavigation({
    navigate,
    runInTransition: startTransition,
  });
  const { theme, toggleTheme } = useAppTheme();

  const documentTitle = routeToDocumentTitle(route);
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  const isPublic = isPublicShellRoute(route);
  useEffect(() => {
    if (!isPublic) onStartApp({ fromPublicShell: true });
  }, [isPublic, onStartApp]);

  // On a route this shell does not render (Try writing reaches `/demo/new`), keep the
  // last public page on screen while the app shell loads, rather than a spinner. Root
  // starts the app in a transition, so React holds this until the app can render.
  const [shownRoute, setShownRoute] = useState<Route>(route);
  if (isPublic && shownRoute !== route) setShownRoute(route);
  const page = isPublic ? route : shownRoute;
  if (!isPublicShellRoute(page)) return <LoadingFallback />;

  const onSignIn = () => onStartApp({ fromPublicShell: true, authModal: 'login' });
  const onSignUp = () => onStartApp({ fromPublicShell: true, authModal: 'signup' });

  if (isPublicPageRoute(page)) {
    return (
      <PublicPage
        page={page.name}
        theme={theme}
        onThemeToggle={toggleTheme}
        onSignIn={onSignIn}
        // Settings live in the profile menu, which only a signed-in reader sees.
        onSettingsClick={noop}
        nav={publicPageNav}
      />
    );
  }

  return (
    <LandingPage
      onStartWriting={onSignUp}
      onSignIn={onSignIn}
      theme={theme}
      onThemeToggle={toggleTheme}
      onDemoClick={navigateToDemo}
      onDemoDraftClick={navigateToDemoDraft}
      onSecurityClick={publicPageNav.onSecurityClick}
      onChangelogClick={publicPageNav.onChangelogClick}
      onRoadmapClick={publicPageNav.onRoadmapClick}
      onPrivacyClick={publicPageNav.onPrivacyClick}
      onTermsClick={publicPageNav.onTermsClick}
      onSupportClick={publicPageNav.onSupportClick}
    />
  );
}
