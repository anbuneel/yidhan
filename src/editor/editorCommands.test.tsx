import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';
import { EDITOR_COMMANDS, EDITOR_COMMANDS_BY_ID, SLASH_EDITOR_COMMANDS } from './editorCommands';

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
