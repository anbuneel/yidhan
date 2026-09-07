/**
 * Export and import: the whole of it, including the progress the overlay renders.
 *
 * Three shapes go in and out — a v1 note export, a v2 account backup, and a Markdown
 * bundle — and each has its own tag reconciliation. It lived inline in App.tsx as 240
 * lines between the search handlers and the render.
 */

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import type { Note, Tag, TagColor } from '../types';
import type { DerivedKeys } from '../lib/encryption';
import {
  exportNotesToJSON,
  downloadFile,
  parseImportedJSON,
  readFileAsText,
  downloadMarkdownZip,
  markdownToHtml,
  parseMultiNoteMarkdown,
  partitionExportableNotes,
  describeOmittedNotes,
  ValidationError,
  MAX_IMPORT_FILE_SIZE,
} from '../utils/exportImport';
import {
  BACKUP_FILE_EXTENSION,
  BackupFormatError,
  BackupPassphraseError,
  openEncryptedBackup,
} from '../utils/encryptedBackup';
import { sanitizeHtml } from '../utils/sanitize';
import {
  createEncryptedNote,
  createEncryptedNotesBatch,
  fetchDecryptedNotes,
} from '../services/encryptedNotes';
import { addTagToNoteOffline } from '../services/offlineNotes';
import { createTagOffline } from '../services/offlineTags';
import type { ImportProgress } from '../components/ImportProgressOverlay';

