import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
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
    return email[0].toUpperCase();
  }

  return '?';
}

export interface MenuItemConfig {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  badge?: ReactNode;
}

export interface MenuSectionConfig {
  items: MenuItemConfig[];
}

interface HeaderShellProps {
  /** Current theme */
  theme: Theme;
  /** Theme toggle callback */
  onThemeToggle: () => void;
  /** Logo click callback (usually navigates to home/library) */
  onLogoClick?: () => void;
  /** Override left zone with custom content (e.g., logo + breadcrumb). If provided, replaces default logo. */
  leftContent?: ReactNode;
  /** Center content - varies by page (search bar, breadcrumb, etc.) */
  center?: ReactNode;
  /** Page-specific actions to show before theme toggle (e.g., delete button) */
  rightActions?: ReactNode;
  /** Settings click callback (for authenticated users) */
  onSettingsClick?: () => void;
  /** Sign in click callback (for unauthenticated users) */
  onSignIn?: () => void;
  /** Additional menu sections to show before Sign out (for authenticated users) */
  menuSections?: MenuSectionConfig[];
}

export function HeaderShell({
  theme,
  onThemeToggle,
  onLogoClick,
  leftContent,
  center,
  rightActions,
  onSettingsClick,
  onSignIn,
  menuSections,
}: HeaderShellProps) {
  const { user, signOut } = useAuth();
  const isAuthenticated = !!user;
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Get user display info
  const userFullName = user?.user_metadata?.full_name as string | undefined;
  const userEmail = user?.email;
  const userInitials = useMemo(
    () => getInitials(userFullName, userEmail),
    [userFullName, userEmail]
  );
  const userDisplayName = userFullName || userEmail || 'User';

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
      className="px-4 md:px-12 shrink-0"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      {/* Row 1: Logo + Center (desktop) + Right actions */}
      <div className="h-16 flex items-center">
        {/* Left Zone - Custom content or default Logo */}
        <div className="shrink-0 flex items-center min-w-0">
          {leftContent || (
            onLogoClick ? (
              <button
                onClick={onLogoClick}
                className="text-[1.4rem] md:text-[1.75rem] font-semibold tracking-tight transition-colors duration-200 hover:text-[var(--color-accent)]"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.5px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Zenote
              </button>
            ) : (
              <span
                className="text-[1.4rem] md:text-[1.75rem] font-semibold tracking-tight"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.5px',
                }}
              >
                Zenote
              </span>
            )
          )}
        </div>

        {/* Center Zone - Hidden on mobile, visible on desktop */}
        <div className="hidden sm:flex flex-1 justify-center items-center min-w-0 mx-4">
          {center}
        </div>

        {/* Right Zone - Theme Toggle + Avatar/Sign In (fixed position) */}
        <div className="ml-auto sm:ml-0 flex items-center gap-1 shrink-0">
        {/* Page-specific right actions (e.g., delete button) */}
        {rightActions}

        {/* Separator - only show if rightActions provided */}
        {rightActions && (
          <div
            className="w-px h-5 md:h-6 mx-0.5 md:mx-1"
            style={{ background: 'var(--glass-border)' }}
          />
        )}

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

        {/* Avatar (authenticated) or Sign In (unauthenticated) */}
        {isAuthenticated ? (
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
                  min-w-[160px]
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
                {onSettingsClick && (
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
                )}

                {/* Custom menu sections */}
                {menuSections?.map((section, sectionIndex) => (
                  <div key={sectionIndex}>
                    <div
                      className="my-1 mx-3"
                      style={{ borderTop: '1px solid var(--glass-border)' }}
                    />
                    {section.items.map((item, itemIndex) => (
                      <button
                        key={itemIndex}
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          item.onClick();
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
                        {item.icon}
                        <span className="flex-1">{item.label}</span>
                        {item.badge}
                      </button>
                    ))}
                  </div>
                ))}

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
        ) : (
          onSignIn && (
            <button
              onClick={onSignIn}
              className="px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:text-[var(--color-accent)]"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Sign In
            </button>
          )
        )}
        </div>
      </div>

      {/* Row 2: Center content on mobile only */}
      {center && (
        <div className="sm:hidden pb-3">
          {center}
        </div>
      )}
    </header>
  );
}
