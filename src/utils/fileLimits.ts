// The two file checks the import picker makes before any export or import code has
// loaded. Their own module, so the app shell can check a file without the export and
// import code, which loads on the user's click (shell-size plan A5).

/** Largest file an import reads: 10 MB. */
export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

/** A `.yidhan` file is an encrypted backup and needs its passphrase first (item 38). */
export const BACKUP_FILE_EXTENSION = '.yidhan';
