/**
 * Conflict Modal - "Two Paths"
 *
 * Zen-styled modal for resolving sync conflicts between local and server versions.
 * Displays both versions side-by-side with clear resolution options.
 */

import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import type { ConflictInfo } from '../services/syncEngine';
import type { LocalNote } from '../lib/offlineDb';
import { escapeHtml } from '../utils/sanitize';

interface ConflictModalProps {
  conflict: ConflictInfo | null;
  onResolve: (choice: 'local' | 'server' | 'both') => Promise<void>;
  onDismiss: () => void;
}

interface ServerNote {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Safely extract plain text from HTML content using DOMPurify.
 * Strips all HTML tags and returns only text content.
 */
function getPlainTextPreview(html: string, maxLength: number = 200): string {
  // Use DOMPurify with no allowed tags to get plain text
  const plainText = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
  if (plainText.length <= maxLength) return plainText;
  return plainText.slice(0, maxLength).trim() + '...';
}

export function ConflictModal({ conflict, onResolve, onDismiss }: ConflictModalProps) {
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedChoice, setResolvedChoice] = useState<'local' | 'server' | 'both' | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap and escape key handling
  useEffect(() => {
    if (!conflict) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isResolving) {
        onDismiss();
      }
    };

    // Focus the modal when it opens
    modalRef.current?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [conflict, isResolving, onDismiss]);

  // Reset state when conflict changes
  useEffect(() => {
    // Schedule state reset to avoid synchronous setState in effect
    const timeout = setTimeout(() => {
      setIsResolving(false);
      setResolvedChoice(null);
    }, 0);
    return () => clearTimeout(timeout);
  }, [conflict]);

  if (!conflict) return null;

  // Only handle note conflicts (tags use last-write-wins)
  if (conflict.entityType !== 'note') return null;

  const localNote = conflict.localVersion as LocalNote;
  const serverNote = conflict.serverVersion as ServerNote;

  const handleResolve = async (choice: 'local' | 'server' | 'both') => {
    setIsResolving(true);
    setResolvedChoice(choice);

    try {
      await onResolve(choice);
      // Small delay to show kintsugi animation before closing
      await new Promise((resolve) => setTimeout(resolve, 600));
      onDismiss();
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      setIsResolving(false);
      setResolvedChoice(null);
    }
  };

  const formatDate = (timestamp: number | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.6)' }}
      onClick={isResolving ? undefined : onDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`
          w-full max-w-3xl max-h-[90vh] overflow-y-auto
          p-6 md:p-8
          shadow-2xl
          ${resolvedChoice ? 'animate-[kintsugi-glow_600ms_ease-out]' : 'animate-[modal-enter_300ms_ease-out]'}
        `}
        style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-card)',
          border: resolvedChoice
            ? '2px solid var(--color-accent)'
            : '1px solid var(--glass-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Zen messaging */}
        <div className="text-center mb-8">
          <h2
            id="conflict-title"
            className="text-2xl md:text-3xl font-light mb-3"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
            }}
          >
            Two paths have formed
          </h2>
          <p
            className="text-sm md:text-base"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
            }}
          >
            This note was changed in two places. Which feels truer?
          </p>
        </div>

        {/* Side-by-side comparison */}
        <div className="grid md:grid-cols-2 gap-4 md:gap-6 mb-8">
          {/* Local version */}
          <div
            className="p-4 md:p-5 rounded-lg transition-all duration-200"
            style={{
              background: 'var(--color-bg-secondary)',
              border: resolvedChoice === 'local'
                ? '2px solid var(--color-accent)'
                : '1px solid var(--glass-border)',
              opacity: resolvedChoice && resolvedChoice !== 'local' && resolvedChoice !== 'both' ? 0.5 : 1,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Your device
              </span>
              <span
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {formatDate(localNote.localUpdatedAt || localNote.updatedAt)}
              </span>
            </div>
            <h3
              className="text-lg font-medium mb-2 line-clamp-2"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              {escapeHtml(localNote.title) || 'Untitled'}
            </h3>
            <p
              className="text-sm line-clamp-4"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {getPlainTextPreview(localNote.content)}
            </p>
            <button
              onClick={() => handleResolve('local')}
              disabled={isResolving}
              className="
                mt-4 w-full py-2.5 px-4
                rounded-lg text-sm font-medium
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              style={{
                fontFamily: 'var(--font-body)',
                background: resolvedChoice === 'local' ? 'var(--color-accent)' : 'transparent',
                color: resolvedChoice === 'local' ? 'var(--color-bg-primary)' : 'var(--color-accent)',
                border: '1px solid var(--color-accent)',
              }}
              onMouseEnter={(e) => {
                if (!isResolving && resolvedChoice !== 'local') {
                  e.currentTarget.style.background = 'var(--color-accent)';
                  e.currentTarget.style.color = 'var(--color-bg-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isResolving && resolvedChoice !== 'local') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-accent)';
                }
              }}
              aria-label="Keep local version"
            >
              {isResolving && resolvedChoice === 'local' ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'var(--color-bg-primary)', borderTopColor: 'transparent' }}
                  />
                  Keeping...
                </span>
              ) : (
                'Keep this'
              )}
            </button>
          </div>

          {/* Server version */}
          <div
            className="p-4 md:p-5 rounded-lg transition-all duration-200"
            style={{
              background: 'var(--color-bg-secondary)',
              border: resolvedChoice === 'server'
                ? '2px solid var(--color-accent)'
                : '1px solid var(--glass-border)',
              opacity: resolvedChoice && resolvedChoice !== 'server' && resolvedChoice !== 'both' ? 0.5 : 1,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Another device
              </span>
              <span
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {formatDate(serverNote.updated_at)}
              </span>
            </div>
            <h3
              className="text-lg font-medium mb-2 line-clamp-2"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              {escapeHtml(serverNote.title) || 'Untitled'}
            </h3>
            <p
              className="text-sm line-clamp-4"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {getPlainTextPreview(serverNote.content)}
            </p>
            <button
              onClick={() => handleResolve('server')}
              disabled={isResolving}
              className="
                mt-4 w-full py-2.5 px-4
                rounded-lg text-sm font-medium
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              style={{
                fontFamily: 'var(--font-body)',
                background: resolvedChoice === 'server' ? 'var(--color-accent)' : 'transparent',
                color: resolvedChoice === 'server' ? 'var(--color-bg-primary)' : 'var(--color-accent)',
                border: '1px solid var(--color-accent)',
              }}
              onMouseEnter={(e) => {
                if (!isResolving && resolvedChoice !== 'server') {
                  e.currentTarget.style.background = 'var(--color-accent)';
                  e.currentTarget.style.color = 'var(--color-bg-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isResolving && resolvedChoice !== 'server') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-accent)';
                }
              }}
              aria-label="Keep server version"
            >
              {isResolving && resolvedChoice === 'server' ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'var(--color-bg-primary)', borderTopColor: 'transparent' }}
                  />
                  Keeping...
                </span>
              ) : (
                'Keep this'
              )}
            </button>
          </div>
        </div>

        {/* Keep both option */}
        <div className="text-center">
          <button
            onClick={() => handleResolve('both')}
            disabled={isResolving}
            className="
              py-3 px-6
              rounded-lg text-sm font-medium
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            style={{
              fontFamily: 'var(--font-body)',
              color: resolvedChoice === 'both' ? 'var(--color-bg-primary)' : 'var(--color-text-secondary)',
              background: resolvedChoice === 'both' ? 'var(--color-accent)' : 'transparent',
              border: '1px solid var(--glass-border)',
            }}
            onMouseEnter={(e) => {
              if (!isResolving && resolvedChoice !== 'both') {
                e.currentTarget.style.borderColor = 'var(--color-text-secondary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isResolving && resolvedChoice !== 'both') {
                e.currentTarget.style.borderColor = 'var(--glass-border)';
              }
            }}
            aria-label="Keep both versions as separate notes"
          >
            {isResolving && resolvedChoice === 'both' ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-bg-primary)', borderTopColor: 'transparent' }}
                />
                Creating copy...
              </span>
            ) : (
              'Keep both as separate notes'
            )}
          </button>
          <p
            className="mt-2 text-xs"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            One will be saved as a copy
          </p>
        </div>
      </div>
    </div>
  );
}
