import './Footer.css';

interface FooterProps {
  onChangelogClick: () => void;
  onRoadmapClick: () => void;
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
  onChangelogClick,
  onRoadmapClick,
  onShortcutsClick,
  onPrivacyClick,
  onTermsClick,
  onSupportClick,
}: FooterProps) {
  return (
    <footer className="py-6 px-4 text-center shrink-0">
      <nav
        className="flex items-center justify-center gap-2 text-sm flex-wrap"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        <button
          type="button"
          onClick={onChangelogClick}
          className="footer-link hover:underline transition-colors duration-200"
        >
          Changelog
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={onRoadmapClick}
          className="footer-link hover:underline transition-colors duration-200"
        >
          Roadmap
        </button>
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
