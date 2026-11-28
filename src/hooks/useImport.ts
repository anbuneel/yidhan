/**
 * Export and import: the whole of it, including the progress the overlay renders.
 *
 * Three shapes go in and out — a v1 note export, a v2 account backup, and a Markdown
 * bundle — and each has its own tag reconciliation. It lived inline in App.tsx as 240
 * lines between the search handlers and the render.
 */

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import type { Note, Tag } from '../types';
import type { DerivedKeys } from '../lib/encryption';
import { KdfCancelledError, KdfLoadError } from '../lib/argon2';
import { BACKUP_FILE_EXTENSION, MAX_IMPORT_FILE_SIZE } from '../utils/fileLimits';
import { loadOnDemand } from '../utils/loadOnDemand';
import type { NotesSync } from './useNotesSync';
import type { ImportProgress } from '../components/ImportProgressOverlay';

export interface UseImportOptions {
  userId: string | undefined;
  keys: DerivedKeys | null;
  notes: Note[];
  tags: Tag[];
  setTags: Dispatch<SetStateAction<Tag[]>>;
  /** The guarded re-read from IndexedDB (useNotesSync). */
  reloadFromStorage: NotesSync['reloadFromStorage'];
}

export interface ImportExport {
  importProgress: ImportProgress | null;
  handleExportJSON: () => void;
  handleExportMarkdown: () => void;
  handleImportFile: (file: File) => Promise<void>;
  /** The `.yidhan` passphrase exchange (item 38). */
  backupRestore: BackupRestore;
}

/** A `.yidhan` file between the file picker and the import, waiting on its passphrase. */
export interface BackupRestore {
  pendingFile: File | null;
  error: string | null;
  isBusy: boolean;
  onSubmit: (passphrase: string) => void;
  onCancel: () => void;
}

// Export, import and backup code loads on the reader's click, not with the app shell
// (shell-size plan A5). Each failure to load says so and suggests a reload; nothing
// reloads by itself, because held saves live only in memory.
const loadExportCode = () => loadOnDemand(() => import('../utils/exportImport'));
const loadBackupCode = () => loadOnDemand(() => import('../utils/encryptedBackup'));
const loadImportCode = () => loadOnDemand(() => import('../utils/importFile'));

type ExportCode = Awaited<ReturnType<typeof loadExportCode>>;

async function withExportCode(run: (code: ExportCode) => void): Promise<void> {
  let code: ExportCode;
  try {
    code = await loadExportCode();
  } catch (error) {
    console.error('Export code failed to load:', error);
    toast.error('Export could not load. Reload the page and try again.');
    return;
  }
  run(code);
}

/** An export that quietly omits notes is worse than one that says it did (item 41). */
function reportOmittedFromExport(code: ExportCode, noteList: Note[]) {
  const { omittedCount } = code.partitionExportableNotes(noteList);
  const message = code.describeOmittedNotes(omittedCount);
  if (message) toast(message, { duration: 6000, icon: '\u26A0\uFE0F' });
}

