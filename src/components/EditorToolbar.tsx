import type { Editor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import {
  EDITOR_COMMANDS,
  EDITOR_COMMANDS_BY_ID,
  editorCommandTitle,
  type EditorCommandContext,
  type EditorCommandDefinition,
  type EditorCommandId,
} from '../editor/editorCommands';
import { getEditorMenuPosition, type EditorMenuDirection } from '../editor/editorMenuPosition';
import { useEditorTransactions } from '../editor/useEditorTransactions';

const PRIMARY_COMMANDS: readonly EditorCommandId[] = [
  'bold', 'italic', 'inlineCode', 'heading1', 'bulletList', 'undo', 'redo',
];

const WIDE_COMMANDS: readonly EditorCommandId[] = [
  'link', 'underline', 'strike', 'highlight', 'heading2', 'heading3',
  'orderedList', 'taskList', 'blockquote', 'codeBlock',
];

const SIDEBAR_COMMANDS: readonly EditorCommandId[] = [
  'bold', 'italic', 'inlineCode', 'heading1', 'bulletList', 'blockquote',
];

interface ToolbarButtonProps {
  command: EditorCommandDefinition;
  context: EditorCommandContext;
  menuItem?: boolean;
  onRun?: () => void;
}

function ToolbarButton({ command, context, menuItem = false, onRun }: ToolbarButtonProps) {
  const isActive = command.isActive?.(context) ?? false;
  const disabled = !(command.canRun?.(context) ?? true);
  const title = editorCommandTitle(command);

  return (
    <button
      type="button"
      onClick={() => {
        command.run(context);
        onRun?.();
      }}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={command.isActive ? isActive : undefined}
      role={menuItem ? 'menuitem' : undefined}
      className={menuItem ? 'editor-command-menu-item' : 'editor-command-button'}
      data-command-id={command.id}
      data-active={isActive || undefined}
    >
      <span className="editor-command-icon" aria-hidden="true">{command.shortLabel}</span>
      {menuItem && (
        <span className="editor-command-menu-copy">
          <span>{command.label}</span>
          <span>{command.description}</span>
        </span>
      )}
      {menuItem && command.shortcut && <kbd>{command.shortcut}</kbd>}
    </button>
  );
}

interface OverflowMenuProps {
  context: EditorCommandContext;
  direction: EditorMenuDirection;
}

function OverflowMenu({ context, direction }: OverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    const positionPanel = () => {
      if (!triggerRef.current || !panelRef.current) return;
      const position = getEditorMenuPosition(
        triggerRef.current.getBoundingClientRect(),
        panelRef.current.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
        direction,
      );
      Object.assign(panelRef.current.style, {
        position: 'fixed',
        left: `${position.left}px`,
        top: `${position.top}px`,
        right: 'auto',
        bottom: 'auto',
        maxHeight: `${position.maxHeight}px`,
      });
      panelRef.current.dataset.placement = position.placement;
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('scroll', positionPanel, true);
    window.addEventListener('resize', positionPanel);
    positionPanel();
    const frame = requestAnimationFrame(() => {
      positionPanel();
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('scroll', positionPanel, true);
      window.removeEventListener('resize', positionPanel);
    };
  }, [direction, isOpen]);

  return (
    <div className="editor-command-overflow" ref={menuRef} data-direction={direction}>
      <button
        ref={triggerRef}
        type="button"
        className="editor-command-button"
        aria-label="More editor commands"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        data-active={isOpen || undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {isOpen && (
        <div
          ref={panelRef}
          className="editor-command-menu"
          role="menu"
          aria-label="All editor commands"
          onKeyDown={(event) => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
            const current = items.indexOf(document.activeElement as HTMLButtonElement);
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            items[(current + delta + items.length) % items.length]?.focus();
          }}
        >
          {EDITOR_COMMANDS.map((command) => (
            <ToolbarButton
              key={command.id}
              command={command}
              context={context}
              menuItem
              onRun={() => setIsOpen(false)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export interface EditorToolbarProps {
  editor: Editor | null;
  variant?: 'inline' | 'bottom' | 'sidebar';
  isFocusMode?: boolean;
  onFindReplace?: () => void;
  onToggleFocusMode?: () => void;
  onLink?: () => void;
}

export function EditorToolbar({
  editor,
  variant = 'inline',
  isFocusMode,
  onFindReplace,
  onToggleFocusMode,
  onLink,
}: EditorToolbarProps) {
  useEditorTransactions(editor);

  if (!editor) return <div className="editor-command-toolbar" data-variant={variant} aria-hidden="true" />;

  const context: EditorCommandContext = {
    editor,
    isFocusMode,
    onFindReplace,
    onToggleFocusMode,
    onLink,
  };
  const visibleIds = variant === 'sidebar' ? SIDEBAR_COMMANDS : PRIMARY_COMMANDS;
  const overflowDirection = variant === 'bottom' ? 'up' : variant === 'sidebar' ? 'right' : 'down';

  return (
    <div
      className="editor-command-toolbar"
      data-variant={variant}
      role="toolbar"
      aria-label="Formatting and editor commands"
      aria-orientation={variant === 'sidebar' ? 'vertical' : 'horizontal'}
    >
      {visibleIds.map((id) => {
        const command = EDITOR_COMMANDS_BY_ID.get(id);
        return command ? <ToolbarButton key={id} command={command} context={context} /> : null;
      })}
      {variant === 'inline' && WIDE_COMMANDS.map((id) => {
        const command = EDITOR_COMMANDS_BY_ID.get(id);
        return command ? (
          <span className="editor-command-wide" key={id}>
            <ToolbarButton command={command} context={context} />
          </span>
        ) : null;
      })}
      <OverflowMenu context={context} direction={overflowDirection} />
    </div>
  );
}
