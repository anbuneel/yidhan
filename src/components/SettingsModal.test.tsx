import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { UseSessionSettingsResult } from '../hooks/useSessionSettings';
import type { UseVaultSettingsResult } from '../hooks/useVaultSettings';

// Tests for the Security tab. The recovery key status comes from the
// account's vault metadata; the parsers are mocked so each case sets it directly.
const mockUser: { user_metadata: Record<string, unknown>; app_metadata: Record<string, unknown>; email: string } = {
  user_metadata: { vault: {} },
  app_metadata: { provider: 'email' },
  email: 'writer@example.test',
};
let recoveryStatus: 'valid' | 'absent' = 'absent';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    updateProfile: vi.fn(),
    updatePassword: vi.fn(),
    verifyPassword: vi.fn(),
  }),
}));
vi.mock('../lib/vaultMetadata', () => ({
  readVaultMetadata: () => ({ status: 'valid' }),
  readRecoveryWrap: () => ({ status: recoveryStatus }),
}));
vi.mock('./RecoveryKeySettings', () => ({
  RecoveryKeySettings: () => <button type="button">Make a recovery key</button>,
}));

import { SettingsModal } from './SettingsModal';

type VaultState = UseVaultSettingsResult['settings'];
let sessionSettings: UseSessionSettingsResult;
let vaultSettings: UseVaultSettingsResult;
let onPersistToLocal: () => boolean;
let onLockVault: () => void;

function makeSettings(vault: VaultState, timeoutMinutes: number | null, neverSince: string | null = null) {
  sessionSettings = {
    settings: { timeoutMinutes, neverSince },
    setTimeoutMinutes: vi.fn(() => true),
    getEffectiveTimeout: () => timeoutMinutes,
  };
  vaultSettings = {
    settings: vault,
    setAutoLockMinutes: vi.fn(() => true),
    setRememberBrowser: vi.fn(() => true),
  };
}

function openSecurityTab({ unlocked = true } = {}) {
  render(
    <SettingsModal
      isOpen
      onClose={vi.fn()}
      theme="dark"
      onThemeToggle={vi.fn()}
      onLetGoClick={vi.fn()}
      sessionSettings={sessionSettings}
      vaultSettings={vaultSettings}
      isVaultUnlocked={unlocked}
      onLockVault={onLockVault}
      onPersistToLocal={onPersistToLocal}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Security' }));
}

const radio = (label: string) => screen.getByRole('radio', { name: new RegExp('^' + label) });

describe('SettingsModal theme row', () => {
  beforeEach(() => makeSettings({ autoLockMinutes: 60, rememberBrowser: false }, 10080));

  it.each([['dark', 'Dark'], ['light', 'Light']] as const)('names the current theme (%s) and drops "Click to switch"', (theme, name) => {
    render(
      <SettingsModal
        isOpen
        onClose={vi.fn()}
        theme={theme}
        onThemeToggle={vi.fn()}
        onLetGoClick={vi.fn()}
        sessionSettings={sessionSettings}
      />,
    );

    expect(screen.queryByText('Click to switch')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp('^Theme: ' + name) })).toHaveTextContent(name);
  });
});

