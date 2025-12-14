import { useState, useRef, useEffect } from 'react';
import type { Theme } from '../types';

interface LandingPageProps {
  onStartWriting: () => void;
  onSignIn: () => void;
  theme: Theme;
  onThemeToggle: () => void;
}

const DEMO_STORAGE_KEY = 'zenote-demo-content';
const DEFAULT_PLACEHOLDER = 'Start typing...';

// Sample notes for the app preview
const SAMPLE_NOTES = [
  {
    title: 'Morning reflections',
    preview: 'The quiet hours before dawn have become my favorite time to think clearly...',
    tag: { name: 'Journal', color: 'terracotta' },
    time: '2 days ago',
  },
  {
    title: 'Book notes: Atomic Habits',
    preview: 'Key insight: habits are the compound interest of self-improvement.',
    tag: { name: 'Reading', color: 'forest' },
    time: '1 week ago',
  },
];

const TAG_COLORS: Record<string, string> = {
  terracotta: '#C25634',
  forest: '#3D5A3D',
  gold: '#D4AF37',
};

function getInitialContent(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(DEMO_STORAGE_KEY) || '';
  }
  return '';
}

export function LandingPage({ onStartWriting, onSignIn, theme, onThemeToggle }: LandingPageProps) {
  const [demoContent, setDemoContent] = useState(getInitialContent);
  const [hasTyped, setHasTyped] = useState(() => getInitialContent().length > 0);
  const [isFocused, setIsFocused] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && demoContent && !editorRef.current.innerText) {
      editorRef.current.innerText = demoContent;
    }
  }, [demoContent]);

  const handleInput = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerText;
      setDemoContent(content);
      localStorage.setItem(DEMO_STORAGE_KEY, content);
      if (content.trim() && !hasTyped) {
        setHasTyped(true);
      }
    }
  };

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  return (
    <div
      className="h-screen flex overflow-hidden"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      {/* Left Panel - Hero */}
      <section className="w-[45%] flex flex-col">
        {/* Left Header */}
        <header className="px-8 py-5 shrink-0">
          <h1
            className="text-[1.75rem] font-semibold tracking-tight"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.5px',
            }}
          >
            Zenote
          </h1>
        </header>

        {/* Hero Content - Centered */}
        <div className="flex-1 flex items-center px-8 lg:px-12">
          <div className="max-w-lg">
            <h2
              className="text-4xl lg:text-[3.25rem] font-light leading-[1.1] mb-6"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              A quiet space<br />for your mind.
            </h2>
            <p
              className="text-base lg:text-lg mb-10 max-w-sm"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
                fontWeight: 300,
                lineHeight: 1.7,
              }}
            >
              The distraction-free note-taking app. No folders, no clutter.
              Just your thoughts, beautifully organized.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={onStartWriting}
                className="px-8 py-3.5 rounded-lg text-base font-medium transition-all duration-300"
                style={{
                  fontFamily: 'var(--font-body)',
                  background: 'var(--color-accent)',
                  color: '#fff',
                  boxShadow: '0 4px 20px var(--color-accent-glow)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent-hover)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px var(--color-accent-glow)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px var(--color-accent-glow)';
                }}
              >
                Start Writing
              </button>
              <span
                className="text-sm"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                Free forever
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Right Panel - Demo & Preview */}
      <section
        className="w-[55%] flex flex-col relative"
        style={{
          background: 'var(--color-bg-secondary)',
        }}
      >
        {/* Subtle divider line */}
        <div
          className="absolute left-0 top-0 bottom-0 w-px"
          style={{
            background: 'linear-gradient(to bottom, transparent, var(--glass-border) 20%, var(--glass-border) 80%, transparent)',
          }}
        />

        {/* Right Header */}
        <header className="px-10 py-5 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onThemeToggle}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
          <button
            onClick={onSignIn}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            Sign In
          </button>
        </header>

        {/* Cards Container - Vertically Centered */}
        <div className="flex-1 flex items-center justify-center px-10 py-8">
          <div className="w-full max-w-3xl flex flex-col gap-6">
            {/* Sample Cards Row - Matching real NoteCard styling */}
            <div
              className="grid grid-cols-2"
              style={{ gap: '28px' }}
            >
              {SAMPLE_NOTES.map((note, index) => (
                <article
                  key={index}
                  className="p-10 relative overflow-hidden flex flex-col"
                  style={{
                    background: 'var(--color-card-bg)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-card)',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  {/* Accent line */}
                  <div
                    className="absolute top-0 left-0 w-full h-[2px]"
                    style={{
                      background: 'var(--color-accent)',
                      opacity: 0.5,
                    }}
                  />

                  {/* Title */}
                  <h3
                    className="text-[1.8rem] font-semibold line-clamp-2 mb-4 leading-tight"
                    style={{
                      fontFamily: 'var(--font-display)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {note.title}
                  </h3>

                  {/* Preview */}
                  <div
                    className="note-card-preview flex-1 overflow-hidden"
                    style={{ maxHeight: '6rem' }}
                  >
                    <p>{note.preview}</p>
                  </div>

                  {/* Footer: Tag + Timestamp */}
                  <div className="flex items-center justify-between mt-auto pt-6">
                    <span
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        fontFamily: 'var(--font-body)',
                        background: `${TAG_COLORS[note.tag.color]}15`,
                        color: TAG_COLORS[note.tag.color],
                        fontWeight: 500,
                      }}
                    >
                      {note.tag.name}
                    </span>
                    <span
                      className="text-[0.65rem] uppercase tracking-[0.1em] font-medium"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text-tertiary)',
                      }}
                    >
                      {note.time}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            {/* Demo Editor Card - Main Focus */}
            <div
              className="p-10 relative flex flex-col"
              style={{
                background: 'var(--color-card-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--shadow-md)',
                minHeight: '280px',
              }}
            >
              {/* Accent line */}
              <div
                className="absolute top-0 left-0 w-full h-[2px] origin-left transition-all duration-500"
                style={{
                  background: 'var(--color-accent)',
                  opacity: isFocused ? 1 : 0.3,
                  transform: isFocused ? 'scaleX(1)' : 'scaleX(0.3)',
                }}
              />

              {/* Header row */}
              <div className="flex items-center justify-between mb-5 shrink-0">
                <h4
                  className="text-xl font-semibold transition-colors duration-300"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: isFocused ? 'var(--color-accent)' : 'var(--color-text-primary)',
                  }}
                >
                  {hasTyped ? 'Your first note' : 'Try it here'}
                </h4>
                <span
                  className="text-[10px] px-2.5 py-1 rounded-full uppercase tracking-widest"
                  style={{
                    fontFamily: 'var(--font-body)',
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-tertiary)',
                    fontWeight: 500,
                  }}
                >
                  Demo
                </span>
              </div>

              {/* Editable Content */}
              <div
                ref={editorRef}
                className="flex-1 outline-none overflow-auto"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '1.1rem',
                  lineHeight: 1.8,
                  color: 'var(--color-text-primary)',
                  fontWeight: 300,
                }}
                contentEditable
                onInput={handleInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                suppressContentEditableWarning
                data-placeholder={DEFAULT_PLACEHOLDER}
              />

              <style>{`
                [data-placeholder]:empty::before {
                  content: attr(data-placeholder);
                  color: var(--color-text-tertiary);
                  font-style: italic;
                  pointer-events: none;
                }
              `}</style>

              {/* Sign up prompt - subtle text only */}
              {hasTyped && (
                <div
                  className="mt-5 pt-5 shrink-0"
                  style={{ borderTop: '1px solid var(--glass-border)' }}
                >
                  <span
                    className="text-sm italic"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    Sign up to save your notes forever
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
