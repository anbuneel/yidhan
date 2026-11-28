import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import type { Note, NoteDeleteHandler } from '../types';
import { formatRelativeTime } from '../utils/formatTime';
import { TagBadgeList } from './TagBadge';
import { sanitizeHtml, sanitizeText, htmlToPlainText } from '../utils/sanitize';
import { parseSearchQuery } from '../utils/searchQuery';
import { buildSearchSnippet, highlightSearchText } from '../utils/searchText';

interface NoteCardProps {
  note: Note;
  onClick: (id: string) => void;
  onDelete: NoteDeleteHandler;
  onTogglePin: (id: string, pinned: boolean) => void;
  isCompact?: boolean;
  /** Keep the pin button on a compact card: the pinned row's only mouse unpin. */
  keepPin?: boolean;
  isDecorative?: boolean;
  searchQuery?: string;
  searchMatchTerms?: readonly string[];
  isFocused?: boolean;
}

const PREVIEW_MAX_BLOCKS = 8;
const PREVIEW_MAX_TOTAL_BLOCKS = 20;
const PREVIEW_MAX_TEXT_CHARS = 800;
const PREVIEW_HARD_TEXT_CHARS = 1200;

const VOID_HTML_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const LEAF_BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre']);
const CONTAINER_BLOCK_TAGS = new Set(['li', 'blockquote', 'div']);

function findTagEnd(html: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
  }
  return -1;
}

function closeOpenTags(openStack: string[]): string {
  let suffix = '';
  for (let i = openStack.length - 1; i >= 0; i--) {
    suffix += `</${openStack[i]}>`;
  }
  return suffix;
}

/**
 * Slice long note HTML to its first few blocks before DOMPurify runs so card
 * previews do not parse and mount an entire multi-thousand-word document only
 * to clip it at 8em. The returned fragment must still pass through sanitizeHtml.
 */