describe('SettingsModal Security tab', () => {
  beforeEach(() => {
    recoveryStatus = 'absent';
    onPersistToLocal = vi.fn(() => true);
    onLockVault = vi.fn();
    // My device
    makeSettings({ autoLockMinutes: 60, rememberBrowser: false }, 10080);
  });

  it('has the J4 headings and no trusted-device switch', () => {
    openSecurityTab();

    expect(screen.getByRole('heading', { name: 'On this device' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recovery key' })).toBeInTheDocument();
    expect(screen.queryByText('Session & trust')).not.toBeInTheDocument();
    expect(screen.queryByText(/trusted device/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/14 days/)).not.toBeInTheDocument();
  });

  it.each([
    [true, 'Your notes are unlocked on this device'],
    [false, 'Your notes are locked'],
  ])('shows the status in the secondary colour, never green (unlocked: %s)', (unlocked, text) => {
    openSecurityTab({ unlocked });

    expect(screen.getByText(text)).toHaveStyle({ color: 'var(--color-text-secondary)' });
  });

  it('locks with "Lock now"', () => {
    openSecurityTab();
    fireEvent.click(screen.getByRole('button', { name: 'Lock now' }));
    expect(onLockVault).toHaveBeenCalledTimes(1);
  });

  it('shows no "Lock now" while locked', () => {
    openSecurityTab({ unlocked: false });
    expect(screen.queryByRole('button', { name: 'Lock now' })).not.toBeInTheDocument();
  });

  it.each([
    [{ autoLockMinutes: 15, rememberBrowser: false }, 60, 'Shared device'],
    [{ autoLockMinutes: 60, rememberBrowser: false }, 10080, 'My device'],
    [{ autoLockMinutes: 0, rememberBrowser: true }, 10080, 'Stay unlocked'],
  ] as const)('selects the preset the stored settings match: %o, %s -> %s', (vault, timeout, label) => {
    makeSettings({ ...vault }, timeout);
    openSecurityTab();

    expect(radio(label)).toBeChecked();
    expect(screen.queryByRole('radio', { name: /^Custom/ })).not.toBeInTheDocument();
  });

  it('shows Custom, selected, when the stored settings match no preset', () => {
    // The old defaults: auto-lock off, not remembered, 1 week.
    makeSettings({ autoLockMinutes: 0, rememberBrowser: false }, 10080);
    openSecurityTab();

    expect(radio('Custom')).toBeChecked();
    for (const label of ['Shared device', 'My device', 'Stay unlocked']) {
      expect(radio(label)).not.toBeChecked();
    }
  });

  it('does not change any setting just by opening the tab, Custom included', () => {
    makeSettings({ autoLockMinutes: 0, rememberBrowser: false }, 30);
    openSecurityTab();

    expect(vaultSettings.setAutoLockMinutes).not.toHaveBeenCalled();
    expect(vaultSettings.setRememberBrowser).not.toHaveBeenCalled();
    expect(sessionSettings.setTimeoutMinutes).not.toHaveBeenCalled();
  });

  it('applies "Shared device" when picked', () => {
    openSecurityTab();
    fireEvent.click(radio('Shared device'));

    expect(vaultSettings.setRememberBrowser).toHaveBeenCalledWith(false, { persistKeys: undefined });
    expect(vaultSettings.setAutoLockMinutes).toHaveBeenCalledWith(15);
    expect(sessionSettings.setTimeoutMinutes).toHaveBeenCalledWith(60);
  });

  it('persists the unlocked keys when "Stay unlocked" is picked while unlocked', () => {
    openSecurityTab();
    fireEvent.click(radio('Stay unlocked'));

    expect(vaultSettings.setRememberBrowser).toHaveBeenCalledWith(true, { persistKeys: onPersistToLocal });
    expect(vaultSettings.setAutoLockMinutes).toHaveBeenCalledWith(0);
    expect(sessionSettings.setTimeoutMinutes).toHaveBeenCalledWith(10080);
  });

  it('does not pass key persistence while locked', () => {
    openSecurityTab({ unlocked: false });
    fireEvent.click(radio('Stay unlocked'));

    expect(vaultSettings.setRememberBrowser).toHaveBeenCalledWith(true, { persistKeys: undefined });
  });

  it('changes nothing else and says so when this browser cannot be remembered', () => {
    vaultSettings.setRememberBrowser = vi.fn(() => false);
    openSecurityTab();
    fireEvent.click(radio('Stay unlocked'));

    expect(vaultSettings.setAutoLockMinutes).not.toHaveBeenCalled();
    expect(sessionSettings.setTimeoutMinutes).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not remember this browser, so the other settings were not changed.');
  });

  it('keeps the individual controls behind Details', () => {
    openSecurityTab();

    const details = screen.getByText('Details').closest('details');
    expect(details).not.toHaveAttribute('open');
    expect(details).toContainElement(screen.getByLabelText('Lock after idle'));
    expect(details).toContainElement(screen.getByRole('switch', { name: 'Remember this browser', hidden: true }));
    expect(details).toContainElement(screen.getByLabelText('Sign out after idle'));
  });

  it('offers Never to everyone, and shows when a chosen Never ends', () => {
    makeSettings({ autoLockMinutes: 60, rememberBrowser: false }, null, '2026-11-01T00:00:00.000Z');
    openSecurityTab();

    expect(screen.getByRole('option', { name: 'Never (for 90 days)', hidden: true })).toBeInTheDocument();
    expect(screen.getByText(/^Never ends on /)).toBeInTheDocument();
  });

  it('says when the timeout could not be saved', () => {
    sessionSettings.setTimeoutMinutes = vi.fn(() => false);
    openSecurityTab();
    fireEvent.change(screen.getByLabelText('Sign out after idle'), { target: { value: 'null' } });

    expect(sessionSettings.setTimeoutMinutes).toHaveBeenCalledWith(null);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save this choice, so it was not changed.');
  });

  it.each([true, false])('tells an account with a recovery key how to change the passphrase (unlocked: %s)', (unlocked) => {
    recoveryStatus = 'valid';
    openSecurityTab({ unlocked });

    expect(screen.getByText('Change passphrase')).toBeInTheDocument();
    expect(screen.getByText(/lock your notes and choose ‘Use your recovery key’ on the unlock screen/)).toBeInTheDocument();
    // The no-key text and its button never show when a key exists.
    expect(screen.queryByText(/Make a recovery key first/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to Recovery key' })).not.toBeInTheDocument();
  });

  it('tells an account without a recovery key to make one first', () => {
    openSecurityTab();

    expect(screen.getByText('Make a recovery key first. You’ll need it to change your passphrase.')).toBeInTheDocument();
    expect(screen.queryByText(/lock your notes and choose/)).not.toBeInTheDocument();
  });

  it('moves focus to the Recovery key row from the Change passphrase row', () => {
    const original = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      openSecurityTab();

      fireEvent.click(screen.getByRole('button', { name: 'Go to Recovery key' }));

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Make a recovery key' })).toHaveFocus();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('shows no Go to Recovery key button while the notes are locked', () => {
    // The Recovery key row is not rendered while locked, so there is nowhere to go.
    openSecurityTab({ unlocked: false });

    expect(screen.getByText(/Make a recovery key first/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to Recovery key' })).not.toBeInTheDocument();
  });
});
