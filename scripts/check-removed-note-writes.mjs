import { readFileSync } from 'node:fs';
const removed = new Map([
  ['src/services/notes.ts', ["fetchNotes","createNote","createNotesBatch","updateNote","softDeleteNote","restoreNote","permanentDeleteNote","toggleNotePin","searchNotes","fetchFadedNotes","countFadedNotes"]],
  ['src/services/offlineNotes.ts', ["createNoteOffline","createNotesBatchOffline","updateNoteOffline"]],
]);
for (const [file, names] of removed) {
  const source = readFileSync(file, 'utf8');
  for (const name of names) if (new RegExp('export\\s+(?:async\\s+)?function\\s+' + name + '\\b').test(source)) throw new Error('Removed plaintext/unused API returned: ' + name);
}
console.log('Removed note API assertion passed');
