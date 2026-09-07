import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { Editor as CoreEditor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { calculateDocumentWritingMetrics, calculateWritingMetrics } from '../editor/writingMetrics';
import { EditorMetrics } from './EditorMetrics';

function metricsEditor(text: string): Editor {
  return {
    state: { doc: { content: { size: text.length }, textBetween: () => text } },
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as Editor;
}

describe('EditorMetrics', () => {
  it('counts Unicode characters, words, and reading time', () => {
    expect(calculateWritingMetrics('A calm note 🌱')).toEqual({ words: 4, characters: 13, readingMinutes: 1 });
  });

  it('does not count structural separators between empty paragraphs as characters', () => {
    const editor = new CoreEditor({
      extensions: [StarterKit],
      content: '<p></p><p></p><p></p>',
    });
    expect(editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ')).toBe('  ');
    expect(calculateDocumentWritingMetrics(editor.state.doc)).toEqual({
      words: 0,
      characters: 0,
      readingMinutes: 0,
    });
    editor.destroy();
  });

  it('reveals details on desktop hover and keeps the first mobile focus-then-click tap open', () => {
    const { rerender } = render(<EditorMetrics editor={metricsEditor('one two')} isMobile={false} />);
    const trigger = screen.getByRole('button', { name: /writing details/i });
    expect(screen.getByText(/2 words/)).not.toBeVisible();
    fireEvent.pointerEnter(trigger.parentElement!);
    expect(screen.getByText(/2 words/)).toBeVisible();
    fireEvent.pointerLeave(trigger.parentElement!);
    expect(screen.getByText(/2 words/)).not.toBeVisible();

    rerender(<EditorMetrics editor={metricsEditor('one two')} isMobile />);
    fireEvent.focus(trigger);
    expect(screen.getByText(/2 words/)).not.toBeVisible();
    fireEvent.click(trigger);
    expect(screen.getByText(/2 words/)).toBeVisible();
    fireEvent.blur(trigger);
    expect(screen.getByText(/2 words/)).not.toBeVisible();
  });
});
