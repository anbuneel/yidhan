import { useState, useEffect, useRef, useMemo } from 'react';
import type { Theme } from '../types';
import { useAuth } from '../contexts/AuthContext';

/**
 * Extract initials from a full name or email
 */
function getInitials(fullName?: string, email?: string): string {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  if (email) {
    // Use first letter of email
    return email[0].toUpperCase();
  }

  return '?';
}

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
}: HeaderProps) {
  const { signOut, user } = useAuth();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get user display info
  const userFullName = user?.user_metadata?.full_name as string | undefined;
  const userEmail = user?.email;
  const userInitials = useMemo(
    () => getInitials(userFullName, userEmail),
    [userFullName, userEmail]
  );
  const userDisplayName = userFullName || userEmail || 'User';

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

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileMenuOpen]);

  return (
    <header
      className="
        h-16
        px-6 md:px-12
        flex
        items-center
        gap-3 md:gap-6
      "
      style={{ background: 'transparent' }}
    >
      {/* Left Zone - Logo */}
      <h1
        className="text-2xl md:text-[1.75rem] font-semibold tracking-tight cursor-pointer shrink-0"
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.5px',
        }}
      >
        Zenote
      </h1>

      {/* Center Zone - Search Bar (truly centered) */}
      <div className="flex-1 flex justify-center">
        <div
          className="
            w-full
            max-w-[420px]
            relative
            transition-all duration-300
          "
          style={{
            transform: isSearchFocused ? 'scale(1.02)' : 'scale(1)',
          }}
        >
          <div
            className="
              flex items-center gap-3
              px-4 py-2
              rounded-full
              transition-all duration-300
            "
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
              placeholder="Search notes..."
              className="
                flex-1
                bg-transparent
                border-none
                outline-none
                text-sm
              "
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-primary)',
              }}
            />
            {searchQuery ? (
              <button
                onClick={() => onSearchChange('')}
                className="
                  w-5 h-5
                  rounded-full
                  flex items-center justify-center
                  transition-colors duration-200
                "
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
                className="hidden md:inline text-xs px-1.5 py-0.5 rounded"
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
      </div>

      {/* Right Zone - Actions */}
      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        {/* New Note Button - Primary Action */}
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

        {/* Separator - hidden on mobile */}
        <div
          className="hidden md:block w-px h-6 mx-1"
          style={{ background: 'var(--glass-border)' }}
        />
        {/* Theme Toggle - hidden on mobile, accessible via profile menu */}
        <button
          onClick={onThemeToggle}
          className="
            hidden md:flex
            w-9 h-9
            rounded-full
            items-center justify-center
            transition-all duration-300
            focus:outline-none
            focus:ring-2
            focus:ring-[var(--color-accent)]
            hover:text-[var(--color-accent)]
            hover:bg-[var(--color-bg-secondary)]
          "
          style={{
            color: 'var(--color-text-secondary)',
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

        {/* Profile Menu */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="
              w-9 h-9
              rounded-full
              flex items-center justify-center
              transition-all duration-300
              focus:outline-none
              focus:ring-2
              focus:ring-[var(--color-accent)]
              hover:opacity-90
              text-sm font-medium
            "
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-bg-primary)',
            }}
            aria-label="Profile menu"
            aria-expanded={isProfileMenuOpen}
            title={userDisplayName}
          >
            {userInitials}
          </button>

          {/* Dropdown Menu */}
          {isProfileMenuOpen && (
            <div
              className="
                absolute right-0 top-full mt-2
                min-w-[180px]
                py-2
                rounded-lg
                shadow-lg
                z-50
              "
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onSettingsClick();
                }}
                className="
                  w-full px-4 py-2.5
                  flex items-center gap-3
                  text-left text-sm
                  transition-colors duration-150
                  hover:bg-[var(--color-bg-tertiary)]
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </button>

              {/* Theme Toggle - visible on mobile only in menu */}
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onThemeToggle();
                }}
                className="
                  md:hidden
                  w-full px-4 py-2.5
                  flex items-center gap-3
                  text-left text-sm
                  transition-colors duration-150
                  hover:bg-[var(--color-bg-tertiary)]
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {theme === 'light' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              </button>

              <div
                className="my-1 mx-3"
                style={{ borderTop: '1px solid var(--glass-border)' }}
              />

              {/* Export JSON */}
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onExportJSON();
                }}
                className="
                  w-full px-4 py-2.5
                  flex items-center gap-3
                  text-left text-sm
                  transition-colors duration-150
                  hover:bg-[var(--color-bg-tertiary)]
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Export (JSON)
              </button>

              {/* Export Markdown */}
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onExportMarkdown();
                }}
                className="
                  w-full px-4 py-2.5
                  flex items-center gap-3
                  text-left text-sm
                  transition-colors duration-150
                  hover:bg-[var(--color-bg-tertiary)]
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Export (Markdown)
              </button>

              {/* Import */}
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className="
                  w-full px-4 py-2.5
                  flex items-center gap-3
                  text-left text-sm
                  transition-colors duration-150
                  hover:bg-[var(--color-bg-tertiary)]
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Import Notes
              </button>

              <div
                className="my-1 mx-3"
                style={{ borderTop: '1px solid var(--glass-border)' }}
              />

              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  signOut();
                }}
                className="
                  w-full px-4 py-2.5
                  flex items-center gap-3
                  text-left text-sm
                  transition-colors duration-150
                  hover:bg-[var(--color-bg-tertiary)]
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

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
    </header>
  );
}
