import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppModals, type AppModalsProps } from './AppModals';

// Settings stands in as a plain dialog: these tests are about which modal is on top.
vi.mock('./SettingsModal', () => ({
  SettingsModal: () => (
    <dialog open aria-labelledby="settings-stub-title">
      <h2 id="settings-stub-title">Settings</h2>
    </dialog>
  ),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ cancelOffboarding: vi.fn(), signOut: vi.fn() }),
}));

type LibraryProps = Extract<AppModalsProps, { scope: 'library' }>;

function libraryProps(overrides: Partial<LibraryProps> = {}): LibraryProps {
  return {
    scope: 'library',
    tags: [],
    showTagModal: false,
    editingTag: null,
    onCloseTagModal: vi.fn(),
    onSaveTag: vi.fn(),
    onDeleteTag: vi.fn(),
    keys: null,
    activeConflict: null,
    onConflictResolve: vi.fn(),
    onConflictDismiss: vi.fn(),
    theme: 'dark',
    onThemeToggle: vi.fn(),
    notes: [],
    showSettingsModal: false,
    onCloseSettings: vi.fn(),
    onLetGoClick: vi.fn(),
    sessionSettings: {} as LibraryProps['sessionSettings'],
    vaultSettings: {} as LibraryProps['vaultSettings'],
    isVaultUnlocked: true,
    onLockVault: vi.fn(),
    onPersistToLocal: vi.fn(),
    showLettingGoModal: false,
    onCloseLettingGo: vi.fn(),
    showWelcomeBack: false,
    daysUntilRelease: null,
    onDismissWelcomeBack: vi.fn(),
    importProgress: null,
    backupRestore: { pendingFile: null, error: null, isBusy: false, onSubmit: vi.fn(), onCancel: vi.fn() },
    shouldShowInstallPrompt: false,
    onInstall: vi.fn(),
    onDismissInstall: vi.fn(),
    shouldShowIOSGuide: false,
    onDismissIOSGuide: vi.fn(),
    showSessionTimeoutModal: false,
    onSessionStay: vi.fn(),
    onSessionSignOut: vi.fn(),
    sessionMinutesRemaining: null,
    showShortcutsModal: false,
    onCloseShortcuts: vi.fn(),
    ...overrides,
  };
}

const pendingBackup = (file = new File(['{}'], 'notes.yidhan')) => ({
  pendingFile: file,
  error: null,
  isBusy: false,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
});

/** A dialog by the id of its title, so the test does not depend on the wording. */
const dialog = (titleId: string) => document.querySelector(`dialog[aria-labelledby="${titleId}"]`);
const findDialog = (titleId: string) => waitFor(() => {
  const found = dialog(titleId);
  expect(found).not.toBeNull();
  return found as Element;
});
const isAfter = (later: Element, earlier: Element) =>
  Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);

// WelcomeBackPrompt, InstallPrompt and BackupPassphraseModal are lazy chunks (shell-size
// plan A3). They must still open, stack where they did, and open after a remount.
describe('AppModals: the lazy rare modals', () => {
  it('renders none of them while none is asked for', async () => {
    render(<AppModals {...libraryProps()} />);
    // Let any lazy chunk that was wrongly requested arrive.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dialog('backup-passphrase-title')).toBeNull();
    expect(dialog('welcome-back-title')).toBeNull();
    expect(dialog('install-prompt-title')).toBeNull();
  });

  it('opens the backup passphrase modal, and again after a remount', async () => {
    const first = render(<AppModals {...libraryProps({ backupRestore: pendingBackup() })} />);
    await findDialog('backup-passphrase-title');
    first.unmount();
    expect(dialog('backup-passphrase-title')).toBeNull();

    render(<AppModals {...libraryProps({ backupRestore: pendingBackup() })} />);
    await findDialog('backup-passphrase-title');
  });

  it('closes the backup modal when the file is no longer pending', async () => {
    const view = render(<AppModals {...libraryProps({ backupRestore: pendingBackup() })} />);
    await findDialog('backup-passphrase-title');
    view.rerender(<AppModals {...libraryProps()} />);
    expect(dialog('backup-passphrase-title')).toBeNull();
  });

  it('puts the backup modal in front of an open Settings dialog', async () => {
    render(<AppModals {...libraryProps({ showSettingsModal: true, backupRestore: pendingBackup() })} />);
    const settings = await findDialog('settings-stub-title');
    const backup = await findDialog('backup-passphrase-title');
    expect(isAfter(backup, settings)).toBe(true);
  });

  it('keeps the session timeout warning in front of the backup modal', async () => {
    render(
      <AppModals
        {...libraryProps({
          backupRestore: pendingBackup(),
          showSessionTimeoutModal: true,
          sessionMinutesRemaining: 2,
        })}
      />
    );
    // Eager: it is there before any lazy chunk arrives.
    const timeout = dialog('session-timeout-title');
    expect(timeout).not.toBeNull();
    const backup = await findDialog('backup-passphrase-title');
    expect(isAfter(timeout as Element, backup)).toBe(true);
  });

  it('opens the welcome-back prompt and the install prompt', async () => {
    render(
      <AppModals
        {...libraryProps({ showWelcomeBack: true, daysUntilRelease: 12, shouldShowInstallPrompt: true })}
      />
    );
    await findDialog('welcome-back-title');
    await findDialog('install-prompt-title');
  });

  it('keeps the import progress overlay eager: it shows at once, with no chunk to wait on', () => {
    render(<AppModals {...libraryProps({ importProgress: { current: 1, total: 4, phase: 'importing' } })} />);
    expect(screen.getByText(/1.*4/)).toBeInTheDocument();
  });
});
