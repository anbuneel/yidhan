import type { Editor } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';

/**
 * Replaces the editor's document and starts undo history afresh. Emits no update,
 * so it does not trigger an autosave.
 *
 * Used for text that did not come from the writer's typing here: another note on a
 * switch, or another device's edit to the open note (issue #284). Undo must not
 * reach past it. `addToHistory: false` alone is not enough: an earlier undo step that
 * starts at the very start of the document survives mapping through a whole-document
 * replacement, and undoing it puts the replaced text back.
 *
 * Never use it for the writer's own edits: it removes their undo history.
 */
export function replaceContentWithFreshHistory(editor: Editor, content: string): void {
  // setContent fails only when Tiptap's enableContentCheck rejects the content, and
  // this app does not turn it on. Callers then mark the content as on screen.
  editor.commands.setContent(content, { emitUpdate: false });
  const { doc, plugins, selection } = editor.state;
  editor.view.updateState(EditorState.create({ doc, plugins, selection }));
  // Tell transaction listeners (toolbar undo state, metrics) without changing the
  // document or adding a history entry.
  editor.view.dispatch(editor.state.tr.setMeta('addToHistory', false));
}
