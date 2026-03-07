import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BottomSheet } from './BottomSheet';
import type { UseSessionSettingsResult } from '../hooks/useSessionSettings';
import type { UseVaultSettingsResult } from '../hooks/useVaultSettings';
import type { Theme } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeToggle: () => void;
  onLetGoClick: () => void;
  sessionSettings: UseSessionSettingsResult;
  vaultSettings?: UseVaultSettingsResult;
  isVaultUnlocked?: boolean;
  onLockVault?: () => void;
  onPersistToLocal?: () => void;
}

type SettingsTab = 'profile' | 'password' | 'security';

export function SettingsModal({ isOpen, onClose, theme, onThemeToggle, onLetGoClick, sessionSettings, vaultSettings, isVaultUnlocked, onLockVault, onPersistToLocal }: SettingsModalProps) {
  const { user, updateProfile, updatePassword, verifyPassword } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Check if user signed up with OAuth (Google, GitHub, etc.)
  const provider = user?.app_metadata?.provider;
  const isOAuthUser =
    provider === 'google' ||
    provider === 'github' ||
    user?.identities?.some((identity) => identity.provider !== 'email');

  // Profile state
  const [fullName, setFullName] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Initialize form with user data
  useEffect(() => {
    if (isOpen && user) {
      setFullName(user.user_metadata?.full_name || '');
      setProfileMessage(null);
      setPasswordMessage(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, user]);

  function handleRememberBrowserToggle() {
    if (!vaultSettings) return;
    const newValue = !vaultSettings.settings.rememberBrowser;
    vaultSettings.setRememberBrowser(newValue);
    if (newValue) onPersistToLocal?.();
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    setProfileLoading(true);

    try {
      const { error } = await updateProfile(fullName.trim());
      if (error) {
        setProfileMessage({ type: 'error', text: error.message });
      } else {
        setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    // Validate current password is provided
    if (!currentPassword) {
      setPasswordMessage({ type: 'error', text: 'Please enter your current password' });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 8 characters' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setPasswordLoading(true);

    try {
      // Step 1: Verify current password
      const verifyResult = await verifyPassword(currentPassword);
      if (!verifyResult.success) {
        setPasswordMessage({ type: 'error', text: 'Current password is incorrect' });
        return;
      }

      // Step 2: Update to new password
      const { error } = await updatePassword(newPassword);
      if (error) {
        setPasswordMessage({ type: 'error', text: error.message });
      } else {
        setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Settings" maxHeightPercent={85}>
      {/* Tabs - always show Profile & Security, Password only for non-OAuth */}
      <div
        className="flex gap-1 px-6 py-3 border-b"
        style={{ borderColor: 'var(--glass-border)' }}
      >
        <button
          onClick={() => setActiveTab('profile')}
          className="
            px-4 py-2
            text-sm font-medium
            rounded-lg
            transition-colors duration-200
            touch-press-light
          "
          style={{
            fontFamily: 'var(--font-body)',
            color: activeTab === 'profile' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            background: activeTab === 'profile' ? 'var(--color-accent-glow)' : 'transparent',
          }}
        >
          Profile
        </button>
        {!isOAuthUser && (
          <button
            onClick={() => setActiveTab('password')}
            className="
              px-4 py-2
              text-sm font-medium
              rounded-lg
              transition-colors duration-200
              touch-press-light
            "
            style={{
              fontFamily: 'var(--font-body)',
              color: activeTab === 'password' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              background: activeTab === 'password' ? 'var(--color-accent-glow)' : 'transparent',
            }}
          >
            Password
          </button>
        )}
        <button
          onClick={() => setActiveTab('security')}
          className="
            px-4 py-2
            text-sm font-medium
            rounded-lg
            transition-colors duration-200
            touch-press-light
          "
          style={{
            fontFamily: 'var(--font-body)',
            color: activeTab === 'security' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            background: activeTab === 'security' ? 'var(--color-accent-glow)' : 'transparent',
          }}
        >
          Security
        </button>
      </div>

        {/* Content */}
        <div className="px-8 py-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit}>
              {/* Email (read-only) */}
              <div className="mb-5">
                <label
                  htmlFor="settings-email"
                  className="block text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Email
                </label>
                <input
                  id="settings-email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="
                    w-full px-4 py-3
                    rounded-lg
                    outline-none
                    opacity-60
                    cursor-not-allowed
                  "
                  style={{
                    fontFamily: 'var(--font-body)',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              {/* Full Name */}
              <div className="mb-5">
                <label
                  htmlFor="settings-display-name"
                  className="block text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Display Name
                </label>
                <input
                  id="settings-display-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your name"
                  className="
                    w-full px-4 py-3
                    rounded-lg
                    outline-none
                    transition-all duration-200
                  "
                  style={{
                    fontFamily: 'var(--font-body)',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                  }}
                />
              </div>

              {/* Theme Toggle */}
              <div className="mb-6">
                <label
                  className="block text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Theme
                </label>
                <button
                  type="button"
                  onClick={onThemeToggle}
                  className="
                    w-full px-4 py-3
                    rounded-lg
                    flex items-center justify-between
                    transition-all duration-200
                  "
                  style={{
                    fontFamily: 'var(--font-body)',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                  }}
                >
                  <span className="flex items-center gap-3">
                    {theme === 'light' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    )}
                    {theme === 'light' ? 'Light (Kintsugi)' : 'Dark (Midnight)'}
                  </span>
                  <span
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: 'var(--color-accent-glow)',
                      color: 'var(--color-accent)',
                    }}
                  >
                    Click to switch
                  </span>
                </button>
              </div>

              {/* Message */}
              {profileMessage && (
                <p
                  className="mb-4 text-sm text-center"
                  style={{
                    color: profileMessage.type === 'success' ? 'var(--color-accent)' : 'var(--color-destructive)',
                  }}
                >
                  {profileMessage.text}
                </p>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={profileLoading}
                className="
                  w-full py-3
                  rounded-lg
                  font-medium
                  transition-all duration-200
                  disabled:opacity-50
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  background: 'var(--color-cta-bg)',
                  color: 'var(--color-cta-text)',
                }}
                onMouseEnter={(e) => {
                  if (!profileLoading) {
                    e.currentTarget.style.background = 'var(--color-cta-bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-cta-bg)';
                }}
              >
                {profileLoading ? 'Saving...' : 'Save Profile'}
              </button>

              {/* Let go section - offboarding link */}
              <div
                className="mt-8 pt-6 text-center"
                style={{ borderTop: '1px solid var(--glass-border)' }}
              >
                <p
                  className="text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  Ready to move on?
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLetGoClick();
                  }}
                  className="text-sm transition-colors duration-200"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-tertiary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-tertiary)';
                  }}
                >
                  Let go of Yidhan →
                </button>
              </div>
            </form>
          )}

          {/* Password Tab - only for non-OAuth users */}
          {activeTab === 'password' && !isOAuthUser && (
            <form onSubmit={handlePasswordSubmit}>
              <p
                className="text-sm mb-5"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Verify your current password, then enter a new one.
              </p>

              {/* Current Password */}
              <div className="mb-5">
                <label
                  htmlFor="settings-current-password"
                  className="block text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Current Password
                </label>
                <input
                  id="settings-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  required
                  className="
                    w-full px-4 py-3
                    rounded-lg
                    outline-none
                    transition-all duration-200
                  "
                  style={{
                    fontFamily: 'var(--font-body)',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                  }}
                />
              </div>

              {/* New Password */}
              <div className="mb-5">
                <label
                  htmlFor="settings-new-password"
                  className="block text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  New Password
                </label>
                <input
                  id="settings-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  minLength={8}
                  required
                  className="
                    w-full px-4 py-3
                    rounded-lg
                    outline-none
                    transition-all duration-200
                  "
                  style={{
                    fontFamily: 'var(--font-body)',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                  }}
                />
              </div>

              {/* Confirm Password */}
              <div className="mb-6">
                <label
                  htmlFor="settings-confirm-password"
                  className="block text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Confirm New Password
                </label>
                <input
                  id="settings-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  minLength={8}
                  required
                  className="
                    w-full px-4 py-3
                    rounded-lg
                    outline-none
                    transition-all duration-200
                  "
                  style={{
                    fontFamily: 'var(--font-body)',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                  }}
                />
              </div>

              {/* Message */}
              {passwordMessage && (
                <p
                  className="mb-4 text-sm text-center"
                  style={{
                    color: passwordMessage.type === 'success' ? 'var(--color-accent)' : 'var(--color-destructive)',
                  }}
                >
                  {passwordMessage.text}
                </p>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={passwordLoading}
                className="
                  w-full py-3
                  rounded-lg
                  font-medium
                  transition-all duration-200
                  disabled:opacity-50
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  background: 'var(--color-cta-bg)',
                  color: 'var(--color-cta-text)',
                }}
                onMouseEnter={(e) => {
                  if (!passwordLoading) {
                    e.currentTarget.style.background = 'var(--color-cta-bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-cta-bg)';
                }}
              >
                {passwordLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div>
              <p
                className="text-sm mb-5"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Manage your vault, session, and device trust settings.
              </p>

              {/* Encryption Vault */}
              {vaultSettings && (
                <div
                  className="mb-6 pb-5"
                  style={{ borderBottom: '1px solid var(--glass-border)' }}
                >
                  <h3
                    className="text-sm font-medium mb-3"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    Encryption Vault
                  </h3>

                  {/* Vault Status */}
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <span
                        className="text-sm"
                        style={{
                          fontFamily: 'var(--font-body)',
                          color: isVaultUnlocked ? 'var(--color-text-secondary)' : 'var(--color-success)',
                        }}
                      >
                        {isVaultUnlocked ? 'Vault is unlocked' : 'Vault is locked'}
                      </span>
                      {isVaultUnlocked && (
                        <p
                          className="text-xs mt-0.5"
                          style={{
                            fontFamily: 'var(--font-body)',
                            color: 'var(--color-text-tertiary)',
                          }}
                        >
                          {vaultSettings?.settings.rememberBrowser
                            ? 'Keys are remembered on this browser. Lock manually or sign out to clear.'
                            : 'Keys are held for this browser session and cleared when you close the tab.'}
                        </p>
                      )}
                    </div>
                    {isVaultUnlocked && onLockVault && (
                      <button
                        onClick={onLockVault}
                        className="
                          px-3 py-1.5
                          rounded-lg
                          text-xs font-medium
                          transition-all duration-200
                        "
                        style={{
                          fontFamily: 'var(--font-body)',
                          background: 'var(--color-bg-secondary)',
                          border: '1px solid var(--glass-border)',
                          color: 'var(--color-text-secondary)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-accent)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--glass-border)';
                        }}
                      >
                        Lock vault now
                      </button>
                    )}
                  </div>

                  {/* Vault Auto-Lock */}
                  <div>
                    <label
                      className="block text-sm mb-2"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      Vault auto-lock
                    </label>
                    <select
                      value={String(vaultSettings.settings.autoLockMinutes)}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value, 10);
                        if (parsed === 0 || parsed === 15 || parsed === 60) {
                          vaultSettings.setAutoLockMinutes(parsed);
                        }
                      }}
                      className="
                        w-full px-4 py-2
                        rounded-lg
                        outline-none
                        transition-all duration-200
                        cursor-pointer
                      "
                      style={{
                        fontFamily: 'var(--font-body)',
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--glass-border)',
                        color: 'var(--color-text-primary)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-accent)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--glass-border)';
                      }}
                    >
                      <option value="0">Off</option>
                      <option value="15">15 minutes</option>
                      <option value="60">60 minutes</option>
                    </select>
                    <p
                      className="text-xs mt-1.5"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text-tertiary)',
                      }}
                    >
                      {vaultSettings.settings.rememberBrowser
                        ? 'Locks the vault when idle. Keys stay remembered \u2014 no passphrase needed.'
                        : 'Locks the vault when idle. You\u2019ll need your passphrase to unlock again.'}
                    </p>
                  </div>

                  {/* Remember This Browser Toggle */}
                  <div className="mt-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={handleRememberBrowserToggle}
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <div>
                        <span className="block text-sm">Remember this browser</span>
                        <span
                          className="block text-xs mt-1"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          Stay unlocked across sessions. Only use on personal devices.
                        </span>
                      </div>
                      <div
                        className="relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer shrink-0 ml-4"
                        style={{
                          background: vaultSettings.settings.rememberBrowser
                            ? 'var(--color-accent)'
                            : 'var(--color-bg-tertiary)',
                        }}
                        role="switch"
                        aria-checked={vaultSettings.settings.rememberBrowser}
                        aria-label="Remember this browser"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleRememberBrowserToggle();
                          }
                        }}
                      >
                        <div
                          className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-transform duration-200"
                          style={{
                            background: 'var(--color-bg-primary)',
                            transform: vaultSettings.settings.rememberBrowser
                              ? 'translateX(26px)'
                              : 'translateX(2px)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Session & Trust */}
              <div>
                <h3
                  className="text-sm font-medium mb-3"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Session & Trust
                </h3>

                {/* Session Timeout */}
                <div className="mb-5">
                  <label
                    className="block text-sm mb-2"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Session timeout
                  </label>
                  <select
                    value={sessionSettings.settings.timeoutMinutes === null ? 'null' : String(sessionSettings.settings.timeoutMinutes)}
                    onChange={(e) => {
                      const value = e.target.value === 'null' ? null : parseInt(e.target.value, 10);
                      sessionSettings.setTimeoutMinutes(value);
                    }}
                    className="
                      w-full px-4 py-2
                      rounded-lg
                      outline-none
                      transition-all duration-200
                      cursor-pointer
                    "
                    style={{
                      fontFamily: 'var(--font-body)',
                      background: 'var(--color-bg-secondary)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--color-text-primary)',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-accent)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--glass-border)';
                    }}
                  >
                    {sessionSettings.availableTimeoutOptions.map((option) => (
                      <option key={option.value === null ? 'null' : option.value} value={option.value === null ? 'null' : option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p
                    className="text-xs mt-1.5"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    How long before you're signed out when inactive
                  </p>
                </div>

                {/* Trusted Device Toggle */}
                <div className="mb-5">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={sessionSettings.toggleTrustedDevice}
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <div>
                      <span className="block text-sm">This is a trusted device</span>
                      <span
                        className="block text-xs mt-1"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Extends session to 14 days. Only use on personal devices.
                      </span>
                    </div>
                    <div
                      className="relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer shrink-0 ml-4"
                      style={{
                        background: sessionSettings.settings.isTrustedDevice
                          ? 'var(--color-accent)'
                          : 'var(--color-bg-tertiary)',
                      }}
                      role="switch"
                      aria-checked={sessionSettings.settings.isTrustedDevice}
                      aria-label="This is a trusted device"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          sessionSettings.toggleTrustedDevice();
                        }
                      }}
                    >
                      <div
                        className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-transform duration-200"
                        style={{
                          background: 'var(--color-bg-primary)',
                          transform: sessionSettings.settings.isTrustedDevice
                            ? 'translateX(26px)'
                            : 'translateX(2px)',
                        }}
                      />
                    </div>
                  </div>
                  {sessionSettings.settings.isTrustedDevice && sessionSettings.settings.trustedAt && (
                    <p
                      className="text-xs mt-2"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text-tertiary)',
                      }}
                    >
                      Trusted since {new Date(sessionSettings.settings.trustedAt).toLocaleDateString()}
                      {' '}(expires after 90 days)
                    </p>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
    </BottomSheet>
  );
}
