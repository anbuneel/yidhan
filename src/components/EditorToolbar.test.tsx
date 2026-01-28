import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorToolbar } from './EditorToolbar';
import type { Editor } from '@tiptap/react';

// Mock useMobileDetect
vi.mock('../hooks/useMobileDetect', () => ({
  useMobileDetect: vi.fn().mockReturnValue(false),
}));

// Create a minimal mock editor
const createMockEditor = () => ({
  chain: () => ({
    focus: () => ({
      toggleBold: () => ({ run: vi.fn() }),
      toggleItalic: () => ({ run: vi.fn() }),
      toggleUnderline: () => ({ run: vi.fn() }),
      toggleStrike: () => ({ run: vi.fn() }),
      toggleHighlight: () => ({ run: vi.fn() }),
      toggleHeading: () => ({ run: vi.fn() }),
      toggleBulletList: () => ({ run: vi.fn() }),
      toggleOrderedList: () => ({ run: vi.fn() }),
      toggleTaskList: () => ({ run: vi.fn() }),
      toggleBlockquote: () => ({ run: vi.fn() }),
      toggleCodeBlock: () => ({ run: vi.fn() }),
      setHorizontalRule: () => ({ run: vi.fn() }),
      undo: () => ({ run: vi.fn() }),
      redo: () => ({ run: vi.fn() }),
    }),
  }),
  isActive: vi.fn().mockReturnValue(false),
  can: () => ({
    undo: vi.fn().mockReturnValue(true),
    redo: vi.fn().mockReturnValue(true),
  }),
} as unknown as Editor);

describe('EditorToolbar', () => {
  it('renders buttons with correct aria-labels', () => {
    const editor = createMockEditor();
    render(<EditorToolbar editor={editor} />);

    // Check for Bold button
    // We expect it to have aria-label matching the title
    const boldBtn = screen.getByTitle('Bold (Ctrl+B)');
    expect(boldBtn).toBeInTheDocument();
    expect(boldBtn).toHaveAttribute('aria-label', 'Bold (Ctrl+B)');

    // Check Italic button
    const italicBtn = screen.getByTitle('Italic (Ctrl+I)');
    expect(italicBtn).toBeInTheDocument();
    expect(italicBtn).toHaveAttribute('aria-label', 'Italic (Ctrl+I)');

    // Check Bullet List button
    const bulletListBtn = screen.getByTitle('Bullet List');
    expect(bulletListBtn).toBeInTheDocument();
    expect(bulletListBtn).toHaveAttribute('aria-label', 'Bullet List');
  });
});
