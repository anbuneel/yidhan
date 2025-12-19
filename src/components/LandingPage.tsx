import { useState, useRef, useEffect } from 'react';
import type { Theme } from '../types';
import { SimpleHeader } from './SimpleHeader';
import { Footer } from './Footer';

interface LandingPageProps {
  onStartWriting: () => void;
  onSignIn: () => void;
  theme: Theme;
  onThemeToggle: () => void;
  onChangelogClick: () => void;
  onRoadmapClick: () => void;
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

export function LandingPage({ onStartWriting, onSignIn, theme, onThemeToggle, onChangelogClick, onRoadmapClick }: LandingPageProps) {
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
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <SimpleHeader
        theme={theme}
        onThemeToggle={onThemeToggle}
        onSignIn={onSignIn}
      />

      {/* Main Content - Split Screen */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Panel - Hero */}
        <section className="w-full md:w-[45%] flex flex-col">
          {/* Hero Content - Centered */}
          <div className="flex-1 flex items-center px-6 md:px-8 lg:px-12 py-8 md:py-0">
            <div className="max-w-lg">
              <h2
                className="text-3xl md:text-4xl lg:text-[3.25rem] font-light leading-[1.1] mb-4 md:mb-6"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                A quiet space<br />for your mind.
              </h2>
              <p
                className="text-base lg:text-lg mb-8 md:mb-10 max-w-sm"
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
                  For free
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Panel - Demo & Preview */}
        <section
          className="w-full md:w-[55%] flex flex-col relative flex-1"
          style={{
            background: 'var(--color-bg-secondary)',
          }}
        >
          {/* Subtle divider line - desktop only */}
          <div
            className="hidden md:block absolute left-0 top-0 bottom-0 w-px"
            style={{
              background: 'linear-gradient(to bottom, transparent, var(--glass-border) 20%, var(--glass-border) 80%, transparent)',
            }}
          />

          {/* Cards Container - Vertically Centered */}
          <div className="flex-1 flex items-center justify-center px-6 md:px-10 py-6 md:py-8">
            <div className="w-full max-w-3xl flex flex-col gap-6">
              {/* Sample Cards Row - Hidden on mobile */}
              <div
                className="hidden md:grid grid-cols-2 items-start"
                style={{ gap: '28px' }}
              >
                {SAMPLE_NOTES.map((note, index) => (
                  <article
                    key={index}
                    className="p-6 pb-5 relative overflow-hidden flex flex-col"
                    style={{
                      background: 'var(--color-card-bg)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid var(--glass-border)',
                      borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : undefined,
                      borderRadius: 'var(--radius-card)',
                      boxShadow: 'var(--shadow-md)',
                      opacity: 0.7,
                      minHeight: '200px',
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
                      className="text-xl font-semibold line-clamp-2 mb-3 leading-tight"
                      style={{
                        fontFamily: 'var(--font-display)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {note.title}
                    </h3>

                    {/* Preview */}
                    <p
                      className="text-sm leading-relaxed"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text-secondary)',
                        fontWeight: 300,
                      }}
                    >
                      {note.preview}
                    </p>

                    {/* Footer: Tag + Timestamp */}
                    <div className="flex items-center justify-between mt-auto pt-4">
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
                className="p-6 md:p-10 relative flex flex-col"
                style={{
                  background: 'var(--color-card-bg)',
                  border: '1px solid var(--glass-border)',
                  borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : undefined,
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--shadow-md)',
                  minHeight: '220px',
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
                    font-family: var(--font-display);
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

          {/* Footer */}
          <Footer
            onChangelogClick={onChangelogClick}
            onRoadmapClick={onRoadmapClick}
          />
        </section>
      </div>
    </div>
  );
}