function truncateHtmlForPreview(html: string): string {
  if (!html) return html;

  const openStack: string[] = [];
  const countedInsideContainer: boolean[] = [];
  let nonEmptyBlocks = 0;
  let totalBlocks = 0;
  let textChars = 0;
  let blockHasText = false;
  let rawTextTag: 'script' | 'style' | null = null;
  let i = 0;

  while (i < html.length) {
    if (html[i] === '<') {
      if (html.startsWith('<!--', i)) {
        const endComment = html.indexOf('-->', i + 4);
        i = endComment === -1 ? html.length : endComment + 3;
        continue;
      }

      const end = findTagEnd(html, i + 1);
      if (end === -1) break;

      const rawTag = html.slice(i + 1, end).trim();
      const nextPos = end + 1;

      if (!rawTag || rawTag[0] === '!' || rawTag[0] === '?') {
        i = nextPos;
        continue;
      }

      const isClosing = rawTag[0] === '/';
      const nameMatch = (isClosing ? rawTag.slice(1) : rawTag).match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
      if (!nameMatch) {
        i = nextPos;
        continue;
      }

      const tagName = nameMatch[1].toLowerCase();

      if (rawTextTag) {
        if (isClosing && tagName === rawTextTag) {
          rawTextTag = null;
        }
        i = nextPos;
        continue;
      }

      if (!isClosing) {
        const isSelfClosing = rawTag.endsWith('/') || VOID_HTML_TAGS.has(tagName);
        if (tagName === 'script' || tagName === 'style') {
          if (!isSelfClosing) rawTextTag = tagName;
          i = nextPos;
          continue;
        }
        if (tagName === 'hr') {
          totalBlocks += 1;
          nonEmptyBlocks += 1;
          blockHasText = false;
          if (countedInsideContainer.length > 0) {
            countedInsideContainer[countedInsideContainer.length - 1] = true;
          }
          if (
            openStack.length === 0 &&
            nextPos < html.length &&
            (nonEmptyBlocks >= PREVIEW_MAX_BLOCKS ||
              totalBlocks >= PREVIEW_MAX_TOTAL_BLOCKS ||
              textChars >= PREVIEW_MAX_TEXT_CHARS)
          ) {
            return html.slice(0, nextPos);
          }
        } else if (!isSelfClosing) {
          openStack.push(tagName);
          if (CONTAINER_BLOCK_TAGS.has(tagName)) {
            countedInsideContainer.push(false);
          }
        }
        i = nextPos;
        continue;
      }

      // Closing tag: unwind stack to matching open tag if present.
      const matchIndex = openStack.lastIndexOf(tagName);
      let hadChildBlock = false;
      if (matchIndex !== -1) {
        for (let k = openStack.length - 1; k >= matchIndex; k--) {
          if (CONTAINER_BLOCK_TAGS.has(openStack[k])) {
            const popped = countedInsideContainer.pop() ?? false;
            if (k === matchIndex) hadChildBlock = popped;
          }
        }
        openStack.length = matchIndex;
      }

      let countedThisTag = false;
      if (LEAF_BLOCK_TAGS.has(tagName)) {
        totalBlocks += 1;
        if (blockHasText) nonEmptyBlocks += 1;
        blockHasText = false;
        countedThisTag = true;
      } else if (CONTAINER_BLOCK_TAGS.has(tagName) && !hadChildBlock) {
        if (tagName === 'li' || openStack.length === 0) {
          totalBlocks += 1;
          if (blockHasText) nonEmptyBlocks += 1;
          blockHasText = false;
          countedThisTag = true;
        }
      }

      if (countedThisTag && countedInsideContainer.length > 0) {
        countedInsideContainer[countedInsideContainer.length - 1] = true;
      }

      const insideListItem = openStack.includes('li');
      const isSafeBoundary =
        openStack.length === 0 ||
        tagName === 'li' ||
        (LEAF_BLOCK_TAGS.has(tagName) && !insideListItem);

      if (
        isSafeBoundary &&
        nextPos < html.length &&
        (nonEmptyBlocks >= PREVIEW_MAX_BLOCKS ||
          totalBlocks >= PREVIEW_MAX_TOTAL_BLOCKS ||
          textChars >= PREVIEW_MAX_TEXT_CHARS)
      ) {
        return html.slice(0, nextPos) + closeOpenTags(openStack);
      }

      i = nextPos;
      continue;
    }

    // Text run up to the next tag.
    const nextTag = html.indexOf('<', i);
    const textEnd = nextTag === -1 ? html.length : nextTag;

    if (rawTextTag) {
      i = textEnd;
      continue;
    }

    let pos = i;
    while (pos < textEnd) {
      const ch = html[pos];
      if (ch === '&') {
        const semi = html.indexOf(';', pos + 1);
        if (semi !== -1 && semi < textEnd && semi - pos <= 10) {
          pos = semi + 1;
          textChars += 1;
          blockHasText = true;
        } else {
          pos += 1;
          textChars += 1;
          blockHasText = true;
        }
      } else {
        if (ch > ' ') blockHasText = true;
        textChars += 1;
        pos += 1;
      }

      if (textChars >= PREVIEW_HARD_TEXT_CHARS && pos < html.length) {
        // Advance slightly to finish the current word without crossing a tag or entity.
        let cut = pos;
        const limit = Math.min(textEnd, pos + 40);
        while (cut < limit && html[cut] > ' ' && html[cut] !== '&') {
          cut += 1;
        }
        return html.slice(0, cut) + closeOpenTags(openStack);
      }
    }

    i = textEnd;
  }

  return html;
}

type OverflowListener = (isOverflowing: boolean) => void;

const overflowListeners = new Map<HTMLElement, OverflowListener>();
const pendingOverflowChecks = new Set<HTMLElement>();
let sharedOverflowObserver: ResizeObserver | null = null;
let overflowFrameId: number | null = null;

function flushOverflowChecks(): void {
  overflowFrameId = null;
  if (pendingOverflowChecks.size === 0) return;

  // Read every queued preview before issuing any state updates so layout is
  // measured once per animation frame instead of interleaved per card.
  const measurements: Array<[OverflowListener, boolean]> = [];
  pendingOverflowChecks.forEach((element) => {
    const listener = overflowListeners.get(element);
    if (!listener || !element.isConnected) return;
    measurements.push([listener, element.scrollHeight > element.clientHeight]);
  });
  pendingOverflowChecks.clear();

  for (const [listener, isOverflowing] of measurements) {
    listener(isOverflowing);
  }
}

function scheduleOverflowCheck(element: HTMLElement): void {
  pendingOverflowChecks.add(element);
  if (overflowFrameId !== null) return;
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    overflowFrameId = window.requestAnimationFrame(flushOverflowChecks);
  } else {
    flushOverflowChecks();
  }
}

