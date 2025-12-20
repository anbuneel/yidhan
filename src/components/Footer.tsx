interface FooterProps {
  onChangelogClick: () => void;
  onRoadmapClick: () => void;
}

export function Footer({ onChangelogClick, onRoadmapClick }: FooterProps) {
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
          className="hover:underline hover:[color:var(--color-accent)] transition-colors duration-200"
          style={{ color: 'inherit' }}
        >
          Changelog
        </button>
        <span aria-hidden="true">·</span>
        <button
          onClick={onRoadmapClick}
          className="hover:underline hover:[color:var(--color-accent)] transition-colors duration-200"
          style={{ color: 'inherit' }}
        >
          Roadmap
        </button>
        <span aria-hidden="true">·</span>
        <a
          href="https://github.com/anbuneel/zenote"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline hover:[color:var(--color-accent)] transition-colors duration-200"
          style={{ color: 'inherit' }}
        >
          GitHub
        </a>
      </nav>
    </footer>
  );
}
