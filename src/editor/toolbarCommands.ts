import {
  EDITOR_COMMAND_GROUPS,
  MENU_EDITOR_COMMANDS,
  type EditorCommandDefinition,
  type EditorCommandId,
} from './editorCommands';

export type ToolbarVariant = 'inline' | 'bottom' | 'sidebar';

/** The row on every toolbar, at every width. Focus mode and ⋯ follow it. */
export const ROW_COMMANDS: readonly EditorCommandId[] = [
  'bold', 'italic', 'heading1', 'bulletList', 'link',
];

/** The phone bar also keeps Undo and Redo. Under 380px CSS hides them from the bar,
 *  so the ⋯ menu keeps them too and CSS shows them there only at that width. */
const BOTTOM_ROW_COMMANDS: readonly EditorCommandId[] = [...ROW_COMMANDS, 'undo', 'redo'];
const NARROW_FALLBACK_COMMANDS: ReadonlySet<EditorCommandId> = new Set(['undo', 'redo']);

export function rowCommandsFor(variant: ToolbarVariant): readonly EditorCommandId[] {
  return variant === 'bottom' ? BOTTOM_ROW_COMMANDS : ROW_COMMANDS;
}

export interface MenuGroup {
  id: string;
  label: string;
  commands: { command: EditorCommandDefinition; narrowOnly: boolean }[];
}

/** The ⋯ menu lists only commands that are not in this toolbar's row, under headings. */
export function overflowMenuGroups(variant: ToolbarVariant): MenuGroup[] {
  const row = new Set(rowCommandsFor(variant));
  return EDITOR_COMMAND_GROUPS.map(({ id, label }) => ({
    id,
    label,
    commands: MENU_EDITOR_COMMANDS
      .filter((command) => command.group === id)
      .filter((command) => !row.has(command.id) || (variant === 'bottom' && NARROW_FALLBACK_COMMANDS.has(command.id)))
      .map((command) => ({ command, narrowOnly: row.has(command.id) })),
  })).filter((group) => group.commands.length > 0);
}