function ensureSharedOverflowObserver(): ResizeObserver | null {
  if (sharedOverflowObserver) return sharedOverflowObserver;
  if (typeof ResizeObserver === 'undefined') return null;

  sharedOverflowObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target instanceof HTMLElement && overflowListeners.has(entry.target)) {
        scheduleOverflowCheck(entry.target);
      }
    }
  });
  return sharedOverflowObserver;
}

function observePreviewOverflow(element: HTMLElement, listener: OverflowListener): () => void {
  overflowListeners.set(element, listener);
  const observer = ensureSharedOverflowObserver();
  observer?.observe(element);
  scheduleOverflowCheck(element);

  return () => {
    overflowListeners.delete(element);
    pendingOverflowChecks.delete(element);
    sharedOverflowObserver?.unobserve(element);
    if (overflowListeners.size === 0) {
      sharedOverflowObserver?.disconnect();
      sharedOverflowObserver = null;
      if (
        overflowFrameId !== null &&
        typeof window !== 'undefined' &&
        typeof window.cancelAnimationFrame === 'function'
      ) {
        window.cancelAnimationFrame(overflowFrameId);
        overflowFrameId = null;
      }
    }
  };
}

/**
 * The mark of a pinned note: a marigold disc holding a bookmark in the logo's deep
 * green. The disc is the logo's sun. Marigold's one job in the product
 * (DESIGN.md). The bookmark carries the meaning; marigold alone is 1.94:1 on white.
 */
function PinnedMark({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="var(--color-brand-marigold)" />
      <path fill="var(--color-brand-leaf-deep)" d="M8 7.5a1.5 1.5 0 011.5-1.5h5A1.5 1.5 0 0116 7.5V18l-4-2.25L8 18V7.5z" />
    </svg>
  );
}

