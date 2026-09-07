import type { Editor } from '@tiptap/react';
import { useEffect, useReducer } from 'react';

/** Re-render command surfaces whenever Tiptap state changes. */
export function useEditorTransactions(editor: Editor | null): void {
  const [, refresh] = useReducer((revision: number) => revision + 1, 0);

  useEffect(() => {
    if (!editor || typeof editor.on !== 'function' || typeof editor.off !== 'function') return;

    const handleTransaction = () => refresh();
    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor]);
}
