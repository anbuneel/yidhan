import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor as TiptapEditor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Auth } from './Auth';
import { BackupPassphraseModal } from './BackupPassphraseModal';
import { ConflictModal } from './ConflictModal';
import { EncryptedConflictModal } from './EncryptedConflictModal';
import { FadedNotesView } from './FadedNotesView';
import { FindReplacePanel } from './FindReplacePanel';
import { ImportProgressOverlay } from './ImportProgressOverlay';
import { InstallPrompt } from './InstallPrompt';
import { IOSInstallGuide } from './IOSInstallGuide';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { LettingGoModal } from './LettingGoModal';
import { LinkPopover } from './LinkPopover';
import { ReAuthModal } from './ReAuthModal';
import { SessionTimeoutModal } from './SessionTimeoutModal';
import { ShareModal } from './ShareModal';
import { TagModal } from './TagModal';
import { TagSelector } from './TagSelector';
import { WelcomeBackPrompt } from './WelcomeBackPrompt';
import { InvitationModal } from './demo/InvitationModal';
import { EditorToolbar } from './EditorToolbar';
import { createMockNote, createMockTag } from '../test/factories';
import type { ConflictInfo } from '../services/syncEngine';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'reader@example.com',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Reader' },
    },
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null }),
    signInWithGoogle: vi.fn().mockResolvedValue({ error: null }),
    signInWithGitHub: vi.fn().mockResolvedValue({ error: null }),
    resetPassword: vi.fn().mockResolvedValue({ error: null }),
    updatePassword: vi.fn().mockResolvedValue({ error: null }),
    verifyPassword: vi.fn().mockResolvedValue({ success: true }),
    confirmAccountDeletion: vi.fn().mockResolvedValue({ success: true, confirmationToken: 'tok' }),
    startAccountDeletionOtp: vi.fn().mockResolvedValue({ success: true }),
    confirmAccountDeletionOtp: vi.fn().mockResolvedValue({ success: true, confirmationToken: 'tok' }),
    initiateOffboarding: vi.fn().mockResolvedValue({ error: null }),
    cancelOffboarding: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue(undefined),
    isRecentlyReauthed: vi.fn().mockReturnValue(false),
  }),
}));

