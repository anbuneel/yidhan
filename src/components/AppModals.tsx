import { Suspense } from 'react';
import type { Note, Tag, TagColor, Theme } from '../types';
import type { DerivedKeys } from '../lib/encryption';
import { ErrorBoundary } from './ErrorBoundary';
import { WelcomeBackPrompt } from './WelcomeBackPrompt';
import { InstallPrompt } from './InstallPrompt';
import { IOSInstallGuide } from './IOSInstallGuide';
import { SessionTimeoutModal } from './SessionTimeoutModal';
import { EncryptedConflictModal as ConflictModal } from './EncryptedConflictModal';
import { ImportProgressOverlay, type ImportProgress } from './ImportProgressOverlay';
import { BackupPassphraseModal } from './BackupPassphraseModal';
import type { BackupRestore } from '../hooks/useImport';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import type { useSessionSettings } from '../hooks/useSessionSettings';
import type { useVaultSettings } from '../hooks/useVaultSettings';
import type { useSyncEngine } from '../hooks/useSyncEngine';

const TagModal = lazyWithRetry(() => import('./TagModal').then((m) => ({ default: m.TagModal })));
const SettingsModal = lazyWithRetry(() =>
  import('./SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const LettingGoModal = lazyWithRetry(() =>
  import('./LettingGoModal').then((m) => ({ default: m.LettingGoModal }))
);
const KeyboardShortcutsModal = lazyWithRetry(() =>
  import('./KeyboardShortcutsModal').then((m) => ({ default: m.KeyboardShortcutsModal }))
);

/**
 * Everything that floats above a signed-in screen.
 *
 * The tag modal and the conflict modal belong to both the library and the editor —
 * a conflict can arrive while a note is open, and the editor's "add tag" opens the
 * same dialog — so `scope` says which of the rest to include rather than the two
 * screens each keeping their own copy of the list.
 */
/** The two modals that can appear over any signed-in screen, library or editor. */
interface SharedModalProps {
  tags: Tag[];
  showTagModal: boolean;
  editingTag: Tag | null;
  onCloseTagModal: () => void;
  onSaveTag: (name: string, color: TagColor) => Promise<void>;
  onDeleteTag: () => Promise<void>;

  keys: DerivedKeys | null;
  activeConflict: ReturnType<typeof useSyncEngine>['conflicts'][number] | null;
  onConflictResolve: (choice: 'local' | 'server' | 'both') => Promise<void>;
  onConflictDismiss: () => void;
}

/** Everything else, which only the library screen has room for. */
interface LibraryModalProps extends SharedModalProps {
  theme: Theme;
  onThemeToggle: () => void;
  notes: Note[];

  showSettingsModal: boolean;
  onCloseSettings: () => void;
  onLetGoClick: () => void;
  sessionSettings: ReturnType<typeof useSessionSettings>;
  vaultSettings: ReturnType<typeof useVaultSettings>;
  isVaultUnlocked: boolean;
  onLockVault: () => void;
  onPersistToLocal: () => boolean;

  showLettingGoModal: boolean;
  onCloseLettingGo: () => void;

  showWelcomeBack: boolean;
  daysUntilRelease: number | null;
  onDismissWelcomeBack: () => void;

  importProgress: ImportProgress | null;

  /** A `.yidhan` backup waiting on the passphrase it was sealed with (item 38). */
  backupRestore: BackupRestore;

  shouldShowInstallPrompt: boolean;
  onInstall: () => Promise<boolean>;
  onDismissInstall: () => void;
  shouldShowIOSGuide: boolean;
  onDismissIOSGuide: () => void;

  showSessionTimeoutModal: boolean;
  onSessionStay: () => void;
  onSessionSignOut: () => void;
  sessionMinutesRemaining: number | null;

  showShortcutsModal: boolean;
  onCloseShortcuts: () => void;
}

export type AppModalsProps =
  | ({ scope: 'editor' } & SharedModalProps)
  | ({ scope: 'library' } & LibraryModalProps);

export function AppModals(props: AppModalsProps) {
  const shared = (
    <>
      {props.showTagModal && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <TagModal
              isOpen={props.showTagModal}
              onClose={props.onCloseTagModal}
              onSave={props.onSaveTag}
              onDelete={props.onDeleteTag}
              editingTag={props.editingTag}
              existingTags={props.tags}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      <ConflictModal
        keys={props.keys}
        conflict={props.activeConflict}
        onResolve={props.onConflictResolve}
        onDismiss={props.onConflictDismiss}
      />
    </>
  );

  if (props.scope === 'editor') return shared;

  return (
    <>
      {shared}

      {props.showSettingsModal && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <SettingsModal
              isOpen
              onClose={props.onCloseSettings}
              theme={props.theme}
              onThemeToggle={props.onThemeToggle}
              onLetGoClick={props.onLetGoClick}
              sessionSettings={props.sessionSettings}
              vaultSettings={props.vaultSettings}
              isVaultUnlocked={props.isVaultUnlocked}
              onLockVault={props.onLockVault}
              onPersistToLocal={props.onPersistToLocal}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {props.showLettingGoModal && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <LettingGoModal
              isOpen
              onClose={props.onCloseLettingGo}
              notes={props.notes}
              tags={props.tags}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {props.showWelcomeBack && props.daysUntilRelease !== null && (
        <WelcomeBackPrompt
          daysRemaining={props.daysUntilRelease}
          onStay={props.onDismissWelcomeBack}
          onContinue={props.onDismissWelcomeBack}
        />
      )}

      {props.importProgress && <ImportProgressOverlay progress={props.importProgress} />}

      {/* Backup passphrase — a `.yidhan` file cannot be read without it (item 38) */}
      <BackupPassphraseModal
        mode="open"
        isOpen={props.backupRestore.pendingFile !== null}
        error={props.backupRestore.error}
        isBusy={props.backupRestore.isBusy}
        onSubmit={props.backupRestore.onSubmit}
        onCancel={props.backupRestore.onCancel}
      />

      {props.shouldShowInstallPrompt && (
        <InstallPrompt onInstall={props.onInstall} onDismiss={props.onDismissInstall} />
      )}

      {props.shouldShowIOSGuide && <IOSInstallGuide onDismiss={props.onDismissIOSGuide} />}

      <SessionTimeoutModal
        isOpen={props.showSessionTimeoutModal}
        onStay={props.onSessionStay}
        onSignOut={props.onSessionSignOut}
        minutesRemaining={props.sessionMinutesRemaining}
      />

      {props.showShortcutsModal && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <KeyboardShortcutsModal isOpen onClose={props.onCloseShortcuts} />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
