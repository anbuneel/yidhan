import { useState, useEffect, useRef } from 'react';
import type { Theme } from '../types';
import { HeaderShell, type MenuSectionConfig } from './HeaderShell';
import { SyncIndicator } from './SyncIndicator';
import { LIBRARY_SEARCH_INPUT_ID, scheduleSearchFocus } from '../utils/searchFocus';

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '\u2318' : 'Ctrl+';
let lastHandledSearchFocusToken = 0;

interface HeaderProps {
  theme: Theme;
  onThemeToggle: () => void;
  onNewNote: () => void;
  searchFocusToken: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onExportJSON: () => void;
  onExportMarkdown: () => void;
  onImportFile: (file: File) => void;
  onSettingsClick: () => void;
  onFadedNotesClick: () => void;
  fadedNotesCount: number;
  onRetryBlockedChanges?: () => Promise<void>;
  isRetryingBlockedChanges?: boolean;
  matchedCount?: number;
  totalCount?: number;
}

export function Header({
  theme,
  onThemeToggle,
  onNewNote,
  searchFocusToken,
  searchQuery,
  onSearchChange,
  onExportJSON,
  onExportMarkdown,
  onImportFile,
  onSettingsClick,
  onFadedNotesClick,
  fadedNotesCount,
  onRetryBlockedChanges,
  isRetryingBlockedChanges = false,
  matchedCount,
  totalCount,
}: HeaderProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchShortcutHint = `${modKey}K`;

  useEffect(() => {
    if (searchFocusToken === 0 || searchFocusToken === lastHandledSearchFocusToken) {
      return;
    }

    lastHandledSearchFocusToken = searchFocusToken;

    const frame = window.requestAnimationFrame(() => {
      scheduleSearchFocus(LIBRARY_SEARCH_INPUT_ID);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [searchFocusToken]);

  // Build menu sections for profile dropdown
  const menuSections: MenuSectionConfig[] = [
    {
      items: [
        {
          label: 'Export (JSON)',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          ),
          onClick: onExportJSON,
        },
        {
          label: 'Export (Markdown)',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          ),
          onClick: onExportMarkdown,
        },
        {
          label: 'Import Notes',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          ),
          onClick: () => fileInputRef.current?.click(),
        },
        {
          label: 'Faded Notes',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          onClick: onFadedNotesClick,
          badge: fadedNotesCount > 0 ? (
            <span
              className="min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium flex items-center justify-center"
              style={{
                background: 'var(--color-accent-glow)',
                color: 'var(--color-accent)',
              }}
            >
              {fadedNotesCount > 99 ? '99+' : fadedNotesCount}
            </span>
          ) : undefined,
        },
      ],
    },
  ];

  // Center content: Search bar only
  const centerContent = (
    <div className="flex items-center w-full sm:justify-center">
      {/* Search Bar */}
      <div
        className="flex-1 sm:max-w-[420px] relative transition-all duration-300"
        style={{
          transform: isSearchFocused ? 'scale(1.02)' : 'scale(1)',
        }}
      >
        <div
          className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-full transition-all duration-300"
          style={{
            background: 'var(--color-bg-secondary)',
            border: isSearchFocused
              ? '1px solid var(--color-accent)'
              : '1px solid var(--glass-border)',
            boxShadow: isSearchFocused
              ? '0 4px 20px var(--color-accent-glow)'
              : 'none',
          }}
        >
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: isSearchFocused ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id={LIBRARY_SEARCH_INPUT_ID}
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onSearchChange('');
                e.currentTarget.blur();
              }
            }}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search your thoughts..."
            className="flex-1 bg-transparent border-none outline-none text-sm min-w-0"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-primary)',
            }}
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchChange('')}
              className="w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-200 shrink-0"
              style={{
                background: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <span
              className="hidden sm:inline text-xs px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {searchShortcutHint}
            </span>
          )}
        </div>

        {/* Search result count */}
        {searchQuery && matchedCount !== undefined && totalCount !== undefined && (
          <p
            className="text-center mt-1"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-tertiary)',
              fontSize: '0.7rem',
            }}
            aria-live="polite"
          >
            {matchedCount} of {totalCount} thoughts
          </p>
        )}
      </div>
    </div>
  );

  // New Note button (shown in header row 1)
  const newNoteButton = (
    <button
      onClick={onNewNote}
      className="
        p-2 sm:px-4 sm:py-2
        rounded-full
        flex items-center gap-2
        transition-all duration-300
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--color-accent)]
        focus:ring-offset-2
        hover:-translate-y-0.5
        shrink-0
        touch-press
      "
      style={{
        background: 'var(--color-cta-bg)',
        color: 'var(--color-cta-text)',
        boxShadow: '0 4px 20px var(--color-accent-glow)',
        fontFamily: 'var(--font-body)',
      }}
      aria-label="New note"
    >
      <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
      </svg>
      <span className="hidden sm:inline text-sm font-medium">New Note</span>
    </button>
  );

  // Combine sync indicator and new note button as right actions
  const rightActionsContent = (
    <div className="flex items-center gap-2 sm:gap-3">
      <SyncIndicator
        onRetryBlockedChanges={onRetryBlockedChanges}
        isRetryingBlockedChanges={isRetryingBlockedChanges}
      />
      {newNoteButton}
    </div>
  );

  return (
    <>
      <HeaderShell
        theme={theme}
        onThemeToggle={onThemeToggle}
        center={centerContent}
        rightActions={rightActionsContent}
        onSettingsClick={onSettingsClick}
        menuSections={menuSections}
      />

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.md,.markdown"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onImportFile(file);
            e.target.value = ''; // Reset for future imports
          }
        }}
      />
    </>
  );
}