vi.mock('../services/notes', () => ({
  getNoteShare: vi.fn().mockResolvedValue(null),
  createNoteShare: vi.fn(),
  updateNoteShareExpiration: vi.fn(),
  revokeNoteShare: vi.fn(),
  fetchAllNoteShares: vi.fn().mockResolvedValue([]),
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

const tab = (shiftKey = false) => fireEvent.keyDown(document, { key: 'Tab', shiftKey });

function createNoteConflict(): ConflictInfo {
  return {
    entityType: 'note',
    entityId: 'note-1',
    localVersion: {
      id: 'note-1',
      userId: 'user-1',
      title: 'Local',
      content: '<p>Local copy</p>',
      pinned: false,
      deletedAt: null,
      createdAt: Date.now() - 2000,
      updatedAt: Date.now() - 1000,
      syncStatus: 'conflict',
      lastSyncedAt: null,
      serverUpdatedAt: null,
      localUpdatedAt: Date.now() - 1000,
      encryptedPayload: null,
      encryptionIv: null,
      encryptionVersion: null,
      contentHash: null,
    },
    serverVersion: {
      id: 'note-1',
      title: 'Remote',
      content: '<p>Remote copy</p>',
      pinned: false,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      encrypted_payload: null,
      encryption_iv: null,
      encryption_version: null,
      content_hash: null,
    },
  };
}

function getFocusableIn(dialog: HTMLElement): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.closest('[inert], [hidden]'));
}

/**
 * Shared assertion for every dismissible modal kind:
 * - moves focus inside on open
 * - marks background page controls inert
 * - holds Tab and Shift+Tab inside the dialog
 * - Escape closes the dialog, clears inert, and returns focus to the opener
 */
async function expectModalContainment(
  renderModal: (open: boolean, close: () => void) => React.ReactNode
) {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <main>
          <button type="button" onClick={() => setOpen(true)}>Open trigger</button>
          <button type="button">Background button</button>
        </main>
        {renderModal(open, () => setOpen(false))}
      </>
    );
  }

  render(<Harness />);
  const opener = screen.getByRole('button', { name: 'Open trigger' });
  const background = screen.getByRole('button', { name: 'Background button' });
  opener.focus();
  fireEvent.click(opener);

  const dialog = await screen.findByRole('dialog');
  await waitFor(() => {
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  // Background is inert while dialog is open.
  expect(background.closest('[inert]')).not.toBeNull();

  // Tab wraps from last to first and Shift+Tab from first to last.
  const focusable = getFocusableIn(dialog);
  expect(focusable.length).toBeGreaterThan(0);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  last.focus();
  tab(false);
  expect(document.activeElement).toBe(first);

  first.focus();
  tab(true);
  expect(document.activeElement).toBe(last);

  // Escape closes and returns focus to opener, clearing inert.
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  expect(background.closest('[inert]')).toBeNull();
  expect(document.activeElement).toBe(opener);
}

describe('Non-modal surfaces must NOT trap focus or mark background inert (should not fire)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TagSelector dropdown lets Tab leave into the next page control and never marks background inert', async () => {
    const user = userEvent.setup({ delay: null });
    const tags = [createMockTag({ id: 't1', name: 'Work' })];
    render(
      <>
        <button type="button">Before surface</button>
        <TagSelector tags={tags} selectedTagIds={[]} onToggleTag={vi.fn()} />
        <button type="button">After surface</button>
      </>
    );

    const before = screen.getByRole('button', { name: 'Before surface' });
    const after = screen.getByRole('button', { name: 'After surface' });
    await user.click(screen.getByRole('button', { name: /add tags/i }));
    expect(screen.getByTestId('tag-selector-menu')).toBeInTheDocument();

    expect(before.closest('[inert]')).toBeNull();
    expect(before.closest('[aria-hidden="true"]')).toBeNull();
    expect(after.closest('[inert]')).toBeNull();

    // Real Tab from the last control inside the dropdown leaves into the next page button.
    const tagBtn = screen.getByRole('button', { name: 'Work' });
    tagBtn.focus();
    await user.tab();
    expect(after).toHaveFocus();
  });

  it('LinkPopover lets Tab leave into the next page control and never marks background inert', async () => {
    const user = userEvent.setup({ delay: null });
    const editor = new TiptapEditor({
      extensions: [StarterKit.configure({ link: { openOnClick: false } })],
      content: '<p>Hello world</p>',
    });
    try {
      render(
        <>
          <button type="button">Before surface</button>
          <LinkPopover editor={editor} onClose={vi.fn()} />
          <button type="button">After surface</button>
        </>
      );

      const before = screen.getByRole('button', { name: 'Before surface' });
      const after = screen.getByRole('button', { name: 'After surface' });
      expect(before.closest('[inert]')).toBeNull();
      expect(after.closest('[inert]')).toBeNull();

      const saveBtn = screen.getByRole('button', { name: 'Save link' });
      saveBtn.focus();
      await user.tab();
      expect(after).toHaveFocus();
    } finally {
      editor.destroy();
    }
  });

  it('EditorToolbar lets Tab leave into the next page control and never marks background inert', async () => {
    const user = userEvent.setup({ delay: null });
    const editor = new TiptapEditor({
      extensions: [StarterKit],
      content: '<p>Hello world</p>',
    });
    try {
      render(
        <>
          <button type="button">Before surface</button>
          <EditorToolbar editor={editor} variant="inline" />
          <button type="button">After surface</button>
        </>
      );

      const before = screen.getByRole('button', { name: 'Before surface' });
      const after = screen.getByRole('button', { name: 'After surface' });
      expect(before.closest('[inert]')).toBeNull();
      expect(after.closest('[inert]')).toBeNull();

      const toolbar = screen.getByRole('toolbar');
      const toolbarButtons = toolbar.querySelectorAll<HTMLElement>('button:not([disabled])');
      toolbarButtons[toolbarButtons.length - 1].focus();
      await user.tab();
      expect(after).toHaveFocus();
    } finally {
      editor.destroy();
    }
  });

  it('InstallPrompt floating banner lets Tab leave into the next page control and never marks background inert', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <>
        <button type="button">Before surface</button>
        <InstallPrompt onInstall={vi.fn().mockResolvedValue(true)} onDismiss={vi.fn()} />
        <button type="button">After surface</button>
      </>
    );

    const before = screen.getByRole('button', { name: 'Before surface' });
    const after = screen.getByRole('button', { name: 'After surface' });
    expect(before.closest('[inert]')).toBeNull();
    expect(after.closest('[inert]')).toBeNull();

    const installBtn = screen.getByRole('button', { name: /install/i });
    installBtn.focus();
    await user.tab();
    expect(after).toHaveFocus();
  });

  it('Toasts (role="status") let Tab leave into the next page control and never mark background inert', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <>
        <button type="button">Before surface</button>
        <div role="status">
          <span>Note restored</span>
          <button type="button">Undo</button>
        </div>
        <button type="button">After surface</button>
      </>
    );

    const before = screen.getByRole('button', { name: 'Before surface' });
    const after = screen.getByRole('button', { name: 'After surface' });
    expect(before.closest('[inert]')).toBeNull();
    expect(after.closest('[inert]')).toBeNull();

    const undoBtn = screen.getByRole('button', { name: 'Undo' });
    undoBtn.focus();
    await user.tab();
    expect(after).toHaveFocus();
  });

  it('Auth in full-page mode (isModal=false) lets Tab leave into external controls and never marks siblings inert', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <>
        <Auth theme="light" onThemeToggle={vi.fn()} isModal={false} />
        <button type="button">External control</button>
      </>
    );

    const external = screen.getByRole('button', { name: 'External control' });
    expect(external.closest('[inert]')).toBeNull();

    // Tab from the last button inside Auth moves out to the external sibling button.
    const allButtons = screen.getAllByRole('button');
    const lastAuthButton = allButtons[allButtons.length - 2];
    lastAuthButton.focus();
    await user.tab();
    expect(external).toHaveFocus();
  });
});