export interface UseImportOptions {
  userId: string | undefined;
  keys: DerivedKeys | null;
  notes: Note[];
  tags: Tag[];
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setTags: Dispatch<SetStateAction<Tag[]>>;
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

export function useImport({
  userId,
  keys,
  notes,
  tags,
  setNotes,
  setTags,
}: UseImportOptions): ImportExport {
  // `isImporting: true` used to ride along on every setImportProgress call; nothing
  // ever read it — the overlay renders on the progress object being non-null.
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  // A `.yidhan` file cannot be read until the reader supplies the passphrase they
  // sealed it with, so it waits here between the file picker and the import (item 38).
  const [pendingBackupFile, setPendingBackupFile] = useState<File | null>(null);
  const [backupRestoreError, setBackupRestoreError] = useState<string | null>(null);
  const [isOpeningBackup, setIsOpeningBackup] = useState(false);

  // An export that quietly omits notes is worse than one that says it did. A note whose
  // ciphertext would not open has nothing to write, so it is left out and counted
  // (item 41).
  const reportOmittedFromExport = useCallback((noteList: Note[]) => {
    const { omittedCount } = partitionExportableNotes(noteList);
    const message = describeOmittedNotes(omittedCount);
    if (message) toast(message, { duration: 6000, icon: '\u26A0\uFE0F' });
  }, []);

  // Export to JSON
  const handleExportJSON = useCallback(() => {
    const json = exportNotesToJSON(notes, tags);
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS
    downloadFile(json, `yidhan-backup-${date}-${time}.json`, 'application/json');
    reportOmittedFromExport(notes);
  }, [notes, tags, reportOmittedFromExport]);

  // Export to Markdown
  const handleExportMarkdown = useCallback(() => {
    downloadMarkdownZip(notes);
    reportOmittedFromExport(notes);
  }, [notes, reportOmittedFromExport]);

  // Import file (JSON, Markdown, or a decrypted `.yidhan` payload)
  const handleImportFile = useCallback(async (file: File, decryptedBackup?: string) => {
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
      const content = decryptedBackup ?? (await readFileAsText(file));
      const isJSON = decryptedBackup !== undefined || file.name.endsWith('.json');
      const isMarkdown = file.name.endsWith('.md') || file.name.endsWith('.markdown');

      if (isJSON) {
        // Import JSON backup with validation
        const data = parseImportedJSON(content);
        const totalNotes = data.notes.length;

        setImportProgress({ current: 0, total: totalNotes, phase: 'importing' });

        // Create tags first (if they don't exist)
        const tagMap = new Map<string, string>(); // name -> id
        for (const tagData of data.tags) {
          const existingTag = tags.find(t => t.name.toLowerCase() === tagData.name.toLowerCase());
          if (existingTag) {
            tagMap.set(tagData.name, existingTag.id);
          } else {
            const newTag = await createTagOffline(userId, tagData.name, tagData.color as TagColor);
            tagMap.set(tagData.name, newTag.id);
            setTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
          }
        }

        // Prepare notes for batch insert (keep original tags for later)
        const originalTagsMap = new Map<number, string[]>();
        const notesToImport = data.notes.map((noteData, index) => {
          originalTagsMap.set(index, noteData.tags);
          return {
            title: noteData.title,
            pinned: noteData.pinned,
            content: sanitizeHtml(noteData.content),
            createdAt: noteData.createdAt ? new Date(noteData.createdAt) : undefined,
            updatedAt: noteData.updatedAt ? new Date(noteData.updatedAt) : undefined,
          };
        });

        // Batch insert notes with progress callback. Authenticated imports must be encrypted.
        const progressCb = (completed: number, total: number) => {
          setImportProgress({ current: completed, total, phase: 'importing' });
        };
        const createdNotes = await createEncryptedNotesBatch(userId, notesToImport, keys, progressCb);

        // Add tags to notes (this still needs to be sequential due to junction table)
        setImportProgress({ current: 0, total: createdNotes.length, phase: 'finalizing' });
        for (let i = 0; i < createdNotes.length; i++) {
          const note = createdNotes[i];
          const originalTags = originalTagsMap.get(i) || [];
          for (const tagName of originalTags) {
            const tagId = tagMap.get(tagName);
            if (tagId) {
              await addTagToNoteOffline(userId, note.id, tagId, { preserveUpdatedAt: true });
            }
          }
          setImportProgress({ current: i + 1, total: createdNotes.length, phase: 'finalizing' });
        }

        toast.success(`Successfully imported ${createdNotes.length} note${createdNotes.length === 1 ? '' : 's'}`);

        // Refresh notes from IndexedDB
        const refreshedNotes = await fetchDecryptedNotes(userId, keys);
        setNotes(refreshedNotes);

      } else if (isMarkdown) {
        // Try to parse as combined multi-note export first
        const multiNotes = parseMultiNoteMarkdown(content);

        if (multiNotes) {
          const totalNotes = multiNotes.length;
          setImportProgress({ current: 0, total: totalNotes, phase: 'importing' });

          // Collect all unique tags from imported notes
          const allTagNames = new Set<string>();
          for (const noteData of multiNotes) {
            for (const tagName of noteData.tags) {
              allTagNames.add(tagName);
            }
          }

          // Create tag map (create missing tags)
          const tagMap = new Map<string, string>(); // name -> id
          for (const tagName of allTagNames) {
            const existingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
            if (existingTag) {
              tagMap.set(tagName, existingTag.id);
            } else {
              const newTag = await createTagOffline(userId, tagName, 'stone');
              tagMap.set(tagName, newTag.id);
              setTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
            }
          }

          // Prepare notes for batch insert (keep original tags for later)
          const originalTagsMap = new Map<number, string[]>();
          const notesToImport = multiNotes.map((noteData, index) => {
            originalTagsMap.set(index, noteData.tags);
            return {
              title: noteData.title,
              content: sanitizeHtml(markdownToHtml(noteData.content)),
            };
          });

          // Batch insert notes with progress callback. Authenticated imports must be encrypted.
          const mdProgressCb = (completed: number, total: number) => {
            setImportProgress({ current: completed, total, phase: 'importing' });
          };
          const createdNotes = await createEncryptedNotesBatch(userId, notesToImport, keys, mdProgressCb);

          // Add tags to notes if any tags were present
          if (tagMap.size > 0) {
            setImportProgress({ current: 0, total: createdNotes.length, phase: 'finalizing' });
            for (let i = 0; i < createdNotes.length; i++) {
              const note = createdNotes[i];
              const originalTags = originalTagsMap.get(i) || [];
              for (const tagName of originalTags) {
                const tagId = tagMap.get(tagName);
                if (tagId) {
                  await addTagToNoteOffline(userId, note.id, tagId, { preserveUpdatedAt: true });
                }
              }
              setImportProgress({ current: i + 1, total: createdNotes.length, phase: 'finalizing' });
            }
          }

          // Refresh notes from IndexedDB
          const refreshedNotes2 = await fetchDecryptedNotes(userId, keys);
          setNotes(refreshedNotes2);

          toast.success(`Successfully imported ${createdNotes.length} note${createdNotes.length === 1 ? '' : 's'}`);
        } else {
          // Import single markdown file as a note
          setImportProgress({ current: 0, total: 1, phase: 'importing' });

          const lines = content.split('\n');
          let title = file.name.replace(/\.(md|markdown)$/, '');
          let noteContent = content;
          let noteTags: string[] = [];
          let contentStartIndex = 0;

          // Extract title from first H1 if present
          if (lines[0]?.startsWith('# ')) {
            title = lines[0].substring(2).trim();
            contentStartIndex = 1;
          }

          // Check for Tags line (e.g., "Tags: tag1, tag2")
          const nextLine = lines[contentStartIndex]?.trim();
          if (nextLine?.startsWith('Tags:')) {
            const tagsStr = nextLine.substring(5).trim();
            noteTags = tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
            contentStartIndex++;
          }

          // Skip empty line after tags if present
          if (lines[contentStartIndex]?.trim() === '') {
            contentStartIndex++;
          }

          noteContent = lines.slice(contentStartIndex).join('\n').trim();

          // Create tag map (create missing tags)
          const tagMap = new Map<string, string>();
          for (const tagName of noteTags) {
            const existingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
            if (existingTag) {
              tagMap.set(tagName, existingTag.id);
            } else {
              const newTag = await createTagOffline(userId, tagName, 'stone');
              tagMap.set(tagName, newTag.id);
              setTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
            }
          }

          // Convert markdown to HTML and sanitize
          const htmlContent = sanitizeHtml(markdownToHtml(noteContent));

          const newNote = await createEncryptedNote(userId, title, htmlContent, keys);

          // Add tags to the note
          for (const tagName of noteTags) {
            const tagId = tagMap.get(tagName);
            if (tagId) {
              await addTagToNoteOffline(userId, newNote.id, tagId, { preserveUpdatedAt: true });
            }
          }

          // Refresh from IndexedDB to get the note with tags
          const refreshedNotesAll = await fetchDecryptedNotes(userId, keys);
          setNotes(refreshedNotesAll);

          toast.success(`Imported "${title}"`);
        }
      } else {
        toast.error('Unsupported file format. Please use .json or .md files.');
      }
    } catch (error) {
      console.error('Import failed:', error);
      if (error instanceof ValidationError) {
        toast.error(`Import failed: ${error.message}`);
      } else {
        toast.error('Failed to import file. Please check the file format.');
      }
    } finally {
      setImportProgress(null);
    }
  }, [userId, tags, keys, setNotes, setTags]);

  // Declared after `handleImportFile` so it can call it directly. In App this needed a
  // ref, because the import handler sat two hundred lines below the backup one; here
  // they are neighbours and the ref goes away.
  const handleOpenBackup = useCallback(async (passphrase: string) => {
    const file = pendingBackupFile;
    if (!file) return;

    setIsOpeningBackup(true);
    setBackupRestoreError(null);
    try {
      const payload = await openEncryptedBackup(await readFileAsText(file), passphrase);
      setPendingBackupFile(null);
      await handleImportFile(file, payload);
    } catch (error) {
      // A damaged file and a wrong passphrase are different problems, and only one of
      // them is something the reader can do anything about. Say which.
      const message =
        error instanceof BackupFormatError || error instanceof BackupPassphraseError
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
