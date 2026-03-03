import { useState, useEffect, useRef } from 'react';
import type { Theme } from '../types';
import type { SharePayload } from '../lib/encryption';
import { decryptSharePayload } from '../lib/encryption';
import { fetchSharedNote } from '../services/notes';
import { sanitizeHtml } from '../utils/sanitize';
import { Footer } from './Footer';

const VALID_TAG_COLORS = new Set(['terracotta', 'gold', 'forest', 'stone', 'indigo', 'clay', 'sage', 'plum']);

interface SharedNoteViewProps {
  token: string;
  shareKey: Uint8Array;
  theme: Theme;
  onThemeToggle: () => void;
  onInvalidToken: () => void;
  onChangelogClick: () => void;
  onRoadmapClick: () => void;
}

type LoadingState = 'loading' | 'decrypting' | 'success' | 'error' | 'expired' | 'incomplete';

export function SharedNoteView({
  token,
  shareKey,
  theme,
  onThemeToggle,
  onInvalidToken,
  onChangelogClick,
  onRoadmapClick,
}: SharedNoteViewProps) {
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const keyValid = shareKey.length === 32;
  const [loadingState, setLoadingState] = useState<LoadingState>(keyValid ? 'loading' : 'incomplete');
  const contentRef = useRef<HTMLDivElement>(null);

  // Override Referrer-Policy to no-referrer for shared note pages
  useEffect(() => {
    const existing = document.querySelector('meta[name="referrer"]');
    const prev = existing?.getAttribute('content');
    if (existing) {
      existing.setAttribute('content', 'no-referrer');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'referrer';
      meta.content = 'no-referrer';
      document.head.appendChild(meta);
    }
    return () => {
      if (existing && prev) existing.setAttribute('content', prev);
    };
  }, []);

  // Disable task list checkboxes in read-only shared view (CSS alone can't block keyboard)
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
        cb.disabled = true;
        cb.tabIndex = -1;
      });
    }
  }, [payload]);

  useEffect(() => {
    if (!keyValid) return;
    let isMounted = true;

    // Fetch encrypted payload from server via RPC
    fetchSharedNote(token)
      .then(async (encryptedData) => {
        if (!isMounted) return;
        if (!encryptedData) {
          setLoadingState('expired');
          return;
        }

        // Decrypt client-side
        setLoadingState('decrypting');
        try {
          const decrypted = await decryptSharePayload(token, shareKey, encryptedData);
          if (!isMounted) return;
          setPayload(decrypted);
          setLoadingState('success');
        } catch (error) {
          // Wrong key, tampered data, or AAD mismatch
          console.error('SharedNoteView: decryption failed', error);
          if (isMounted) setLoadingState('incomplete');
        }
      })
      .catch((error) => {
        console.error('SharedNoteView: failed to load shared note', error);
        if (isMounted) {
          setLoadingState('error');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, shareKey, keyValid]);

  // Render header (simplified, no auth)
  const renderHeader = () => (
    <header
      className="px-4 md:px-12 shrink-0"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <div className="h-16 flex items-center justify-between">
        {/* Logo */}
        <span
          className="text-[1.4rem] md:text-[1.75rem] font-semibold tracking-tight"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.5px',
          }}
        >
          Yidhan
        </span>

        {/* Theme Toggle */}
        <button
          onClick={onThemeToggle}
          className="
            w-9 h-9
            rounded-full
            flex items-center justify-center
            transition-all duration-300
            focus:outline-none
            focus:ring-2
            focus:ring-[var(--color-accent)]
            hover:text-[var(--color-accent)]
            hover:bg-[var(--color-bg-secondary)]
          "
          style={{ color: 'var(--color-text-secondary)' }}
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
      </div>
    </header>
  );

  // Loading / decrypting state
  if (loadingState === 'loading' || loadingState === 'decrypting') {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: 'var(--color-bg-primary)' }}
      >
        {renderHeader()}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div
              className="w-8 h-8 mx-auto mb-4 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
            />
            <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
              {loadingState === 'decrypting' ? 'Unsealing letter...' : 'Loading shared note...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Incomplete link (missing or invalid key)
  if (loadingState === 'incomplete') {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: 'var(--color-bg-primary)' }}
      >
        {renderHeader()}
        <div className="flex-1 flex items-center justify-center px-4">
          <div
            className="text-center max-w-md p-8"
            style={{
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <div
              className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-bg-tertiary)' }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: 'var(--color-text-tertiary)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            <h2
              className="text-xl font-semibold mb-3"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              This link appears incomplete
            </h2>
            <p
              className="mb-6"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
              }}
            >
              The full link is needed to read this note. Please ask the sender for the complete link.
            </p>
            <button
              onClick={onInvalidToken}
              className="
                px-5 py-2.5
                rounded-lg
                text-sm font-medium
                transition-all duration-200
              "
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-cta-text)',
                background: 'var(--color-cta-bg)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-cta-bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-cta-bg)';
              }}
            >
              Go to Yidhan
            </button>
          </div>
        </div>
        <Footer onChangelogClick={onChangelogClick} onRoadmapClick={onRoadmapClick} />
      </div>
    );
  }

  // Error or expired state
  if (loadingState === 'error' || loadingState === 'expired') {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: 'var(--color-bg-primary)' }}
      >
        {renderHeader()}
        <div className="flex-1 flex items-center justify-center px-4">
          <div
            className="text-center max-w-md p-8"
            style={{
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--glass-border)',
            }}
          >
            {/* Decorative icon */}
            <div
              className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-bg-tertiary)' }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: 'var(--color-text-tertiary)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2
              className="text-xl font-semibold mb-3"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              {loadingState === 'expired' ? 'This letter has faded' : 'Something went wrong'}
            </h2>
            <p
              className="mb-6"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
              }}
            >
              {loadingState === 'expired'
                ? 'The shared note has expired or been removed by its author.'
                : 'We couldn\'t load this shared note. Please check the link and try again.'}
            </p>
            <button
              onClick={onInvalidToken}
              className="
                px-5 py-2.5
                rounded-lg
                text-sm font-medium
                transition-all duration-200
              "
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-cta-text)',
                background: 'var(--color-cta-bg)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-cta-bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-cta-bg)';
              }}
            >
              Go to Yidhan
            </button>
          </div>
        </div>
        <Footer onChangelogClick={onChangelogClick} onRoadmapClick={onRoadmapClick} />
      </div>
    );
  }

  // Success state - display the decrypted note
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      {renderHeader()}

      {/* Note content */}
      <main className="flex-1">
        <div className="max-w-[800px] mx-auto px-4 sm:px-10 py-8">
          {/* Title */}
          <h1
            className="text-4xl font-semibold mb-4"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {payload?.title || 'Untitled'}
          </h1>

          {/* Tags */}
          {payload?.tags && payload.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {payload.tags.map((tag, idx) => {
                const safeColor = VALID_TAG_COLORS.has(tag.color) ? tag.color : 'stone';
                return (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 text-xs rounded-full"
                    style={{
                      fontFamily: 'var(--font-body)',
                      background: `color-mix(in srgb, var(--tag-${safeColor}, var(--color-accent)) 15%, transparent)`,
                      color: `var(--tag-${safeColor}, var(--color-accent))`,
                      border: `1px solid color-mix(in srgb, var(--tag-${safeColor}, var(--color-accent)) 30%, transparent)`,
                    }}
                  >
                    {tag.name}
                  </span>
                );
              })}
            </div>
          )}

          {/* Divider */}
          <div
            className="w-24 h-px mb-8"
            style={{ background: 'var(--glass-border)' }}
          />

          {/* Content */}
          <div className="rich-text-editor">
            <div
              ref={contentRef}
              className="ProseMirror shared-note-content"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-primary)',
                lineHeight: 1.8,
              }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(payload?.content || '') }}
            />
          </div>

          {/* Footer attribution */}
          <footer
            className="mt-16 mb-8 flex flex-col items-center gap-4"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {/* Decorative divider */}
            <div
              className="w-16 h-px"
              style={{ background: 'currentColor', opacity: 0.3 }}
            />

            {/* Attribution */}
            <p
              className="text-sm italic"
              style={{
                fontFamily: 'var(--font-display)',
              }}
            >
              Shared quietly via Yidhan
            </p>

            {/* Create your own CTA */}
            <a
              href="/"
              className="
                mt-4 px-5 py-2.5
                rounded-lg
                text-sm font-medium
                transition-all duration-200
              "
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
                background: 'transparent',
                border: '1px solid var(--glass-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-accent)';
                e.currentTarget.style.color = 'var(--color-accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--glass-border)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              Start your own quiet space
            </a>
          </footer>
        </div>
      </main>

      <Footer onChangelogClick={onChangelogClick} onRoadmapClick={onRoadmapClick} />
    </div>
  );
}