describe('Modal focus containment across every modal kind (B2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Auth modal holds focus, makes background inert, and returns focus on Escape', async () => {
    await expectModalContainment((open, close) =>
      open ? <Auth theme="light" onThemeToggle={vi.fn()} isModal onClose={close} /> : null
    );
  });

  it('InvitationModal holds focus, uses --radius-pill CTA, and returns focus on Escape', async () => {
    await expectModalContainment((open, close) =>
      open ? <InvitationModal noteCount={3} onSignUp={vi.fn()} onDismiss={close} /> : null
    );

    render(<InvitationModal noteCount={3} onSignUp={vi.fn()} onDismiss={vi.fn()} />);
    const cta = screen.getByRole('button', { name: 'Create an account' });
    expect(cta.className).toContain('rounded-[var(--radius-pill)]');
  });

  it('ConflictModal holds focus and returns focus on Escape', async () => {
    const conflict = createNoteConflict();
    await expectModalContainment((open, close) => (
      <ConflictModal
        conflict={open ? conflict : null}
        onResolve={vi.fn().mockResolvedValue(undefined)}
        onDismiss={close}
      />
    ));
  });

  it('EncryptedConflictModal loading/error state holds focus and returns focus on Escape', async () => {
    const conflict = createNoteConflict();
    await expectModalContainment((open, close) => (
      <EncryptedConflictModal
        conflict={open ? conflict : null}
        keys={null}
        onResolve={vi.fn().mockResolvedValue(undefined)}
        onDismiss={close}
      />
    ));
  });

  it('BackupPassphraseModal holds focus, keeps field order, and returns focus on Escape', async () => {
    await expectModalContainment((open, close) => (
      <BackupPassphraseModal
        mode="create"
        isOpen={open}
        onSubmit={vi.fn()}
        onCancel={close}
      />
    ));

    render(
      <BackupPassphraseModal mode="create" isOpen onSubmit={vi.fn()} onCancel={vi.fn()} />
    );
    const inputs = screen.getByRole('dialog').querySelectorAll('input');
    expect(Array.from(inputs).map((i) => i.id)).toEqual([
      'backup-passphrase',
      'backup-passphrase-confirm',
    ]);
  });

  it('LettingGoModal holds focus and returns focus on Escape', async () => {
    const note = createMockNote();
    await expectModalContainment((open, close) => (
      <LettingGoModal isOpen={open} onClose={close} notes={[note]} tags={[]} />
    ));
  });

  it('ReAuthModal focuses password input, keeps field order, and returns focus on Escape', async () => {
    await expectModalContainment((open, close) => (
      <ReAuthModal isOpen={open} onSuccess={vi.fn()} onCancel={close} />
    ));

    render(<ReAuthModal isOpen onSuccess={vi.fn()} onCancel={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByLabelText('Your password'));
    const controls = Array.from(
      screen.getByRole('dialog').querySelectorAll<HTMLElement>('input, button')
    ).map((el) => el.getAttribute('aria-label') || el.id || el.textContent?.trim());
    expect(controls).toEqual(['Cancel', 'reauth-input', 'Cancel', 'Confirm']);
  });

  it('SessionTimeoutModal holds focus and Escape calls onStay', async () => {
    await expectModalContainment((open, close) => (
      <SessionTimeoutModal
        isOpen={open}
        onStay={close}
        onSignOut={vi.fn()}
        minutesRemaining={2}
      />
    ));
  });

  it('KeyboardShortcutsModal holds focus and returns focus on Escape', async () => {
    await expectModalContainment((open, close) => (
      <KeyboardShortcutsModal isOpen={open} onClose={close} />
    ));
  });

  it('IOSInstallGuide holds focus after entrance, ignores duplicate Escape, and skips delays under reduced motion', async () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      function Harness() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <main>
              <button type="button" onClick={() => setOpen(true)}>Open guide</button>
              <button type="button">Background button</button>
            </main>
            {open && (
              <IOSInstallGuide
                onDismiss={() => {
                  onDismiss();
                  setOpen(false);
                }}
              />
            )}
          </>
        );
      }

      render(<Harness />);
      const opener = screen.getByRole('button', { name: 'Open guide' });
      const background = screen.getByRole('button', { name: 'Background button' });
      opener.focus();
      fireEvent.click(opener);

      // During the 300ms invisible entrance delay, it does not trap focus on an invisible panel.
      expect(background.closest('[inert]')).toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });

      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(background.closest('[inert]')).not.toBeNull();

      const focusable = getFocusableIn(dialog);
      focusable[focusable.length - 1].focus();
      tab(false);
      expect(document.activeElement).toBe(focusable[0]);

      // Pressing Escape twice during exit only invokes onDismiss once.
      await act(async () => {
        fireEvent.keyDown(document, { key: 'Escape' });
        fireEvent.keyDown(document, { key: 'Escape' });
        await vi.advanceTimersByTimeAsync(450);
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(background.closest('[inert]')).toBeNull();
      expect(document.activeElement).toBe(opener);
    } finally {
      vi.useRealTimers();
    }
  });

  it('IOSInstallGuide opens and dismisses immediately when prefers-reduced-motion is enabled', () => {
    const origMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    try {
      const onDismiss = vi.fn();
      render(<IOSInstallGuide onDismiss={onDismiss} />);
      // Immediately traps focus without waiting 300ms.
      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
      // Immediately calls onDismiss on Escape without waiting 400ms.
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    } finally {
      window.matchMedia = origMatchMedia;
    }
  });

  it('IOSInstallGuide cancels its entrance timer if dismissed before 300ms', async () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      render(<IOSInstallGuide onDismiss={onDismiss} />);

      // Dismiss before the 300ms entrance delay elapses.
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Close guide'));
        await vi.advanceTimersByTimeAsync(350);
      });

      // The cancelled entrance timer must not flip it back to visible.
      const backdrop = screen.getByLabelText('Dismiss iOS install guide').parentElement!;
      expect(backdrop.className).toContain('opacity-0');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('TagModal focuses name input, holds focus, and returns focus on Escape', async () => {
    await expectModalContainment((open, close) => (
      <TagModal
        isOpen={open}
        onClose={close}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    ));
  });

  it('ShareModal holds focus and returns focus on Escape', async () => {
    const note = createMockNote();
    await expectModalContainment((open, close) => (
      <ShareModal isOpen={open} onClose={close} note={note} userId="user-1" />
    ));
  });

  it('FadedNotesView release-all confirmation dialog holds focus and returns focus to opener', async () => {
    const note = createMockNote({ deletedAt: new Date() });
    render(
      <FadedNotesView
        notes={[note]}
        onBack={vi.fn()}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
        onEmptyAll={vi.fn()}
        theme="light"
        onThemeToggle={vi.fn()}
        onSettingsClick={vi.fn()}
      />
    );

    const deleteAllBtn = screen.getByRole('button', { name: 'Delete all' });
    deleteAllBtn.focus();
    fireEvent.click(deleteAllBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(deleteAllBtn.closest('[inert]')).not.toBeNull();

    const focusable = getFocusableIn(dialog);
    focusable[focusable.length - 1].focus();
    tab(false);
    expect(document.activeElement).toBe(focusable[0]);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(deleteAllBtn);
  });

  it('WelcomeBackPrompt holds focus and marks background inert without Escape dismissal', () => {
    render(
      <>
        <main>
          <button type="button">Background button</button>
        </main>
        <WelcomeBackPrompt daysRemaining={10} onStay={vi.fn()} onContinue={vi.fn()} />
      </>
    );

    const dialog = screen.getByRole('dialog');
    const background = screen.getByRole('button', { name: 'Background button', hidden: true });
    const continueBtn = screen.getByRole('button', { name: 'Continue letting go' });
    expect(document.activeElement).toBe(dialog);
    expect(document.activeElement).not.toBe(continueBtn);
    expect(background.closest('[inert]')).not.toBeNull();

    const focusable = getFocusableIn(dialog);
    focusable[focusable.length - 1].focus();
    tab(false);
    expect(document.activeElement).toBe(focusable[0]);

    // Mandatory choice: Escape keeps it open AND consumes the event so it cannot leak behind.
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('consumes Escape on busy/non-dismissible modals so it never leaks to background listeners', () => {
    const backgroundEscapeSpy = vi.fn((event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        return 'leaked';
      }
      return 'blocked';
    });

    render(
      <>
        <main>
          <button type="button">Editor content</button>
        </main>
        <BackupPassphraseModal mode="open" isOpen isBusy onSubmit={vi.fn()} onCancel={vi.fn()} />
      </>
    );

    document.addEventListener('keydown', backgroundEscapeSpy);
    try {
      const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      document.dispatchEvent(esc);
      expect(esc.defaultPrevented).toBe(true);
      expect(backgroundEscapeSpy).toHaveReturnedWith('blocked');
    } finally {
      document.removeEventListener('keydown', backgroundEscapeSpy);
    }
  });

  it('exempts [data-rht-toaster] from inert and aria-hidden while a modal is open', () => {
    render(
      <>
        <div data-rht-toaster="true" role="status">Toast region</div>
        <main>
          <button type="button">Behind modal</button>
        </main>
        <InvitationModal noteCount={3} onSignUp={vi.fn()} onDismiss={vi.fn()} />
      </>
    );

    const toaster = screen.getByText('Toast region');
    const behind = screen.getByText('Behind modal');
    expect(toaster).not.toHaveAttribute('inert');
    expect(toaster).not.toHaveAttribute('aria-hidden');
    expect(behind.closest('[inert]')).not.toBeNull();
  });

  it('hides ModalBackdropButton from assistive tech while keeping pointer click dismissal', () => {
    const onDismiss = vi.fn();
    render(<InvitationModal noteCount={3} onSignUp={vi.fn()} onDismiss={onDismiss} />);

    const backdrop = screen.getByLabelText('Dismiss invitation');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(backdrop).toHaveAttribute('tabindex', '-1');

    fireEvent.click(backdrop);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('ImportProgressOverlay holds focus while importing and returns focus when done', () => {
    function Harness() {
      const [importing, setImporting] = useState(false);
      return (
        <>
          <main>
            <button type="button" onClick={() => setImporting(true)}>Start import</button>
            <button type="button" onClick={() => setImporting(false)}>Finish import</button>
          </main>
          {importing && (
            <ImportProgressOverlay progress={{ phase: 'importing', current: 2, total: 5 }} />
          )}
        </>
      );
    }

    render(<Harness />);
    const startBtn = screen.getByRole('button', { name: 'Start import' });
    startBtn.focus();
    fireEvent.click(startBtn);

    const dialog = screen.getByRole('dialog', { name: 'Import progress' });
    expect(document.activeElement).toBe(dialog);
    expect(startBtn.closest('[inert]')).not.toBeNull();

    // Tab stays on the dialog when there are no interactive controls inside.
    tab(false);
    expect(document.activeElement).toBe(dialog);

    // Finish import restores focus to opener.
    const finishBtn = screen.getByRole('button', { name: 'Finish import', hidden: true });
    fireEvent.click(finishBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(startBtn.closest('[inert]')).toBeNull();
    expect(document.activeElement).toBe(startBtn);
  });

  it('nested modal opened from LettingGoModal (ReAuthModal) returns focus to LettingGoModal on Escape', () => {
    const note = createMockNote();
    const onClose = vi.fn();
    render(
      <>
        <main>
          <button type="button">Library button</button>
        </main>
        <LettingGoModal isOpen onClose={onClose} notes={[note]} tags={[]} />
      </>
    );

    const letGoTrigger = screen.getByRole('button', { name: 'Let go' });
    letGoTrigger.focus();
    fireEvent.click(letGoTrigger);

    // ReAuthModal is now topmost; LettingGoModal behind it is inert.
    const reauthDialog = screen.getByRole('dialog', { name: 'A moment of verification' });
    expect(reauthDialog.contains(document.activeElement)).toBe(true);
    expect(letGoTrigger.closest('[inert]')).not.toBeNull();

    // Escape closes ONLY ReAuthModal, un-inerts LettingGoModal, and returns focus to "Let go".
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'A moment of verification' })).toBeNull();
    expect(letGoTrigger.closest('[inert]')).toBeNull();
    expect(document.activeElement).toBe(letGoTrigger);
    // Page behind LettingGoModal stays inert.
    expect(
      screen.getByRole('button', { name: 'Library button', hidden: true }).closest('[inert]')
    ).not.toBeNull();
  });

  it('auto-opening dialogs (ConflictModal, EncryptedConflictModal, IOSInstallGuide) do not fire actions on Space/Enter when opening while typing', async () => {
    const user = userEvent.setup({ delay: null });
    const conflict = createNoteConflict();

    // 1. ConflictModal
    const onResolve = vi.fn().mockResolvedValue(undefined);
    const onDismissConflict = vi.fn();
    function ConflictHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <input aria-label="Note title" />
          <button type="button" onClick={() => setOpen(true)}>Trigger conflict</button>
          <ConflictModal conflict={open ? conflict : null} onResolve={onResolve} onDismiss={onDismissConflict} />
        </>
      );
    }
    const cView = render(<ConflictHarness />);
    screen.getByLabelText('Note title').focus();
    fireEvent.click(screen.getByRole('button', { name: 'Trigger conflict' }));
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(onResolve).not.toHaveBeenCalled();
    expect(onDismissConflict).not.toHaveBeenCalled();
    // Accessible in-dialog "Not now" button still dismisses.
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onDismissConflict).toHaveBeenCalledTimes(1);
    cView.unmount();

    // 2. EncryptedConflictModal loading state
    const onDismissEnc = vi.fn();
    const eView = render(
      <>
        <input aria-label="Body" />
        <EncryptedConflictModal conflict={conflict} keys={null} onResolve={vi.fn()} onDismiss={onDismissEnc} />
      </>
    );
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(onDismissEnc).not.toHaveBeenCalled();
    eView.unmount();

    // 3. IOSInstallGuide (reduced motion so it opens immediately)
    const origMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    try {
      const onDismissGuide = vi.fn();
      render(
        <>
          <input aria-label="Search" />
          <IOSInstallGuide onDismiss={onDismissGuide} />
        </>
      );
      expect(document.activeElement).toBe(screen.getByRole('dialog'));
      await user.keyboard(' ');
      await user.keyboard('{Enter}');
      expect(onDismissGuide).not.toHaveBeenCalled();
    } finally {
      window.matchMedia = origMatchMedia;
    }
  });

  it('WelcomeBackPrompt and ImportProgressOverlay center their <dialog> with relative z-10 and use --radius-plain', () => {
    const w = render(<WelcomeBackPrompt daysRemaining={5} onStay={vi.fn()} onContinue={vi.fn()} />);
    const welcomeDialog = screen.getByRole('dialog');
    expect(welcomeDialog).toHaveClass('relative', 'z-10');
    expect(welcomeDialog).toHaveStyle({ borderRadius: 'var(--radius-plain)' });
    w.unmount();

    render(<ImportProgressOverlay progress={{ phase: 'parsing', current: 0, total: 0 }} />);
    const importDialog = screen.getByRole('dialog', { name: 'Import progress' });
    expect(importDialog).toHaveClass('relative', 'z-10');
    expect(importDialog).toHaveStyle({ borderRadius: 'var(--radius-plain)' });
  });

  it('does not hijack IME Escape (isComposing=true or keyCode=229) on an open modal', () => {
    const onClose = vi.fn();
    render(<TagModal isOpen onClose={onClose} onSave={vi.fn().mockResolvedValue(undefined)} />);

    const composingEsc = new KeyboardEvent('keydown', {
      key: 'Escape',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(composingEsc);
    expect(composingEsc.defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();

    const keyCode229Esc = new KeyboardEvent('keydown', {
      key: 'Escape',
      keyCode: 229,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(keyCode229Esc);
    expect(keyCode229Esc.defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('recovers focus to the original page opener when stacked modals close out of order (A closes before B)', () => {
    function OutOfOrderHarness() {
      const [showA, setShowA] = useState(false);
      const [showB, setShowB] = useState(false);
      return (
        <>
          <main>
            <button type="button" onClick={() => setShowA(true)}>Open A</button>
          </main>
          {showA && (
            <InvitationModal
              noteCount={3}
              onSignUp={() => setShowB(true)}
              onDismiss={() => setShowA(false)}
            />
          )}
          {showB && (
            <SessionTimeoutModal
              isOpen
              onStay={() => {
                setShowA(false);
              }}
              onSignOut={() => setShowB(false)}
              minutesRemaining={1}
            />
          )}
        </>
      );
    }

    render(<OutOfOrderHarness />);
    const openA = screen.getByRole('button', { name: 'Open A' });
    openA.focus();
    fireEvent.click(openA);

    // Open B from inside A.
    const openBFromA = screen.getByRole('button', { name: 'Create an account' });
    openBFromA.focus();
    fireEvent.click(openBFromA);

    // Close A FIRST while B is still open.
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.queryByText('Keep your notes')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'A gentle pause' })).toBeInTheDocument();

    // Now close B: A's button is unmounted, so B falls back to A's original page opener.
    fireEvent.click(screen.getByRole('button', { name: 'Sign out now' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(openA);
    expect(document.body).not.toHaveFocus();
  });

  it('marks background siblings mounted AFTER a modal opens as inert while keeping late toasters exempt', async () => {
    function LateBackgroundHarness() {
      const [showLate, setShowLate] = useState(false);
      return (
        <>
          <main>
            <button type="button" onClick={() => setShowLate(true)}>Mount late</button>
          </main>
          {showLate && (
            <>
              <section data-testid="late-sibling">
                <button type="button">Late control</button>
              </section>
              <div data-rht-toaster="true" data-testid="late-toaster">Late toast</div>
            </>
          )}
          <InvitationModal noteCount={3} onSignUp={vi.fn()} onDismiss={vi.fn()} />
        </>
      );
    }

    render(<LateBackgroundHarness />);
    fireEvent.click(screen.getByText('Mount late'));

    await waitFor(() => {
      expect(screen.getByTestId('late-sibling')).toHaveAttribute('inert');
      expect(screen.getByTestId('late-sibling')).toHaveAttribute('aria-hidden', 'true');
    });
    expect(screen.getByTestId('late-toaster')).not.toHaveAttribute('inert');
    expect(screen.getByTestId('late-toaster')).not.toHaveAttribute('aria-hidden');
  });

  it('cleans up inert and aria-hidden completely when lock or sign-out unmounts an open modal', () => {
    function LockHarness() {
      const [locked, setLocked] = useState(false);
      if (locked) {
        return (
          <main>
            <label htmlFor="unlock-pass">Passphrase</label>
            <input id="unlock-pass" type="password" />
            <button type="button">Unlock</button>
          </main>
        );
      }
      return (
        <>
          <main>
            <button type="button" onClick={() => setLocked(true)}>Trigger lock</button>
          </main>
          <TagModal isOpen onClose={vi.fn()} onSave={vi.fn().mockResolvedValue(undefined)} />
        </>
      );
    }

    render(<LockHarness />);
    expect(screen.getByText('Trigger lock').closest('[inert]')).not.toBeNull();

    // Vault locks / user signs out while modal is open.
    fireEvent.click(screen.getByText('Trigger lock'));
    const passInput = screen.getByLabelText('Passphrase');
    const unlockBtn = screen.getByRole('button', { name: 'Unlock' });
    expect(passInput.closest('[inert]')).toBeNull();
    expect(passInput.closest('[aria-hidden="true"]')).toBeNull();
    expect(unlockBtn.closest('[inert]')).toBeNull();
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  });

  it('FindReplacePanel does not steal Escape from an open modal mounted after it', () => {
    const editor = new TiptapEditor({
      extensions: [StarterKit],
      content: '<p>Find me here</p>',
    });
    const onCloseFind = vi.fn();
    const onCloseModal = vi.fn();

    try {
      function EditorWithModalHarness() {
        const [showModal, setShowModal] = useState(false);
        return (
          <>
            <main>
              <FindReplacePanel editor={editor} onClose={onCloseFind} />
              <button type="button" onClick={() => setShowModal(true)}>Open tag modal</button>
            </main>
            <TagModal
              isOpen={showModal}
              onClose={() => {
                onCloseModal();
                setShowModal(false);
              }}
              onSave={vi.fn().mockResolvedValue(undefined)}
            />
          </>
        );
      }

      render(<EditorWithModalHarness />);
      fireEvent.click(screen.getByRole('button', { name: 'Open tag modal' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // First Escape closes TagModal ONLY — FindReplacePanel behind it stays open.
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCloseModal).toHaveBeenCalledTimes(1);
      expect(onCloseFind).not.toHaveBeenCalled();

      // Second Escape (now that no modal is open) closes FindReplacePanel.
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCloseFind).toHaveBeenCalledTimes(1);
    } finally {
      editor.destroy();
    }
  });
});
