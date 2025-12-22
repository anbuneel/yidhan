import { useState, useEffect, useRef } from 'react';
import type { Theme } from '../types';
import { HeaderShell, type MenuSectionConfig } from './HeaderShell';

interface HeaderProps {
  theme: Theme;
  onThemeToggle: () => void;
  onNewNote: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onExportJSON: () => void;
  onExportMarkdown: () => void;
  onImportFile: (file: File) => void;
  onSettingsClick: () => void;
  onFadedNotesClick: () => void;
  fadedNotesCount: number;
}

export function Header({
  theme,
  onThemeToggle,
  onNewNote,
  searchQuery,
  onSearchChange,
  onExportJSON,
  onExportMarkdown,
  onImportFile,
  onSettingsClick,
  onFadedNotesClick,
  fadedNotesCount,
}: HeaderProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd/Ctrl + K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape' && isSearchFocused) {
        searchRef.current?.blur();
        onSearchChange('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchFocused, onSearchChange]);

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

  // Center content: Search bar + New Note button
  const centerContent = (
    <div className="flex items-center gap-2 md:gap-4 w-full justify-center">
      {/* Search Bar */}
      <div
        className="flex-1 max-w-[280px] md:max-w-[420px] relative transition-all duration-300"
        style={{
          transform: isSearchFocused ? 'scale(1.02)' : 'scale(1)',
        }}
      >
        <div
          className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 rounded-full transition-all duration-300"
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
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search..."
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <span
              className="hidden md:inline text-xs px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              ⌘K
            </span>
          )}
        </div>
      </div>

      {/* New Note Button */}
      <button
        onClick={onNewNote}
        className="
          p-2 md:px-4 md:py-2
          rounded-full
          flex items-center gap-2
          transition-all duration-300
          focus:outline-none
          focus:ring-2
          focus:ring-[var(--color-accent)]
          focus:ring-offset-2
          hover:-translate-y-0.5
          shrink-0
        "
        style={{
          background: 'var(--color-accent)',
          color: 'var(--color-bg-primary)',
          boxShadow: '0 4px 20px var(--color-accent-glow)',
          fontFamily: 'var(--font-body)',
        }}
        aria-label="New note"
      >
        <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="hidden md:inline text-sm font-medium">New Note</span>
      </button>
    </div>
  );

  return (
    <>
      <HeaderShell
        theme={theme}
        onThemeToggle={onThemeToggle}
        center={centerContent}
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
