import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearFind,
  getFindReplaceState,
  moveFindMatch,
  replaceAllMatches,
  replaceCurrentMatch,
  setFindQuery,
} from '../editor/FindReplace';
import { useEditorTransactions } from '../editor/useEditorTransactions';

interface FindReplacePanelProps {
  editor: Editor;
  onClose: () => void;
}

function scrollActiveMatchIntoView(): void {
  requestAnimationFrame(() => {
    document.querySelector('.editor-find-match-active')?.scrollIntoView({ block: 'center' });
  });
}

export function FindReplacePanel({ editor, onClose }: FindReplacePanelProps) {
  const [query, setQuery] = useState(() => getFindReplaceState(editor).query);
  const [replacement, setReplacement] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const findInputRef = useRef<HTMLInputElement>(null);
  useEditorTransactions(editor);

  const findState = getFindReplaceState(editor);

  useEffect(() => {
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, []);

  const close = useCallback(() => {
    clearFind(editor);
    onClose();
    editor.commands.focus();
  }, [editor, onClose]);

  /**
   * Escape closes the panel from anywhere, not only from inside it.
   *
   * This panel is modeless: the reader clicks back into the note between searches, and
   * that is the normal way to use it. While it is open the editor's own Escape handler
   * stands down — it checks `showFindReplace`, and independently sees this element's
   * `data-editor-popover` — so a handler scoped to the panel's own subtree left Escape
   * doing nothing at all once focus moved into the note: the panel would not close, and
   * save-and-return would not run. The editor's primary exit was dead until the reader
   * found the ✕ with a mouse.
   */
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [close]);

  const move = (delta: 1 | -1) => {
    moveFindMatch(editor, delta);
    scrollActiveMatchIntoView();
  };

  return (
    <section
      className="editor-find-panel"
      aria-label="Find and replace"
      data-editor-popover="find-replace"
    >
      <div className="editor-find-fields">
        <label>
          <span className="sr-only">Find</span>
          <input
            ref={findInputRef}
            value={query}
            placeholder="Find"
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              setFindQuery(editor, value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                move(event.shiftKey ? -1 : 1);
              }
            }}
          />
        </label>
        <label>
          <span className="sr-only">Replace with</span>
          <input
            value={replacement}
            placeholder="Replace with"
            onChange={(event) => setReplacement(event.target.value)}
          />
        </label>
      </div>
      <span className="editor-find-count" aria-live="polite">
        {findState.matches.length === 0 ? 'No matches' : `${findState.activeIndex + 1} of ${findState.matches.length}`}
      </span>
      <div className="editor-find-actions">
        <button type="button" aria-label="Previous match" disabled={findState.matches.length === 0} onClick={() => move(-1)}>
          <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" /></svg>
        </button>
        <button type="button" aria-label="Next match" disabled={findState.matches.length === 0} onClick={() => move(1)}>
          <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" /></svg>
        </button>
        <button type="button" disabled={findState.matches.length === 0} onClick={() => {
          if (replaceCurrentMatch(editor, replacement)) setAnnouncement('Replaced current match');
        }}>Replace</button>
        <button type="button" disabled={findState.matches.length === 0} onClick={() => {
          const count = replaceAllMatches(editor, replacement);
          setAnnouncement(`Replaced ${count} ${count === 1 ? 'match' : 'matches'}`);
        }}>Replace all</button>
        <button type="button" aria-label="Close find and replace" onClick={close}>
          <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <output className="sr-only" aria-live="polite">{announcement}</output>
    </section>
  );
}
