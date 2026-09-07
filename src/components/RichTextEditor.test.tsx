import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { RichTextEditor } from './RichTextEditor';

describe('RichTextEditor extensions', () => {
  it('registers Underline once without a duplicate-name console warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ready = vi.fn<(editor: Editor) => void>();
    try {
      const view = render(<RichTextEditor content="<p><u>Underlined</u></p>" onChange={vi.fn()} onEditorReady={ready} />);
      await waitFor(() => expect(ready).toHaveBeenCalled());
      const editor = ready.mock.calls[0][0];
      expect(editor.extensionManager.extensions.filter(extension => extension.name === 'underline')).toHaveLength(1);
      expect(editor.getHTML()).toContain('<u>Underlined</u>');
      expect(warn.mock.calls.flat().join(' ')).not.toMatch(/duplicate extension names/i);
      view.unmount();
    } finally {
      warn.mockRestore();
    }
  });
});