export function useImport({
  userId,
  keys,
  notes,
  tags,
  setTags,
  reloadFromStorage,
}: UseImportOptions): ImportExport {
  // `isImporting: true` used to ride along on every setImportProgress call; nothing
  // ever read it — the overlay renders on the progress object being non-null.
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  // A `.yidhan` file cannot be read until the reader supplies the passphrase they
  // sealed it with, so it waits here between the file picker and the import (item 38).
  const [pendingBackupFile, setPendingBackupFile] = useState<File | null>(null);
  const [backupRestoreError, setBackupRestoreError] = useState<string | null>(null);
  const [isOpeningBackup, setIsOpeningBackup] = useState(false);

  // Export to JSON
  const handleExportJSON = useCallback(() => {
    void withExportCode((code) => {
      const json = code.exportNotesToJSON(notes, tags);
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const time = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS
      code.downloadFile(json, `yidhan-backup-${date}-${time}.json`, 'application/json');
      reportOmittedFromExport(code, notes);
    });
  }, [notes, tags]);

  // Export to Markdown
  const handleExportMarkdown = useCallback(() => {
    void withExportCode((code) => {
      // downloadMarkdownZip returns a promise, so a throw inside it arrives as a
      // rejection rather than synchronously. Unhandled, the export would fail
      // with no sign at all: the one outcome a backup must never have.
      code.downloadMarkdownZip(notes).catch((error: unknown) => {
        console.error('Markdown export failed:', error);
        toast.error('Could not save the Markdown export');
      });
      reportOmittedFromExport(code, notes);
    });
  }, [notes]);

  // Import file (JSON, Markdown, or a decrypted `.yidhan` payload)
  const handleImportFile = useCallback(async (file: File, decryptedBackup?: string) => {
    // The notes are already written when this runs. A failed re-read must not say the
    // file was bad: the reader would import it again and get every note twice.
    const reloadAfterImport = () => reloadFromStorage().catch((error: unknown) => {
      console.error(error);
      toast.error('Imported. Pull to refresh to see it.');
    });

    if (!userId) return;
    if (!keys) {
      toast.error('Please unlock your vault before importing notes');
      return;
    }

    // Validate file size before reading
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      const maxSizeMB = Math.round(MAX_IMPORT_FILE_SIZE / (1024 * 1024));
      toast.error(`File too large. Maximum size is ${maxSizeMB}MB.`);
      return;
    }

    // A `.yidhan` backup is sealed under a passphrase the reader chose, which nothing
    // here knows. Ask for it first; the decrypted payload comes back through the second
    // argument and takes the ordinary JSON path from there (item 38).
    if (file.name.endsWith(BACKUP_FILE_EXTENSION) && decryptedBackup === undefined) {
      setPendingBackupFile(file);
      setBackupRestoreError(null);
      return;
    }

    setImportProgress({ current: 0, total: 0, phase: 'parsing' });
    try {
      // The parsing and writing load on demand: import is rare, and the app shell has
      // no room to spare (scripts/bundle-budget.json).
      let importFile: typeof import('../utils/importFile').importFile;
      let ValidationError: typeof import('../utils/exportImport').ValidationError;
      try {
        [{ importFile }, { ValidationError }] = await Promise.all([loadImportCode(), loadExportCode()]);
      } catch (error) {
        // The code did not load (often an app update mid-session). Nothing was written.
        // No automatic reload: held saves live only in memory.
        console.error('Import code failed to load:', error);
        toast.error('Import could not load. Reload the page and try again.');
        return;
      }
      try {
        await importFile(file, decryptedBackup, {
          userId, keys, tags, setTags, setImportProgress, reloadAfterImport,
        });
      } catch (error) {
        console.error('Import failed:', error);
        if (error instanceof ValidationError) {
          toast.error(`Import failed: ${error.message}`);
        } else {
          toast.error('Failed to import file. Please check the file format.');
        }
      }
    } finally {
      setImportProgress(null);
    }
  }, [userId, tags, keys, setTags, reloadFromStorage]);

  // Declared after `handleImportFile` so it can call it directly. In App this needed a
  // ref, because the import handler sat two hundred lines below the backup one; here
  // they are neighbours and the ref goes away.
  const handleOpenBackup = useCallback(async (passphrase: string) => {
    const file = pendingBackupFile;
    if (!file) return;

    setIsOpeningBackup(true);
    setBackupRestoreError(null);
    let backup: Awaited<ReturnType<typeof loadBackupCode>> | null = null;
    try {
      const [loadedBackup, { readFileAsText }] = await Promise.all([loadBackupCode(), loadExportCode()]);
      backup = loadedBackup;
      const payload = await backup.openEncryptedBackup(await readFileAsText(file), passphrase);
      setPendingBackupFile(null);
      await handleImportFile(file, payload);
    } catch (error) {
      // The vault locked while the key was derived. Nothing was imported; say nothing.
      if (error instanceof KdfCancelledError) return;
      // A damaged file and a wrong passphrase are different problems, and only one of
      // them is something the reader can do anything about. Say which. Code that did
      // not load is a third, and a reload fixes it.
      const message = !backup
        ? 'The backup code could not load. Reload the page and try again.'
        : error instanceof backup.BackupFormatError ||
            error instanceof backup.BackupPassphraseError ||
            error instanceof KdfLoadError
          ? error.message
          : 'That backup could not be opened.';
      console.error('Failed to open backup:', error);
      setBackupRestoreError(message);
    } finally {
      setIsOpeningBackup(false);
    }
  }, [pendingBackupFile, handleImportFile]);

  const cancelBackupRestore = useCallback(() => {
    setPendingBackupFile(null);
    setBackupRestoreError(null);
  }, []);

  return {
    importProgress,
    handleExportJSON,
    handleExportMarkdown,
    handleImportFile,
    backupRestore: {
      pendingFile: pendingBackupFile,
      error: backupRestoreError,
      isBusy: isOpeningBackup,
      onSubmit: (passphrase: string) => void handleOpenBackup(passphrase),
      onCancel: cancelBackupRestore,
    },
  };
}
