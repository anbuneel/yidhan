import type { Editor } from '@tiptap/react';
import type { Range } from '@tiptap/core';
import type { ReactNode } from 'react';

export type EditorCommandId =
  | 'bold' | 'italic' | 'underline' | 'strike' | 'inlineCode' | 'link' | 'highlight'
  | 'paragraph' | 'heading1' | 'heading2' | 'heading3'
  | 'bulletList' | 'orderedList' | 'taskList'
  | 'blockquote' | 'codeBlock' | 'horizontalRule'
  | 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify'
  | 'date' | 'time' | 'now'
  | 'undo' | 'redo' | 'findReplace' | 'smartTypography' | 'focusMode';

export type EditorCommandGroup = 'text' | 'structure' | 'insert' | 'history' | 'view';

export interface EditorCommandContext {
  editor: Editor;
  isFocusMode?: boolean;
  onFindReplace?: () => void;
  onLink?: () => void;
  onToggleFocusMode?: () => void;
}

export interface EditorCommandDefinition {
  id: EditorCommandId;
  label: string;
  shortLabel: ReactNode;
  description: string;
  searchTerms: string[];
  group: EditorCommandGroup;
  shortcut?: string;
  isActive?: (context: EditorCommandContext) => boolean;
  canRun?: (context: EditorCommandContext) => boolean;
  run: (context: EditorCommandContext, slashRange?: Range) => void;
}

function startChain(editor: Editor, range?: Range) {
  const chain = editor.chain().focus();
  return range ? chain.deleteRange(range) : chain;
}

function dispatchEditorAction(editor: Editor, action: 'link' | 'findReplace' | 'focusMode'): void {
  editor.view.dom.dispatchEvent(new CustomEvent('yidhan:editor-action', {
    bubbles: true,
    detail: { action },
  }));
}

function runExternalAction(
  context: EditorCommandContext,
  action: 'link' | 'findReplace' | 'focusMode',
  callback: (() => void) | undefined,
  range?: Range,
): void {
  if (range) context.editor.chain().focus().deleteRange(range).run();
  if (callback) callback();
  else dispatchEditorAction(context.editor, action);
}

function textLabel(text: string, className?: string): ReactNode {
  return <span className={className}>{text}</span>;
}

const shared = {
  text: ['format', 'style'],
  structure: ['block', 'layout'],
};

