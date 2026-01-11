import './Footer.css';

interface FooterProps {
  onChangelogClick: () => void;
  onRoadmapClick: () => void;
  onShortcutsClick?: () => void;
}

export function Footer({ onChangelogClick, onRoadmapClick, onShortcutsClick }: FooterProps) {
  return (
    <footer className="py-6 px-4 text-center shrink-0">
      <nav
        className="flex items-center justify-center gap-2 text-sm"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        <button
          onClick={onChangelogClick}
          className="footer-link hover:underline transition-colors duration-200"
        >
          Changelog
        </button>
        <span aria-hidden="true">·</span>
        <button
          onClick={onRoadmapClick}
          className="footer-link hover:underline transition-colors duration-200"
        >
          Roadmap
        </button>
        {onShortcutsClick && (
          <>
            <span aria-hidden="true">·</span>
            <button
              onClick={onShortcutsClick}
              className="footer-link hover:underline transition-colors duration-200"
            >
              Shortcuts
            </button>
          </>
        )}
        <span aria-hidden="true">·</span>
        <a
          href="https://github.com/anbuneel/zenote"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link hover:underline transition-colors duration-200"
        >
          GitHub
        </a>
      </nav>
    </footer>
  );
}
