import type { Ref } from 'react';
import './Footer.css';

interface FooterProps {
  ref?: Ref<HTMLElement>;
  /**
   * Each link is a button when its handler is given and a plain link when it is not.
   * The app always passes handlers; the static documents for JavaScript-off visitors
   * pass none (src/prerender/publicPageDocument.tsx, item 60).
   */
  onChangelogClick?: () => void;
  onRoadmapClick?: () => void;
  onShortcutsClick?: () => void;
  onPrivacyClick?: () => void;
  onTermsClick?: () => void;
  onSupportClick?: () => void;
}

function FooterItem({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick?: () => void;
  children: string;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="footer-link hover:underline transition-colors duration-200"
      >
        {children}
      </button>
    );
  }

  return (
    <a
      href={href}
      className="footer-link hover:underline transition-colors duration-200"
    >
      {children}
    </a>
  );
}

export function Footer({
  ref,
  onChangelogClick,
  onRoadmapClick,
  onShortcutsClick,
  onPrivacyClick,
  onTermsClick,
  onSupportClick,
}: FooterProps) {
  return (
    <footer ref={ref} className="py-6 px-4 text-center shrink-0">
      <nav
        className="flex items-center justify-center gap-2 text-sm flex-wrap"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        <FooterItem href="/changelog" onClick={onChangelogClick}>
          Changelog
        </FooterItem>
        <span aria-hidden="true">·</span>
        <FooterItem href="/roadmap" onClick={onRoadmapClick}>
          Roadmap
        </FooterItem>
        {onShortcutsClick && (
          <>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={onShortcutsClick}
              className="footer-link hover:underline transition-colors duration-200"
            >
              Shortcuts
            </button>
          </>
        )}
        <span aria-hidden="true">·</span>
        <a
          href="https://github.com/anbuneel/yidhan"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link hover:underline transition-colors duration-200"
        >
          GitHub
        </a>
        <span aria-hidden="true">·</span>
        <FooterItem href="/privacy" onClick={onPrivacyClick}>
          Privacy
        </FooterItem>
        <span aria-hidden="true">·</span>
        <FooterItem href="/terms" onClick={onTermsClick}>
          Terms
        </FooterItem>
        <span aria-hidden="true">·</span>
        <FooterItem href="/support" onClick={onSupportClick}>
          Support
        </FooterItem>
      </nav>
    </footer>
  );
}
