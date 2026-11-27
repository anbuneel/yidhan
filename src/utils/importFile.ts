/**
 * The body of an import (JSON, Markdown, or a decrypted `.yidhan` payload): parse,
 * write the notes and tags, then re-read the list. Loaded on demand by `useImport`,
 * which owns the checks before it and the error and progress handling around it.
 * Import this module only with `import()`: a static import would put it back in the
 * app shell.
 */
import type { Dispatch, SetStateAction } from 'react';
import toast from 'react-hot-toast';
import type { Tag, TagColor } from '../types';
import type { DerivedKeys } from '../lib/encryption';
import {
  parseImportedJSON,
  readFileAsText,
  markdownToHtml,
  parseMultiNoteMarkdown,
} from './exportImport';
import { sanitizeHtml } from './sanitize';
import { createEncryptedNote, createEncryptedNotesBatch } from '../services/encryptedNotes';
import { addTagToNoteOffline } from '../services/offlineNotes';
import { createTagOffline } from '../services/offlineTags';
import type { ImportProgress } from '../components/ImportProgressOverlay';

export interface ImportFileContext {
  userId: string;
  keys: DerivedKeys;
  tags: Tag[];
  setTags: Dispatch<SetStateAction<Tag[]>>;
  setImportProgress: Dispatch<SetStateAction<ImportProgress | null>>;
  /** Re-read the list once the notes are written. Reports its own failure. */
  reloadAfterImport: () => Promise<unknown>;
}

export async function importFile(
  file: File,
  decryptedBackup: string | undefined,
  { userId, keys, tags, setTags, setImportProgress, reloadAfterImport }: ImportFileContext,
): Promise<void> {
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
    await reloadAfterImport();

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

      // Success first, as in the JSON path: a failed re-read then reads as what it is.
      toast.success(`Successfully imported ${createdNotes.length} note${createdNotes.length === 1 ? '' : 's'}`);

      // Refresh notes from IndexedDB
      await reloadAfterImport();
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

      toast.success(`Imported "${title}"`);

      // Refresh from IndexedDB to get the note with tags
      await reloadAfterImport();
    }
  } else {
    toast.error('Unsupported file format. Please use .json or .md files.');
  }
}
