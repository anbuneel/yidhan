import type { Editor } from '@tiptap/react';
import { EditorToolbar } from './EditorToolbar';

interface EditorSidebarProps {
  editor: Editor | null;
  isFocusMode?: boolean;
  onFindReplace?: () => void;
  onToggleFocusMode?: () => void;
  onLink?: () => void;
}

export function EditorSidebar(props: EditorSidebarProps) {
  if (!props.editor) return null;

  return (
    <aside className="editor-sidebar focus-mode-target" aria-label="Editor command sidebar">
      <EditorToolbar {...props} variant="sidebar" />
    </aside>
  );
}
