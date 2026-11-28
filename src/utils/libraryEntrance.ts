/**
 * Session-scoped flag recording whether the library has already painted notes
 * once in this page session. Returning from a note remounts ChapteredLibrary;
 * skipping the entrance stagger on subsequent mounts keeps back-navigation immediate.
 */
let libraryHasPaintedInSession = false;

export function hasLibraryPaintedInSession(): boolean {
  return libraryHasPaintedInSession;
}

export function markLibraryPaintedInSession(): void {
  libraryHasPaintedInSession = true;
}

export function resetLibraryEntranceForTests(): void {
  libraryHasPaintedInSession = false;
}
