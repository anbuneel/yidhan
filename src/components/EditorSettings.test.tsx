import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SmartTypography } from '../editor/SmartTypography';
import { applyStoredTextSize, loadTextSize } from '../editor/textSize';
import { EditorSettings } from './EditorSettings';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.textSize;
});

afterEach(() => {
  delete document.documentElement.dataset.textSize;
});

describe('EditorSettings', () => {
  it('starts at the default size with no attribute on <html>', () => {
    render(<EditorSettings />);
    expect(screen.getByRole('radio', { name: 'Default' })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.dataset.textSize).toBeUndefined();
  });

  it('applies a chosen size at once and restores it after a reload', () => {
    render(<EditorSettings />);
    fireEvent.click(screen.getByRole('radio', { name: 'Large' }));
    expect(screen.getByRole('radio', { name: 'Large' })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.dataset.textSize).toBe('large');

    // A reload: the attribute is gone until startup applies the stored choice.
    delete document.documentElement.dataset.textSize;
    applyStoredTextSize();
    expect(document.documentElement.dataset.textSize).toBe('large');

    fireEvent.click(screen.getByRole('radio', { name: 'Default' }));
    expect(document.documentElement.dataset.textSize).toBeUndefined();
    expect(loadTextSize()).toBe('default');
  });

  it('ignores a stored value that is not one of the three sizes', () => {
    localStorage.setItem('yidhan:editor:text-size', 'huge');
    applyStoredTextSize();
    expect(document.documentElement.dataset.textSize).toBeUndefined();
    expect(loadTextSize()).toBe('default');
  });

  it('turns smart typography off in an editor that is already open', () => {
    const editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p></p>' });
    try {
      render(<EditorSettings />);
      const toggle = screen.getByRole('switch', { name: 'Smart typography' });
      expect(toggle).toHaveAttribute('aria-checked', 'true');

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(editor.storage.smartTypography.enabled).toBe(false);
      expect(localStorage.getItem('yidhan:editor:smart-typography')).toBe('false');

      fireEvent.click(toggle);
      expect(editor.storage.smartTypography.enabled).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it('stops following the setting once the editor is destroyed', () => {
    const editor = new Editor({ extensions: [StarterKit, SmartTypography], content: '<p></p>' });
    editor.destroy();
    render(<EditorSettings />);
    fireEvent.click(screen.getByRole('switch', { name: 'Smart typography' }));
    expect(editor.storage.smartTypography.enabled).toBe(true);
  });
});