export const NoteCard = memo(function NoteCard({
  note,
  onClick,
  onDelete,
  onTogglePin,
  isCompact = false,
  keepPin = false,
  isDecorative = false,
  searchQuery,
  searchMatchTerms,
  isFocused = false,
}: NoteCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPreviewOverflowing, setIsPreviewOverflowing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const deleteRequestedRef = useRef(false);
  const mountedRef = useRef(true);
  const noteIdRef = useRef(note.id);
  const onDeleteRef = useRef(onDelete);
  noteIdRef.current = note.id;
  onDeleteRef.current = onDelete;

  const parsedSearchTerms = useMemo(
    () => searchQuery
      ? parseSearchQuery(searchQuery).textTerms.map(({ normalized }) => normalized)
      : [],
    [searchQuery]
  );
  const searchTerms = searchMatchTerms ?? parsedSearchTerms;
  const hasSearchTerms = searchTerms.length > 0;

  // Run DOMPurify only for what this render mode needs: compact cards and
  // search results need plain text; full cards without a search snippet need HTML.
  // Outside search, slice long notes on block boundaries before sanitising.
  const needsPlainText = isCompact || hasSearchTerms;
  const plainText = useMemo(
    () => (
      needsPlainText
        ? htmlToPlainText(hasSearchTerms ? note.content : truncateHtmlForPreview(note.content))
        : ''
    ),
    [needsPlainText, hasSearchTerms, note.content]
  );
  const compactPreview = isCompact
    ? plainText.slice(0, 80) + (plainText.length > 80 ? '...' : '')
    : '';
  // Search snippets cover every content match. Operators are metadata filters,
  // so only the parsed free-text remainder is highlighted.
  const searchSnippet = useMemo(() => {
    if (!hasSearchTerms) return null;
    return buildSearchSnippet(plainText, searchTerms);
  }, [hasSearchTerms, plainText, searchTerms]);
  const needsHtmlPreview = !isCompact && !searchSnippet;
  // Sanitized HTML preview preserves task list checkboxes, formatting structure
  const htmlPreview = useMemo(
    () => (needsHtmlPreview ? sanitizeHtml(truncateHtmlForPreview(note.content)) : ''),
    [needsHtmlPreview, note.content]
  );
  const highlightedTitle = useMemo(() => {
    if (!hasSearchTerms) return sanitizeText(note.title);
    return highlightSearchText(htmlToPlainText(note.title), searchTerms);
  }, [hasSearchTerms, note.title, searchTerms]);

  useEffect(() => {
    if (!needsHtmlPreview) {
      setIsPreviewOverflowing(false);
      return;
    }

    const preview = previewRef.current;
    if (!preview) return;

    return observePreviewOverflow(preview, (isOverflowing) => {
      setIsPreviewOverflowing((current) =>
        current === isOverflowing ? current : isOverflowing
      );
    });
  }, [needsHtmlPreview]);

  useEffect(() => {
    if (!needsHtmlPreview) return;
    const preview = previewRef.current;
    if (!preview) return;
    scheduleOverflowCheck(preview);
  }, [htmlPreview, needsHtmlPreview]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteRequestedRef.current = false;
    setDeleteError(null);
    setIsDeleting(true);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isFocused) {
      cardRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      cardRef.current?.focus({ preventScroll: true });
    }
  }, [isFocused]);

  const requestDelete = useCallback(() => {
    if (deleteRequestedRef.current) return;
    deleteRequestedRef.current = true;

    void Promise.resolve()
      .then(() => onDeleteRef.current(noteIdRef.current))
      .then((deleted) => {
        if (deleted === false && mountedRef.current) {
          setIsDeleting(false);
          setDeleteError('This note could not be faded. Try again.');
        }
      })
      .catch(() => {
        if (mountedRef.current) {
          setIsDeleting(false);
          setDeleteError('This note could not be faded. Try again.');
        }
      });
  }, []);

  useEffect(() => {
    if (!isDeleting) return;
    const el = cardRef.current;
    if (!el) {
      requestDelete();
      return;
    }
    const handleAnimationEnd = () => requestDelete();
    el.addEventListener('animationend', handleAnimationEnd, { once: true });
    return () => {
      el.removeEventListener('animationend', handleAnimationEnd);
      // Search/filter changes can unmount the card before animationend. The
      // ref guard makes cleanup and animation completion one logical action.
      requestDelete();
    };
  }, [isDeleting, requestDelete]);

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin(note.id, !note.pinned);
  };

  return (
    <div
      ref={cardRef}
      role={isDecorative ? undefined : 'group'}
      data-library-card-id={isDecorative ? undefined : note.id}
      tabIndex={isDecorative ? undefined : isFocused ? 0 : -1}
      aria-label={isDecorative ? undefined : `Note: ${note.title || 'Untitled'}`}
      className={`
        group
        note-card
        relative
        overflow-hidden
        flex flex-col
        transition-[box-shadow,transform] duration-300
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--color-accent)]
        focus:ring-offset-2
        ${isDecorative ? 'note-card-decorative' : 'cursor-pointer active:scale-[0.98]'}
        ${isDeleting ? 'deleting' : ''}
        ${isCompact ? 'note-card-compact p-3' : 'p-6 pb-5'}
      `}
      style={{
        background: 'linear-gradient(to bottom, var(--color-card-bg), color-mix(in srgb, var(--color-card-bg) 97%, var(--color-accent)))',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-card)',
        transitionTimingFunction: 'var(--ease-out-quint)',
        // Full cards size to their content so the masonry actually staggers;
        // the preview caps its own height below. Compact keeps a fixed clamp.
        minHeight: isCompact ? 'auto' : undefined,
        maxHeight: isCompact ? '120px' : undefined,
      }}
    >
      {!isDecorative && (
        <button
          type="button"
          className="absolute inset-0 z-10 h-full w-full rounded-[inherit] border-0 bg-transparent p-0 focus-ring"
          aria-label={`Open note: ${note.title || 'Untitled'}`}
          // One tab stop per card: while the card holds the J/K roving focus, the
          // card is the stop (Enter opens it) and this button leaves the tab order.
          tabIndex={isFocused ? -1 : undefined}
          onClick={() => onClick(note.id)}
        />
      )}

      {/* Pin button - top-right corner (full mode, or the compact pinned row).
          Touch screens have no hover, so an unpinned pin shows at its hover opacity
          there, and on any device with a touch pointer (a touch laptop reports hover);
          otherwise the corner is an invisible pin target. */}
      {(!isCompact || keepPin) && !isDecorative && (
        <button type="button"
          onClick={handlePinClick}
          className={`
            absolute top-2 right-2
            z-20
            size-10
            rounded-full
            flex items-center justify-center
            transition-opacity duration-200
            focus:outline-none
            focus:ring-2
            focus:ring-[var(--color-accent)]
            focus-visible:opacity-100
            ${note.pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-40 hover:!opacity-85 [@media(hover:none)]:opacity-40 [@media(any-pointer:coarse)]:opacity-40'}
          `}
          style={{ color: 'var(--color-text-tertiary)' }}
          aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
          title={note.pinned ? 'Unpin note' : 'Pin note'}
        >
          {note.pinned ? (
            <PinnedMark className="size-6" />
          ) : (
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          )}
        </button>
      )}
      {!isCompact && isDecorative && note.pinned && (
        <span className="absolute top-4 right-4 z-20" aria-hidden="true">
          <PinnedMark className="size-6" />
        </span>
      )}

      {/* Title row - with inline pin in compact mode */}
      <div className={`flex items-center gap-2 ${isCompact ? 'mb-1' : 'mb-3'} ${keepPin ? 'pr-9' : ''} shrink-0`}>
        {/* Inline pin icon (compact mode only, unless the pin button is kept) */}
        {isCompact && !keepPin && note.pinned && (
          <PinnedMark className="size-4 shrink-0" />
        )}
        {/* Title - sanitized to prevent XSS */}
        <h3
          className={`
            font-semibold
            leading-tight
            ${isCompact ? 'text-base truncate' : 'text-xl line-clamp-2'}
          `}
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text-primary)',
          }}
          dangerouslySetInnerHTML={{ __html: highlightedTitle || 'Untitled' }}
        />
      </div>

      {/* Search results use the match snippets; ordinary cards keep their rich preview. */}
      {searchSnippet ? (
        <p
          className="search-snippet text-sm overflow-hidden"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.6,
            maxHeight: '8em',
          }}
          dangerouslySetInnerHTML={{ __html: searchSnippet }}
        />
      ) : isCompact ? (
        <p
          className="flex-1 overflow-hidden text-sm truncate"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {compactPreview || 'No content'}
        </p>
      ) : (
        <div
          ref={previewRef}
          className={`overflow-hidden note-card-preview ${isPreviewOverflowing ? 'note-card-preview-overflowing' : ''}`}
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
            // Content-driven height up to ~5 lines; overflowing text fades at the cut.
            maxHeight: '8em',
          }}
          dangerouslySetInnerHTML={{ __html: htmlPreview || 'No content' }}
        />
      )}

      {/* Footer: Tags + Timestamp + Delete */}
      <div className={`flex items-center justify-between mt-auto shrink-0 ${isCompact ? 'pt-2' : 'pt-4'}`}>
        {/* Tag badges */}
        <div className="flex-1 min-w-0">
          {note.tags && note.tags.length > 0 ? (
            <TagBadgeList tags={note.tags} maxDisplay={2} />
          ) : (
            <span />
          )}
        </div>

        {/* Timestamp */}
        <time
          className={`
            italic
            shrink-0
            ml-3
            ${isCompact ? 'text-xs' : 'text-[0.85rem]'}
          `}
          dateTime={note.updatedAt.toISOString()}
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          {formatRelativeTime(note.updatedAt)}
        </time>

        {/* Delete button. Shown at hover opacity on touch screens, for the same reason
            as the pin button. Compact cards are the phone library and desktop pinned
            rows: they show it on touch screens only, because there is no swipe to delete
            (removed in #162 as too easy to trigger). */}
        {!isDecorative && (
          <button type="button"
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className={`
              relative z-20
              size-10
              rounded-full
              ${isCompact ? 'hidden [@media(hover:none)]:flex [@media(any-pointer:coarse)]:flex' : 'flex'}
              items-center justify-center
              opacity-0
              group-hover:opacity-40
              hover:!opacity-85
              [@media(hover:none)]:opacity-40 [@media(any-pointer:coarse)]:opacity-40
              transition-opacity duration-200
              focus:outline-none
              focus:ring-2
              focus:ring-[var(--color-accent)]
              focus-visible:opacity-100
              ml-2
              ${isCompact ? '-mr-2' : '-mr-4'}
              shrink-0
            `}
            style={{
              background: 'transparent',
              color: 'var(--color-text-tertiary)',
            }}
            aria-label="Delete note"
            title="Delete note"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {deleteError && (
        <p
          role="alert"
          className="relative z-20 mt-3 text-xs"
          style={{ color: 'var(--color-destructive)' }}
        >
          {deleteError}
        </p>
      )}

    </div>
  );
}, (prev, next) =>
  prev.note === next.note &&
  prev.isCompact === next.isCompact &&
  prev.keepPin === next.keepPin &&
  prev.isDecorative === next.isDecorative &&
  prev.searchQuery === next.searchQuery &&
  prev.isFocused === next.isFocused
);
