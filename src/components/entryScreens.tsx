import { Suspense, type ReactNode } from 'react';
import type { Theme } from '../types';
import { isPublicPageRoute, type Route } from '../routing';
import { Auth } from './Auth';
import { LandingPage } from './LandingPage';
import { NotFoundPage } from './NotFoundPage';
import { PublicPage, type PublicPageNav } from './PublicPage';
import { ErrorBoundary } from './ErrorBoundary';
import { LoadingFallback } from './LoadingFallback';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { DemoPage } from '../pages/DemoPage';

const SharedNoteView = lazyWithRetry(() =>
  import('./SharedNoteView').then((m) => ({ default: m.SharedNoteView }))
);
const PlaygroundPage = import.meta.env.DEV
  ? lazyWithRetry(() => import('../pages/PlaygroundPage').then((m) => ({ default: m.PlaygroundPage })))
  : null;

/**
 * Every screen that can appear before the library does: a password reset, a shared
 * letter, a 404, the dev playground, the Practice Space, the five public pages, and
 * the landing page.
 *
 * A render function rather than a component, deliberately. It holds no state and calls
 * no hooks, and returning `null` for "none of these" is what lets App keep the gates
 * in one `if` instead of seven.
 */
export interface EntryScreenProps {
  route: Route;
  theme: Theme;
  onThemeToggle: () => void;
  isSignedIn: boolean;

  isPasswordRecovery: boolean;
  onPasswordResetComplete: () => void;

  shareRoute: { token: string; shareKey: Uint8Array } | null;
  onShareInvalid: () => void;

  nav: PublicPageNav;
  onDemoClick: () => void;
  onDemoDraftClick: () => void;
  /** Drop the `/demo/new` intent once the arrival note exists. */
  onDemoNoteStarted: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onSettingsClick: () => void;
  /** The auth modal these screens can open; built here because nothing else uses it. */
  authModal: { isOpen: boolean; mode: 'login' | 'signup'; onClose: () => void };
}


export function renderEntryScreen({
  route,
  theme,
  onThemeToggle,
  isSignedIn,
  isPasswordRecovery,
  onPasswordResetComplete,
  shareRoute,
  onShareInvalid,
  nav,
  onDemoClick,
  onDemoDraftClick,
  onDemoNoteStarted,
  onSignIn,
  onSignUp,
  onSettingsClick,
  authModal: authModalState,
}: EntryScreenProps): ReactNode | null {
  const authModal = authModalState.isOpen ? (
    <Auth
      theme={theme}
      onThemeToggle={onThemeToggle}
      initialMode={authModalState.mode}
      isModal
      onClose={authModalState.onClose}
    />
  ) : null;

  // A recovery link wins over everything, even an authenticated session.
  if (isPasswordRecovery) {
    return (
      <Auth
        theme={theme}
        onThemeToggle={onThemeToggle}
        initialMode="reset"
        onPasswordResetComplete={onPasswordResetComplete}
      />
    );
  }

  if (shareRoute) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback message="Loading shared note..." />}>
          <SharedNoteView
            token={shareRoute.token}
            shareKey={shareRoute.shareKey}
            theme={theme}
            onThemeToggle={onThemeToggle}
            onInvalidToken={onShareInvalid}
            onChangelogClick={nav.onChangelogClick}
            onRoadmapClick={nav.onRoadmapClick}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (route.name === 'notFound') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <NotFoundPage onGoHome={nav.onLogoClick} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (route.name === 'playground' && PlaygroundPage) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <PlaygroundPage theme={theme} onThemeToggle={onThemeToggle} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (route.name === 'demo' && !isSignedIn) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback message="Preparing your practice space..." />}>
          <DemoPage
            onSignUp={onSignUp}
            startWithNewNote={route.newNote === true}
            onNewNoteStarted={onDemoNoteStarted}
            onSignIn={onSignIn}
            theme={theme}
            onThemeToggle={onThemeToggle}
            onHomeClick={nav.onLogoClick}
            onChangelogClick={nav.onChangelogClick}
            onRoadmapClick={nav.onRoadmapClick}
            onPrivacyClick={nav.onPrivacyClick}
            onTermsClick={nav.onTermsClick}
            onSupportClick={nav.onSupportClick}
          />
        </Suspense>
        {authModal}
      </ErrorBoundary>
    );
  }

  if (isPublicPageRoute(route)) {
    return (
      <PublicPage
        page={route.name}
        theme={theme}
        onThemeToggle={onThemeToggle}
        onSignIn={onSignIn}
        onSettingsClick={onSettingsClick}
        nav={nav}
        authModal={authModal}
      />
    );
  }

  if (!isSignedIn) {
    return (
      <>
        <LandingPage
          onStartWriting={onSignUp}
          onSignIn={onSignIn}
          theme={theme}
          onThemeToggle={onThemeToggle}
          onDemoClick={onDemoClick}
          onDemoDraftClick={onDemoDraftClick}
          onSecurityClick={nav.onSecurityClick}
          onChangelogClick={nav.onChangelogClick}
          onRoadmapClick={nav.onRoadmapClick}
          onPrivacyClick={nav.onPrivacyClick}
          onTermsClick={nav.onTermsClick}
          onSupportClick={nav.onSupportClick}
        />
        {authModal}
      </>
    );
  }

  return null;
}
