import type { Editor } from '@tiptap/react';
import { useState } from 'react';
import { useEditorTransactions } from '../editor/useEditorTransactions';
import { calculateWritingMetrics } from '../editor/writingMetrics';

interface EditorMetricsProps {
  editor: Editor | null;
  isMobile: boolean;
}

export function EditorMetrics({ editor, isMobile }: EditorMetricsProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  useEditorTransactions(editor);

  const doc = editor?.state?.doc;
  const text = doc?.textBetween(0, doc.content.size, ' ', ' ') ?? '';
  const metrics = calculateWritingMetrics(text);
  const summary = `${metrics.words} ${metrics.words === 1 ? 'word' : 'words'}, ${metrics.characters} ${metrics.characters === 1 ? 'character' : 'characters'}, ${metrics.readingMinutes || 'less than 1'} min read`;

  return (
    <span
      className="editor-metrics"
      data-revealed={isRevealed || undefined}
      onPointerEnter={() => { if (!isMobile) setIsRevealed(true); }}
      onPointerLeave={() => { if (!isMobile) setIsRevealed(false); }}
    >
      <button
        type="button"
        className="editor-metrics-trigger"
        aria-label={`Writing details: ${summary}`}
        aria-expanded={isRevealed}
        onClick={() => { if (isMobile) setIsRevealed((visible) => !visible); }}
        onFocus={() => { if (!isMobile) setIsRevealed(true); }}
        onBlur={() => setIsRevealed(false)}
      >
        <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12M6 9h12M6 14h7M6 19h9" />
        </svg>
        <span className="sr-only">Writing details</span>
      </button>
      <output className="editor-metrics-detail" hidden={!isRevealed} aria-live="polite">
        {metrics.words} {metrics.words === 1 ? 'word' : 'words'}
        <span aria-hidden="true"> · </span>
        {metrics.characters} {metrics.characters === 1 ? 'character' : 'characters'}
        <span aria-hidden="true"> · </span>
        {metrics.readingMinutes === 0 ? 'Less than 1 min read' : `${metrics.readingMinutes} min read`}
      </output>
    </span>
  );
}