export const EDITOR_COMMANDS: readonly EditorCommandDefinition[] = [
  {
    id: 'bold', label: 'Bold', shortLabel: textLabel('B', 'font-semibold'),
    description: 'Emphasize text strongly', searchTerms: [...shared.text, 'strong'], group: 'text', shortcut: 'Ctrl+B',
    isActive: ({ editor }) => editor.isActive('bold'),
    run: ({ editor }, range) => { startChain(editor, range).toggleBold().run(); },
  },
  {
    id: 'italic', label: 'Italic', shortLabel: textLabel('I', 'italic'),
    description: 'Emphasize text gently', searchTerms: [...shared.text, 'emphasis'], group: 'text', shortcut: 'Ctrl+I',
    isActive: ({ editor }) => editor.isActive('italic'),
    run: ({ editor }, range) => { startChain(editor, range).toggleItalic().run(); },
  },
  {
    id: 'underline', label: 'Underline', shortLabel: textLabel('U', 'underline'),
    description: 'Underline selected text', searchTerms: shared.text, group: 'text', shortcut: 'Ctrl+U',
    isActive: ({ editor }) => editor.isActive('underline'),
    run: ({ editor }, range) => { startChain(editor, range).toggleUnderline().run(); },
  },
  {
    id: 'strike', label: 'Strikethrough', shortLabel: textLabel('S', 'line-through'),
    description: 'Cross out selected text', searchTerms: [...shared.text, 'strike'], group: 'text',
    isActive: ({ editor }) => editor.isActive('strike'),
    run: ({ editor }, range) => { startChain(editor, range).toggleStrike().run(); },
  },
  {
    id: 'inlineCode', label: 'Inline code', shortLabel: textLabel('</>', 'font-mono text-[10px]'),
    description: 'Format a short code fragment', searchTerms: ['code', 'monospace', 'inline'], group: 'text', shortcut: 'Ctrl+E',
    isActive: ({ editor }) => editor.isActive('code'),
    run: ({ editor }, range) => { startChain(editor, range).toggleCode().run(); },
  },
  {
    id: 'link', label: 'Link', shortLabel: textLabel('Link', 'text-[10px]'),
    description: 'Insert or edit a link', searchTerms: ['url', 'href'], group: 'text', shortcut: 'Ctrl+K',
    isActive: ({ editor }) => editor.isActive('link'),
    run: (context, range) => runExternalAction(context, 'link', context.onLink, range),
  },
  {
    id: 'highlight', label: 'Highlight', shortLabel: textLabel('Mark', 'text-[10px]'),
    description: 'Add a warm highlight', searchTerms: [...shared.text, 'mark', 'color'], group: 'text',
    isActive: ({ editor }) => editor.isActive('highlight'),
    run: ({ editor }, range) => { startChain(editor, range).toggleHighlight().run(); },
  },
  {
    id: 'paragraph', label: 'Paragraph', shortLabel: textLabel('P', 'text-xs'),
    description: 'Return to body text', searchTerms: [...shared.structure, 'body', 'plain'], group: 'structure',
    isActive: ({ editor }) => editor.isActive('paragraph'),
    run: ({ editor }, range) => { startChain(editor, range).setParagraph().run(); },
  },
  ...([1, 2, 3] as const).map((level): EditorCommandDefinition => ({
    id: `heading${level}`,
    label: `Heading ${level}`,
    shortLabel: textLabel(`H${level}`, 'text-[10px] font-semibold'),
    description: `${level === 1 ? 'Large' : level === 2 ? 'Medium' : 'Small'} section heading`,
    searchTerms: [...shared.structure, `h${level}`, 'heading'],
    group: 'structure',
    isActive: ({ editor }) => editor.isActive('heading', { level }),
    run: ({ editor }, range) => { startChain(editor, range).toggleHeading({ level }).run(); },
  })),
  {
    id: 'bulletList', label: 'Bullet list', shortLabel: textLabel('List', 'text-[10px]'),
    description: 'Create a bullet list', searchTerms: [...shared.structure, 'unordered'], group: 'structure',
    isActive: ({ editor }) => editor.isActive('bulletList'),
    run: ({ editor }, range) => { startChain(editor, range).toggleBulletList().run(); },
  },
  {
    id: 'orderedList', label: 'Numbered list', shortLabel: textLabel('1. List', 'text-[9px]'),
    description: 'Create a numbered list', searchTerms: [...shared.structure, 'ordered', 'number'], group: 'structure',
    isActive: ({ editor }) => editor.isActive('orderedList'),
    run: ({ editor }, range) => { startChain(editor, range).toggleOrderedList().run(); },
  },
  {
    id: 'taskList', label: 'Task list', shortLabel: textLabel('Task', 'text-[9px]'),
    description: 'Create a quiet checklist', searchTerms: [...shared.structure, 'todo', 'checkbox'], group: 'structure',
    isActive: ({ editor }) => editor.isActive('taskList'),
    run: ({ editor }, range) => { startChain(editor, range).toggleTaskList().run(); },
  },
  {
    id: 'blockquote', label: 'Quote', shortLabel: textLabel('Quote', 'text-[9px]'),
    description: 'Set text apart as a quote', searchTerms: [...shared.structure, 'blockquote'], group: 'structure',
    isActive: ({ editor }) => editor.isActive('blockquote'),
    run: ({ editor }, range) => { startChain(editor, range).toggleBlockquote().run(); },
  },
  {
    id: 'codeBlock', label: 'Code block', shortLabel: textLabel('Code', 'font-mono text-[9px]'),
    description: 'Create a code block', searchTerms: [...shared.structure, 'pre', 'snippet'], group: 'structure',
    isActive: ({ editor }) => editor.isActive('codeBlock'),
    run: ({ editor }, range) => { startChain(editor, range).toggleCodeBlock().run(); },
  },
  {
    id: 'horizontalRule', label: 'Divider', shortLabel: textLabel('Rule', 'text-[9px]'),
    description: 'Insert a horizontal divider', searchTerms: ['rule', 'line', 'separator'], group: 'insert',
    run: ({ editor }, range) => { startChain(editor, range).setHorizontalRule().run(); },
  },
  ...(['left', 'center', 'right', 'justify'] as const).map((alignment): EditorCommandDefinition => ({
    id: `align${alignment[0].toUpperCase()}${alignment.slice(1)}` as EditorCommandId,
    label: `Align ${alignment}`,
    shortLabel: textLabel(alignment === 'justify' ? 'Justify' : alignment[0].toUpperCase(), 'text-[9px]'),
    description: `${alignment[0].toUpperCase()}${alignment.slice(1)} align this block`,
    searchTerms: ['align', 'text', alignment],
    group: 'structure',
    isActive: ({ editor }) => editor.isActive({ textAlign: alignment }),
    run: ({ editor }, range) => { startChain(editor, range).setTextAlign(alignment).run(); },
  })),
  {
    id: 'date', label: 'Date', shortLabel: textLabel('Date', 'text-[9px]'),
    description: 'Insert the current date', searchTerms: ['today', 'day'], group: 'insert',
    run: ({ editor }, range) => { startChain(editor, range).insertContent(new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })).run(); },
  },
  {
    id: 'time', label: 'Time', shortLabel: textLabel('Time', 'text-[9px]'),
    description: 'Insert the current time', searchTerms: ['clock', 'hour'], group: 'insert',
    run: ({ editor }, range) => { startChain(editor, range).insertContent(new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })).run(); },
  },
  {
    id: 'now', label: 'Date and time', shortLabel: textLabel('Now', 'text-[9px]'),
    description: 'Insert the current date and time', searchTerms: ['now', 'timestamp'], group: 'insert',
    run: ({ editor }, range) => { startChain(editor, range).insertContent(new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })).run(); },
  },
  {
    id: 'undo', label: 'Undo', shortLabel: textLabel('Undo', 'text-[9px]'),
    description: 'Undo the last change', searchTerms: ['history', 'back'], group: 'history', shortcut: 'Ctrl+Z',
    canRun: ({ editor }) => editor.can().undo(),
    run: ({ editor }, range) => { startChain(editor, range).undo().run(); },
  },
  {
    id: 'redo', label: 'Redo', shortLabel: textLabel('Redo', 'text-[9px]'),
    description: 'Redo the last undone change', searchTerms: ['history', 'forward'], group: 'history', shortcut: 'Ctrl+Shift+Z',
    canRun: ({ editor }) => editor.can().redo(),
    run: ({ editor }, range) => { startChain(editor, range).redo().run(); },
  },
  {
    id: 'findReplace', label: 'Find and replace', shortLabel: textLabel('Find', 'text-[9px]'),
    description: 'Find words in this note', searchTerms: ['search', 'replace'], group: 'view', shortcut: 'Ctrl+F',
    run: (context, range) => runExternalAction(context, 'findReplace', context.onFindReplace, range),
  },
  {
    id: 'smartTypography', label: 'Smart typography', shortLabel: textLabel('“ ”', 'text-xs'),
    description: 'Shape quotes, dashes, and ellipses as you type', searchTerms: ['quotes', 'dash', 'ellipsis'], group: 'view',
    isActive: ({ editor }) => editor.storage.smartTypography?.enabled ?? true,
    run: ({ editor }, range) => {
      if (range) editor.chain().focus().deleteRange(range).run();
      editor.commands.toggleSmartTypography();
    },
  },
  {
    id: 'focusMode', label: 'Focus mode', shortLabel: textLabel('Focus', 'text-[9px]'),
    description: 'Let the page recede while you write', searchTerms: ['distraction', 'view'], group: 'view', shortcut: 'Ctrl+Shift+F',
    isActive: ({ isFocusMode }) => Boolean(isFocusMode),
    run: (context, range) => runExternalAction(context, 'focusMode', context.onToggleFocusMode, range),
  },
];

export const EDITOR_COMMANDS_BY_ID = new Map(EDITOR_COMMANDS.map((command) => [command.id, command]));

export function editorCommandTitle(command: EditorCommandDefinition): string {
  return command.shortcut ? `${command.label} (${command.shortcut})` : command.label;
}
