/**
 * The new-note keys (item 44), shared by the library and the editor.
 *
 * Ctrl+Alt+N, or Cmd+Option+N on a Mac, works in a browser tab: neither the browsers
 * nor Tiptap bind it. Cmd/Ctrl+N reaches the page only in the installed app; a tab
 * keeps it for a new window.
 */

/** Ctrl+Alt+N, or Cmd+Option+N. */
export function isModAltN(e: KeyboardEvent): boolean {
  if (!e.altKey || e.shiftKey) return false;
  // Option changes `key` on a Mac, so the Mac test reads `code`. Elsewhere Ctrl+Alt is
  // also AltGr, which types letters on some layouts. Those arrive with another `key`
  // and pass through to the text.
  return e.metaKey ? e.code === 'KeyN' : e.ctrlKey && e.key.toLowerCase() === 'n';
}

/** Cmd/Ctrl+N with no other modifier. */
export function isModN(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key === 'n';
}

/**
 * A field outside the note: the tag input, find and replace, a link field. Typing in
 * the note's title or body does not block the shortcut; typing anywhere else does.
 */
export function isFieldOutsideNote(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const isField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' || target.isContentEditable;
  return isField && target.closest('.ProseMirror, .editor-title') === null;
}
