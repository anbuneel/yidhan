import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { Theme } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeToggle: () => void;
}

type SettingsTab = 'profile' | 'password';

export function SettingsModal({ isOpen, onClose, theme, onThemeToggle }: SettingsModalProps) {
  const { user, updateProfile, updatePassword } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Profile state
  const [fullName, setFullName] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password state
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
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, user]);

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

    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setPasswordLoading(true);

    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        setPasswordMessage({ type: 'error', text: error.message });
      } else {
        setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
        setNewPassword('');
        setConfirmPassword('');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="
          w-[480px]
          max-h-[90vh]
          overflow-y-auto
          shadow-2xl
          animate-[modal-enter_300ms_ease-out]
        "
        style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--glass-border)',
          scrollbarWidth: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-8 py-6 border-b"
          style={{ borderColor: 'var(--glass-border)' }}
        >
          <div className="flex items-center justify-between">
            <h2
              className="text-2xl font-semibold"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              Settings
            </h2>
            <button
              onClick={onClose}
              className="
                w-8 h-8
                flex items-center justify-center
                rounded-full
                transition-colors duration-200
              "
              style={{ color: 'var(--color-text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            <button
              onClick={() => setActiveTab('profile')}
              className="
                px-4 py-2
                text-sm font-medium
                rounded-lg
                transition-colors duration-200
              "
              style={{
                fontFamily: 'var(--font-body)',
                color: activeTab === 'profile' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                background: activeTab === 'profile' ? 'var(--color-accent-glow)' : 'transparent',
              }}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className="
                px-4 py-2
                text-sm font-medium
                rounded-lg
                transition-colors duration-200
              "
              style={{
                fontFamily: 'var(--font-body)',
                color: activeTab === 'password' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                background: activeTab === 'password' ? 'var(--color-accent-glow)' : 'transparent',
              }}
            >
              Password
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit}>
              {/* Email (read-only) */}
              <div className="mb-5">
                <label
                  className="block text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Email
                </label>
                <input
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
                  className="block text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Display Name
                </label>
                <input
                  type="text"
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
                  background: 'var(--color-accent)',
                  color: '#fff',
                }}
                onMouseEnter={(e) => {
                  if (!profileLoading) {
                    e.currentTarget.style.background = 'var(--color-accent-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent)';
                }}
              >
                {profileLoading ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit}>
              <p
                className="text-sm mb-5"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Enter a new password to update your account security.
              </p>

              {/* New Password */}
              <div className="mb-5">
                <label
                  className="block text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  New Password
                </label>
                <input
                  type="password"
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
                  className="block text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Confirm New Password
                </label>
                <input
                  type="password"
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
                  background: 'var(--color-accent)',
                  color: '#fff',
                }}
                onMouseEnter={(e) => {
                  if (!passwordLoading) {
                    e.currentTarget.style.background = 'var(--color-accent-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent)';
                }}
              >
                {passwordLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
