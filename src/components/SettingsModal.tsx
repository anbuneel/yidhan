import { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BottomSheet } from './BottomSheet';
import { RecoveryKeySettings } from './RecoveryKeySettings';
import { EditorSettings } from './EditorSettings';
import { ACCOUNT_OFFBOARDING_ENABLED } from '../config/featureFlags';
import { readRecoveryWrap, readVaultMetadata } from '../lib/vaultMetadata';
import { neverEndsAt, TIMEOUT_OPTIONS, type UseSessionSettingsResult } from '../hooks/useSessionSettings';
import {
  applySecurityPreset,
  presetForSettings,
  SECURITY_PRESETS,
  type SecurityPresetChoice,
  type SecurityPresetId,
} from '../lib/securityPresets';
import type { UseVaultSettingsResult } from '../hooks/useVaultSettings';
import type { Theme } from '../types';
import { PasswordInput } from './PasswordInput';

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
  onPersistToLocal?: () => boolean;
}

type SettingsTab = 'profile' | 'password' | 'security' | 'editor';

export function SettingsModal({ isOpen, onClose, theme, onThemeToggle, onLetGoClick, sessionSettings, vaultSettings, isVaultUnlocked, onLockVault, onPersistToLocal }: SettingsModalProps) {
  const { user, updateProfile, updatePassword, verifyPassword } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Same check as RecoveryKeySettings. Only changes the Change passphrase wording.
  const vaultMeta = (user?.user_metadata as Record<string, unknown> | undefined)?.vault;
  const hasRecoveryKey = readVaultMetadata(vaultMeta).status === 'valid'
    && readRecoveryWrap((vaultMeta as Record<string, unknown> | undefined)?.recoveryWrap).status === 'valid';

  // "Go to Recovery key": scroll to the row and move focus to its button.
  const recoveryKeyRowRef = useRef<HTMLDivElement>(null);
  const goToRecoveryKey = () => {
    const row = recoveryKeyRowRef.current;
    if (!row) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    row.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  };

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
  const [securityMessage, setSecurityMessage] = useState<{ text: string } | null>(null);
  const formOwnerRef = useRef<string | null>(null);

  const openFormOwner = isOpen && user ? user.id : null;
  if (formOwnerRef.current !== openFormOwner) {
    formOwnerRef.current = openFormOwner;
    if (openFormOwner) {
      setFullName(user?.user_metadata?.full_name || '');
      setProfileMessage(null);
      setPasswordMessage(null);
      setSecurityMessage(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }

  function handleRememberBrowserToggle() {
    if (!vaultSettings) return;
    setSecurityMessage(null);

    const newValue = !vaultSettings.settings.rememberBrowser;
    const success = vaultSettings.setRememberBrowser(newValue, {
      persistKeys: newValue && isVaultUnlocked ? onPersistToLocal : undefined,
    });

    if (!success) {
      setSecurityMessage({
        text: newValue
          ? 'Could not remember this browser. Check available storage or browser privacy settings and try again.'
          : 'Could not update this browser setting. Please try again.',
      });
    }
  }

  // "On this device" (J1, J2): the preset is read back from the stored settings.
  const currentPreset: SecurityPresetChoice = vaultSettings
    ? presetForSettings({
        autoLockMinutes: vaultSettings.settings.autoLockMinutes,
        rememberBrowser: vaultSettings.settings.rememberBrowser,
        timeoutMinutes: sessionSettings.settings.timeoutMinutes,
      })
    : 'custom';
  const presetOptions: { id: SecurityPresetChoice; label: string; description: string }[] = [
    ...SECURITY_PRESETS.map(({ id, label, description }) => ({ id, label, description })),
    // Custom shows only while it is the state. It is not something to pick.
    ...(currentPreset === 'custom'
      ? [{ id: 'custom' as const, label: 'Custom', description: 'Your own mix of the settings under Details.' }]
      : []),
  ];

  function handlePresetChange(id: SecurityPresetId) {
    if (!vaultSettings) return;
    setSecurityMessage(null);
    const result = applySecurityPreset(id, {
      setAutoLockMinutes: vaultSettings.setAutoLockMinutes,
      setRememberBrowser: vaultSettings.setRememberBrowser,
      setTimeoutMinutes: sessionSettings.setTimeoutMinutes,
      persistKeys: isVaultUnlocked ? onPersistToLocal : undefined,
    });
    if (!result.ok) {
      setSecurityMessage({
        text: result.failed === 'remember-browser'
          ? 'Could not remember this browser, so the other settings were not changed. Check available storage or browser privacy settings and try again.'
          : 'This choice applies now, but part of it could not be saved and may not last after you reload. Check available storage or browser privacy settings.',
      });
    }
  }

  const neverSince = sessionSettings.settings.timeoutMinutes === null ? sessionSettings.settings.neverSince : null;
  const neverEndsOn = neverSince ? neverEndsAt(neverSince).toLocaleDateString() : null;

  const selectStyle = {
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--glass-border)',
    color: 'var(--color-text-primary)',
  } as const;

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
        className="flex flex-wrap gap-1 px-4 sm:px-6 py-3 border-b"
        style={{ borderColor: 'var(--glass-border)' }}
      >
        <button type="button"
          onClick={() => setActiveTab('profile')}
          className="
            px-3 sm:px-4 py-2
            text-sm font-medium
            rounded-lg
            transition-colors duration-200
            touch-press-light
          "
          style={{
            fontFamily: 'var(--font-body)',
            color: activeTab === 'profile' ? 'var(--color-accent-text)' : 'var(--color-text-secondary)',
            background: activeTab === 'profile' ? 'var(--color-accent-glow)' : 'transparent',
          }}
        >
          Profile
        </button>
        {!isOAuthUser && (
          <button type="button"
            onClick={() => setActiveTab('password')}
            className="
              px-3 sm:px-4 py-2
              text-sm font-medium
              rounded-lg
              transition-colors duration-200
              touch-press-light
            "
            style={{
              fontFamily: 'var(--font-body)',
              color: activeTab === 'password' ? 'var(--color-accent-text)' : 'var(--color-text-secondary)',
              background: activeTab === 'password' ? 'var(--color-accent-glow)' : 'transparent',
            }}
          >
            Password
          </button>
        )}
        <button type="button"
          onClick={() => setActiveTab('security')}
          className="
            px-3 sm:px-4 py-2
            text-sm font-medium
            rounded-lg
            transition-colors duration-200
            touch-press-light
          "
          style={{
            fontFamily: 'var(--font-body)',
            color: activeTab === 'security' ? 'var(--color-accent-text)' : 'var(--color-text-secondary)',
            background: activeTab === 'security' ? 'var(--color-accent-glow)' : 'transparent',
          }}
        >
          Security
        </button>
        <button type="button"
          onClick={() => setActiveTab('editor')}
          className="
            px-3 sm:px-4 py-2
            text-sm font-medium
            rounded-lg
            transition-colors duration-200
            touch-press-light
          "
          style={{
            fontFamily: 'var(--font-body)',
            color: activeTab === 'editor' ? 'var(--color-accent-text)' : 'var(--color-text-secondary)',
            background: activeTab === 'editor' ? 'var(--color-accent-glow)' : 'transparent',
          }}
        >
          Editor
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
                  readOnly
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
                    border: '1px solid var(--color-input-border)',
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
                  Display name
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
                    border: '1px solid var(--color-input-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-input-border)';
                  }}
                />
              </div>

              {/* Theme Toggle */}
              <div className="mb-6">
                <span
                  className="block text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Theme
                </span>
                <button
                  type="button"
                  onClick={onThemeToggle}
                  aria-label={theme === 'light' ? 'Theme: Light. Switch to Dark' : 'Theme: Dark. Switch to Light'}
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
                      <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    ) : (
                      <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    )}
                    {theme === 'light' ? 'Light' : 'Dark'}
                  </span>
                </button>
              </div>

              {/* Message */}
              {profileMessage && (
                <p
                  className="mb-4 text-sm text-center"
                  style={{
                    color: profileMessage.type === 'success' ? 'var(--color-accent-text)' : 'var(--color-destructive)',
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
                {profileLoading ? 'Saving...' : 'Save profile'}
              </button>

              {ACCOUNT_OFFBOARDING_ENABLED && (
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
              )}
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

              {/* Current password */}
              <div className="mb-5">
                <label
                  htmlFor="settings-current-password"
                  className="block text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Current password
                </label>
                <PasswordInput
                  id="settings-current-password"
                  revealLabel="password"
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
                    border: '1px solid var(--color-input-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-input-border)';
                  }}
                />
              </div>

              {/* New password */}
              <div className="mb-5">
                <label
                  htmlFor="settings-new-password"
                  className="block text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  New password
                </label>
                <PasswordInput
                  id="settings-new-password"
                  revealLabel="password"
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
                    border: '1px solid var(--color-input-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-input-border)';
                  }}
                />
              </div>

              {/* Confirm password */}
              <div className="mb-6">
                <label
                  htmlFor="settings-confirm-password"
                  className="block text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Confirm new password
                </label>
                <PasswordInput
                  id="settings-confirm-password"
                  revealLabel="password"
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
                    border: '1px solid var(--color-input-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-input-border)';
                  }}
                />
              </div>

              {/* Message */}
              {passwordMessage && (
                <p
                  className="mb-4 text-sm text-center"
                  style={{
                    color: passwordMessage.type === 'success' ? 'var(--color-accent-text)' : 'var(--color-destructive)',
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
                {passwordLoading ? 'Updating...' : 'Update password'}
              </button>
            </form>
          )}

          {/* Editor Tab */}
          {activeTab === 'editor' && <EditorSettings />}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div style={{ fontFamily: 'var(--font-body)' }}>
              <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
                Choose how long your notes stay open on this device.
              </p>

              {/* On this device (J1, J2, J4) */}
              <div className="mb-6 pb-5" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <h3 id="settings-on-this-device" className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  On this device
                </h3>

                {vaultSettings && (
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {isVaultUnlocked ? 'Your notes are unlocked on this device' : 'Your notes are locked'}
                      </span>
                      {isVaultUnlocked && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                          {vaultSettings.settings.rememberBrowser
                            ? 'They stay unlocked after you close the browser. Lock now or sign out to end that.'
                            : 'They lock when you close this tab.'}
                        </p>
                      )}
                    </div>
                    {isVaultUnlocked && onLockVault && (
                      <button
                        type="button"
                        onClick={onLockVault}
                        className="shrink-0 min-h-11 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 focus-ring"
                        style={{
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
                        Lock now
                      </button>
                    )}
                  </div>
                )}

                {vaultSettings && (
                  <div role="radiogroup" aria-labelledby="settings-on-this-device" className="flex flex-col gap-2">
                    {presetOptions.map((option) => {
                      const selected = option.id === currentPreset;
                      return (
                        <label
                          key={option.id}
                          className="flex items-start gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors duration-200"
                          style={{
                            background: selected ? 'var(--color-accent-glow)' : 'transparent',
                            border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--glass-border)'}`,
                          }}
                        >
                          <input
                            type="radio"
                            name="security-preset"
                            value={option.id}
                            checked={selected}
                            onChange={() => {
                              if (option.id !== 'custom') handlePresetChange(option.id);
                            }}
                            className="mt-1 shrink-0 focus-ring"
                            style={{ accentColor: 'var(--color-accent)' }}
                          />
                          <span>
                            <span className="block text-sm" style={{ color: selected ? 'var(--color-accent-text)' : 'var(--color-text-primary)' }}>
                              {option.label}
                            </span>
                            <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                              {option.description}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {securityMessage && (
                  <p className="mt-2 text-xs" role="alert" style={{ color: 'var(--color-destructive)' }}>
                    {securityMessage.text}
                  </p>
                )}

                <details className="mt-4">
                  <summary className="text-sm cursor-pointer focus-ring" style={{ color: 'var(--color-text-secondary)' }}>
                    Details
                  </summary>

                  <div className="mt-3">
                    {vaultSettings && (
                      <>
                        {/* Vault auto-lock */}
                        <div className="mb-4">
                          <label htmlFor="vault-auto-lock" className="block text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                            Lock after idle
                          </label>
                          <select
                            id="vault-auto-lock"
                            value={String(vaultSettings.settings.autoLockMinutes)}
                            onChange={(e) => {
                              const parsed = parseInt(e.target.value, 10);
                              if (parsed === 0 || parsed === 15 || parsed === 60) {
                                setSecurityMessage(null);
                                if (!vaultSettings.setAutoLockMinutes(parsed)) {
                                  setSecurityMessage({ text: 'This applies now, but could not be saved and may not last after you reload. Check available storage or browser privacy settings.' });
                                }
                              }
                            }}
                            className="w-full px-4 py-2 rounded-lg outline-none transition-all duration-200 cursor-pointer"
                            style={selectStyle}
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = 'var(--color-accent)';
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = 'var(--glass-border)';
                            }}
                          >
                            <option value="0">Off</option>
                            <option value="15">15 minutes</option>
                            <option value="60">1 hour</option>
                          </select>
                          <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                            {vaultSettings.settings.rememberBrowser
                              ? 'Locks your notes when idle. This browser is remembered, so they open again without your passphrase.'
                              : 'Locks your notes when idle. You’ll need your passphrase to open them again.'}
                          </p>
                        </div>

                        {/* Remember this browser */}
                        <div className="mb-4">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between text-left cursor-pointer focus-ring"
                            role="switch"
                            aria-checked={vaultSettings.settings.rememberBrowser}
                            aria-label="Remember this browser"
                            onClick={handleRememberBrowserToggle}
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            <div>
                              <span className="block text-sm">Remember this browser</span>
                              <span className="block text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                                Stay unlocked after you close the browser. Only on a device no one else uses.
                              </span>
                            </div>
                            <span
                              className="relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer shrink-0 ml-4"
                              style={{
                                background: vaultSettings.settings.rememberBrowser
                                  ? 'var(--color-accent)'
                                  : 'var(--color-bg-tertiary)',
                              }}
                              aria-hidden="true"
                            >
                              <span
                                className="absolute top-0.5 size-5 rounded-full shadow-[var(--shadow-sm)] transition-transform duration-200"
                                style={{
                                  background: 'var(--color-text-primary)',
                                  transform: vaultSettings.settings.rememberBrowser
                                    ? 'translateX(26px)'
                                    : 'translateX(2px)',
                                }}
                              />
                            </span>
                          </button>
                        </div>
                      </>
                    )}

                    {/* Session timeout */}
                    <div>
                      <label htmlFor="session-timeout" className="block text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Sign out after idle
                      </label>
                      <select
                        id="session-timeout"
                        value={sessionSettings.settings.timeoutMinutes === null ? 'null' : String(sessionSettings.settings.timeoutMinutes)}
                        onChange={(e) => {
                          const value = e.target.value === 'null' ? null : parseInt(e.target.value, 10);
                          setSecurityMessage(null);
                          if (!sessionSettings.setTimeoutMinutes(value)) {
                            setSecurityMessage({
                              text: value === null
                                ? 'Could not save this choice, so it was not changed. Check available storage or browser privacy settings and try again.'
                                : 'This applies now, but could not be saved and may not last after you reload. Check available storage or browser privacy settings.',
                            });
                          }
                        }}
                        className="w-full px-4 py-2 rounded-lg outline-none transition-all duration-200 cursor-pointer"
                        style={selectStyle}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-accent)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--glass-border)';
                        }}
                      >
                        {TIMEOUT_OPTIONS.map((option) => (
                          <option key={option.value === null ? 'null' : option.value} value={option.value === null ? 'null' : option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                        {neverEndsOn
                          ? `Never ends on ${neverEndsOn}. After that you’re signed out after 1 week idle.`
                          : 'Never lasts 90 days, then goes back to 1 week.'}
                      </p>
                    </div>
                  </div>
                </details>
              </div>

              {/* Recovery key (item 26) */}
              {vaultSettings && (
                <div>
                  <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>
                    Recovery key
                  </h3>

                  {isVaultUnlocked && (
                    <div ref={recoveryKeyRowRef}>
                      <RecoveryKeySettings />
                    </div>
                  )}

                  {/* Change passphrase (I2). No in-app flow yet: roadmap 136. */}
                  <div className="mt-4">
                    <span className="block text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      Change passphrase
                    </span>
                    <p className="block text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                      {hasRecoveryKey
                        ? 'To change your passphrase, lock your notes and choose ‘Use your recovery key’ on the unlock screen. You’ll need your recovery key.'
                        : 'Make a recovery key first. You’ll need it to change your passphrase.'}
                    </p>
                    {/* The Recovery key row only renders while the vault is unlocked. */}
                    {!hasRecoveryKey && isVaultUnlocked && (
                      <button
                        type="button"
                        onClick={goToRecoveryKey}
                        className="mt-1 text-xs underline cursor-pointer focus-ring"
                        style={{ color: 'var(--color-accent-text)' }}
                      >
                        Go to Recovery key
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
    </BottomSheet>
  );
}
