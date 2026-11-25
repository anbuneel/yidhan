import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Editor as TiptapEditor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Auth } from './Auth';
import { BackupPassphraseModal } from './BackupPassphraseModal';
import { ConflictModal } from './ConflictModal';
import { EncryptedConflictModal } from './EncryptedConflictModal';
import { FadedNotesView } from './FadedNotesView';
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

  it('TagSelector dropdown does not trap Tab or mark background inert', () => {
    const tags = [createMockTag({ id: 't1', name: 'Work' })];
    render(
      <>
        <button type="button">Page control</button>
        <TagSelector tags={tags} selectedTagIds={[]} onToggleTag={vi.fn()} />
      </>
    );

    const pageControl = screen.getByRole('button', { name: 'Page control' });
    fireEvent.click(screen.getByRole('button', { name: /add tags/i }));
    expect(screen.getByTestId('tag-selector-menu')).toBeInTheDocument();

    expect(pageControl.closest('[inert]')).toBeNull();

    const tagBtn = screen.getByRole('button', { name: 'Work' });
    tagBtn.focus();
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabEvent);
    expect(tabEvent.defaultPrevented).toBe(false);
  });

  it('LinkPopover does not trap Tab or mark background inert', () => {
    const editor = new TiptapEditor({
      extensions: [StarterKit.configure({ link: { openOnClick: false } })],
      content: '<p>Hello world</p>',
    });
    try {
      render(
        <>
          <button type="button">Page control</button>
          <LinkPopover editor={editor} onClose={vi.fn()} />
        </>
      );

      const pageControl = screen.getByRole('button', { name: 'Page control' });
      expect(pageControl.closest('[inert]')).toBeNull();

      const saveBtn = screen.getByRole('button', { name: 'Save link' });
      saveBtn.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      document.dispatchEvent(tabEvent);
      expect(tabEvent.defaultPrevented).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('EditorToolbar does not trap Tab or mark background inert', () => {
    const editor = new TiptapEditor({
      extensions: [StarterKit],
      content: '<p>Hello world</p>',
    });
    try {
      render(
        <>
          <button type="button">Page control</button>
          <EditorToolbar editor={editor} variant="inline" />
        </>
      );

      const pageControl = screen.getByRole('button', { name: 'Page control' });
      expect(pageControl.closest('[inert]')).toBeNull();

      const toolbarButtons = screen.getAllByRole('button');
      toolbarButtons[toolbarButtons.length - 1].focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      document.dispatchEvent(tabEvent);
      expect(tabEvent.defaultPrevented).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('InstallPrompt floating banner does not trap Tab or mark background inert', () => {
    render(
      <>
        <button type="button">Page control</button>
        <InstallPrompt onInstall={vi.fn().mockResolvedValue(true)} onDismiss={vi.fn()} />
      </>
    );

    const pageControl = screen.getByRole('button', { name: 'Page control' });
    expect(pageControl.closest('[inert]')).toBeNull();

    const installBtn = screen.getByRole('button', { name: /install/i });
    installBtn.focus();
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabEvent);
    expect(tabEvent.defaultPrevented).toBe(false);
  });

  it('Toasts (role="status") do not trap Tab or mark background inert', () => {
    render(
      <>
        <button type="button">Page control</button>
        <div role="status">
          <span>Note restored</span>
          <button type="button">Undo</button>
        </div>
      </>
    );

    const pageControl = screen.getByRole('button', { name: 'Page control' });
    expect(pageControl.closest('[inert]')).toBeNull();

    const undoBtn = screen.getByRole('button', { name: 'Undo' });
    undoBtn.focus();
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabEvent);
    expect(tabEvent.defaultPrevented).toBe(false);
  });

  it('Auth in full-page mode (isModal=false) does not trap Tab or mark siblings inert', () => {
    render(
      <>
        <button type="button">External control</button>
        <Auth theme="light" onThemeToggle={vi.fn()} isModal={false} />
      </>
    );

    const external = screen.getByRole('button', { name: 'External control' });
    expect(external.closest('[inert]')).toBeNull();

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabEvent);
    expect(tabEvent.defaultPrevented).toBe(false);
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
    const cta = screen.getByRole('button', { name: 'Keep my thoughts' });
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

  it('IOSInstallGuide holds focus and returns focus on Escape', async () => {
    vi.useFakeTimers();
    try {
      function Harness() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <main>
              <button type="button" onClick={() => setOpen(true)}>Open guide</button>
              <button type="button">Background button</button>
            </main>
            {open && <IOSInstallGuide onDismiss={() => setOpen(false)} />}
          </>
        );
      }

      render(<Harness />);
      const opener = screen.getByRole('button', { name: 'Open guide' });
      const background = screen.getByRole('button', { name: 'Background button' });
      opener.focus();
      fireEvent.click(opener);

      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(background.closest('[inert]')).not.toBeNull();

      const focusable = getFocusableIn(dialog);
      focusable[focusable.length - 1].focus();
      tab(false);
      expect(document.activeElement).toBe(focusable[0]);

      await act(async () => {
        fireEvent.keyDown(document, { key: 'Escape' });
        await vi.advanceTimersByTimeAsync(450);
      });

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(background.closest('[inert]')).toBeNull();
      expect(document.activeElement).toBe(opener);
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

    const releaseAllBtn = screen.getByRole('button', { name: 'Release all' });
    releaseAllBtn.focus();
    fireEvent.click(releaseAllBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(releaseAllBtn.closest('[inert]')).not.toBeNull();

    const focusable = getFocusableIn(dialog);
    focusable[focusable.length - 1].focus();
    tab(false);
    expect(document.activeElement).toBe(focusable[0]);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(releaseAllBtn);
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
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(background.closest('[inert]')).not.toBeNull();

    const focusable = getFocusableIn(dialog);
    focusable[focusable.length - 1].focus();
    tab(false);
    expect(document.activeElement).toBe(focusable[0]);

    // Mandatory choice: Escape keeps it open.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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
});
