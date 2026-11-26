import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../utils/sanitize';
import { EDITOR_COMMANDS, EDITOR_COMMANDS_BY_ID, MENU_EDITOR_COMMANDS, SLASH_EDITOR_COMMANDS } from './editorCommands';

describe('editor history commands', () => {
  it('excludes history commands from slash without removing their toolbar definitions', () => {
    expect(EDITOR_COMMANDS.map(({ id }) => id)).toEqual(expect.arrayContaining(['undo', 'redo']));
    expect(SLASH_EDITOR_COMMANDS.map(({ id }) => id)).not.toEqual(expect.arrayContaining(['undo', 'redo']));
    expect(SLASH_EDITOR_COMMANDS).toHaveLength(EDITOR_COMMANDS.length - 2);
  });

  it('keeps Undo and Redo functional outside the slash palette', () => {
    const editor = new Editor({ extensions: [StarterKit], content: '<p>alpha</p>' });
    editor.commands.insertContentAt(6, ' beta');

    EDITOR_COMMANDS_BY_ID.get('undo')!.run({ editor });
    expect(editor.getText()).toBe('alpha');

    EDITOR_COMMANDS_BY_ID.get('redo')!.run({ editor });
    expect(editor.getText()).toBe('alpha beta');
    editor.destroy();
  });
});

describe('alignment and insert commands', () => {
  const alignedEditor = (content: string) => new Editor({
    extensions: [StarterKit, TextAlign.configure({ types: ['heading', 'paragraph'] })],
    content,
  });

  it('offers only Centre, as a toggle that leaves no style attribute when run twice', () => {
    const editor = alignedEditor('<p>alpha</p>');
    const center = EDITOR_COMMANDS_BY_ID.get('alignCenter')!;
    center.run({ editor });
    expect(editor.getHTML()).toBe('<p style="text-align: center;">alpha</p>');
    expect(center.isActive!({ editor })).toBe(true);
    center.run({ editor });
    expect(editor.getHTML()).toBe('<p>alpha</p>');
    editor.destroy();
  });

  it('keeps justified, right and left alignment from old notes through load and save', () => {
    const html = '<p style="text-align: justify;">one</p><p style="text-align: right;">two</p>';
    const editor = alignedEditor(sanitizeHtml(html));
    // What autosave stores is getHTML(); it must carry the alignment unchanged.
    expect(editor.getHTML()).toBe(html);
    expect(sanitizeHtml(editor.getHTML())).toBe(html);
    editor.destroy();
  });

  it('keeps the TextAlign shortcuts for the alignments the menus no longer list', () => {
    const editor = alignedEditor('<p>alpha</p>');
    editor.commands.focus();
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, shiftKey: true, bubbles: true }));
    expect(editor.getHTML()).toBe('<p style="text-align: justify;">alpha</p>');
    editor.destroy();
  });

  it('drops left, right, justify, time and the smart typography toggle from every menu', () => {
    const ids = EDITOR_COMMANDS.map(({ id }) => id as string);
    for (const gone of ['alignLeft', 'alignRight', 'alignJustify', 'time', 'smartTypography']) {
      expect(ids).not.toContain(gone);
    }
  });

  it('keeps date and now in the slash menu only, and focus mode out of ⋯', () => {
    const slash = SLASH_EDITOR_COMMANDS.map(({ id }) => id);
    const menu = MENU_EDITOR_COMMANDS.map(({ id }) => id);
    expect(slash).toEqual(expect.arrayContaining(['date', 'now', 'inlineCode', 'codeBlock', 'alignCenter', 'focusMode']));
    expect(menu).not.toEqual(expect.arrayContaining(['date']));
    expect(menu).not.toContain('now');
    expect(menu).not.toContain('focusMode');
  });
});
