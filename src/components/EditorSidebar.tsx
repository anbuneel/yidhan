import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { EditorToolbar } from './EditorToolbar';

interface EditorSidebarProps {
  editor: Editor | null;
  isFocusMode?: boolean;
  onFindReplace?: () => void;
  onToggleFocusMode?: () => void;
  onLink?: () => void;
}

/** Typing in the note body or the title. Not a search box, a dialog or a tag field. */
function isWritingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('.ProseMirror, [aria-label="Note title"]') !== null;
}

export function EditorSidebar(props: EditorSidebarProps) {
  const ref = useRef<HTMLElement>(null);
  const hasEditor = props.editor !== null;

  // The rail fades while the writer types and returns when they reach for it. A data
  // attribute on a ref, not state: no re-render per keystroke.
  useEffect(() => {
    if (!hasEditor) return;
    const quiet = (on: boolean) => {
      const el = ref.current;
      if (!el) return;
      if (on) el.dataset.quiet = '';
      else delete el.dataset.quiet;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // A shortcut is a reach for a command, not typing.
      if (e.ctrlKey || e.metaKey || e.altKey) return quiet(false);
      if (isWritingTarget(e.target)) quiet(true);
    };
    const onPointerMove = () => quiet(false);
    const onSelectionChange = () => {
      const selection = document.getSelection();
      if (selection && !selection.isCollapsed) quiet(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [hasEditor]);

  if (!props.editor) return null;

  return (
    <aside ref={ref} className="editor-sidebar focus-mode-target" aria-label="Editor command sidebar">
      <EditorToolbar {...props} variant="sidebar" />
    </aside>
  );
}
