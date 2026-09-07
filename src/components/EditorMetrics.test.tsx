import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { calculateWritingMetrics } from '../editor/writingMetrics';
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

  it('reveals details on desktop hover and mobile tap', () => {
    const { rerender } = render(<EditorMetrics editor={metricsEditor('one two')} isMobile={false} />);
    const trigger = screen.getByRole('button', { name: /writing details/i });
    expect(screen.getByText(/2 words/)).not.toBeVisible();
    fireEvent.pointerEnter(trigger.parentElement!);
    expect(screen.getByText(/2 words/)).toBeVisible();
    fireEvent.pointerLeave(trigger.parentElement!);
    expect(screen.getByText(/2 words/)).not.toBeVisible();

    rerender(<EditorMetrics editor={metricsEditor('one two')} isMobile />);
    fireEvent.click(trigger);
    expect(screen.getByText(/2 words/)).toBeVisible();
  });
});
