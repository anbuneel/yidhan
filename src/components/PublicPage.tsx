import { Suspense, type ReactNode } from 'react';
import type { Theme } from '../types';
import type { PublicPageName } from '../routing';
import { ErrorBoundary } from './ErrorBoundary';
import { LoadingFallback } from './LoadingFallback';
import { ChangelogPage } from './ChangelogPage';
import { RoadmapPage } from './RoadmapPage';
import { PrivacyPage } from './PrivacyPage';
import { TermsPage } from './TermsPage';
import { SupportPage } from './SupportPage';
import { SecurityPage } from './SecurityPage';

/**
 * The public pages differ only in their body. Each was written out in App with its own
 * error boundary, suspense fallback, nav wiring and auth modal — copies of the same
 * thirty lines, which is that many places for the footer links to drift apart.
 */

export interface PublicPageNav {
  onLogoClick: () => void;
  onChangelogClick: () => void;
  onRoadmapClick: () => void;
  onPrivacyClick: () => void;
  onTermsClick: () => void;
  onSupportClick: () => void;
  /**
   * Reached from `/privacy` only, not from the shared footer. `/privacy` says what we
   * do with your data; `/security` says what an attacker would get. The second is the
   * reader of the first's next question, and item 39 deliberately stopped there rather
   * than threading it through every page.
   */
  onSecurityClick: () => void;
}

interface PublicPageProps {
  page: PublicPageName;
  theme: Theme;
  onThemeToggle: () => void;
  onSignIn: () => void;
  onSettingsClick: () => void;
  nav: PublicPageNav;
  /** The auth modal, rendered above the page when it is open. */
  authModal?: ReactNode;
}

export function PublicPage({
  page,
  theme,
  onThemeToggle,
  onSignIn,
  onSettingsClick,
  nav,
  authModal,
}: PublicPageProps) {
  // Each page omits the link to itself, so the props are picked per page rather than
  // spread from one bundle.
  const shared = { theme, onThemeToggle, onSignIn, onSettingsClick, onLogoClick: nav.onLogoClick };

  const body = (() => {
    switch (page) {
      case 'changelog':
        return (
          <ChangelogPage
            {...shared}
            onRoadmapClick={nav.onRoadmapClick}
            onPrivacyClick={nav.onPrivacyClick}
            onTermsClick={nav.onTermsClick}
            onSupportClick={nav.onSupportClick}
          />
        );
      case 'roadmap':
        return (
          <RoadmapPage
            {...shared}
            onChangelogClick={nav.onChangelogClick}
            onPrivacyClick={nav.onPrivacyClick}
            onTermsClick={nav.onTermsClick}
            onSupportClick={nav.onSupportClick}
          />
        );
      case 'privacy':
        return (
          <PrivacyPage
            {...shared}
            onChangelogClick={nav.onChangelogClick}
            onRoadmapClick={nav.onRoadmapClick}
            onTermsClick={nav.onTermsClick}
            onSupportClick={nav.onSupportClick}
            onSecurityClick={nav.onSecurityClick}
          />
        );
      case 'terms':
        return (
          <TermsPage
            {...shared}
            onChangelogClick={nav.onChangelogClick}
            onRoadmapClick={nav.onRoadmapClick}
            onPrivacyClick={nav.onPrivacyClick}
            onSupportClick={nav.onSupportClick}
          />
        );
      case 'support':
        return (
          <SupportPage
            {...shared}
            onChangelogClick={nav.onChangelogClick}
            onRoadmapClick={nav.onRoadmapClick}
            onPrivacyClick={nav.onPrivacyClick}
            onTermsClick={nav.onTermsClick}
          />
        );
      case 'security':
        return (
          <SecurityPage
            {...shared}
            onChangelogClick={nav.onChangelogClick}
            onRoadmapClick={nav.onRoadmapClick}
            onPrivacyClick={nav.onPrivacyClick}
            onTermsClick={nav.onTermsClick}
            onSupportClick={nav.onSupportClick}
          />
        );
    }
  })();

  return (
    <>
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>{body}</Suspense>
      </ErrorBoundary>
      {authModal}
    </>
  );
}
