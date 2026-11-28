// The Smart typography preference, apart from the Tiptap extension that reads it.
// Settings imports this file. It must not import Tiptap: if it did, opening Settings
// would download Tiptap and ProseMirror (scripts/check-bundle-budget.mjs checks this).

const SMART_TYPOGRAPHY_STORAGE_KEY = 'yidhan:editor:smart-typography';

/** Fired on window when Settings changes the preference, so an open editor follows. */
export const SMART_TYPOGRAPHY_CHANGE_EVENT = 'yidhan:smart-typography-change';

export function loadSmartTypographyPreference(): boolean {
  try {
    return localStorage.getItem(SMART_TYPOGRAPHY_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function persistSmartTypographyPreference(enabled: boolean): void {
  try {
    localStorage.setItem(SMART_TYPOGRAPHY_STORAGE_KEY, String(enabled));
  } catch {
    // The setting still applies for this editor session when storage is unavailable.
  }
}

/** Settings → Editor writes the preference here. Every open editor picks it up. */
export function setSmartTypographyPreference(enabled: boolean): void {
  persistSmartTypographyPreference(enabled);
  window.dispatchEvent(new CustomEvent<boolean>(SMART_TYPOGRAPHY_CHANGE_EVENT, { detail: enabled }));
}
