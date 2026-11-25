import type { Editor } from '@tiptap/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

function isElementVisible(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  if (typeof element.checkVisibility === 'function') {
    return element.checkVisibility();
  }
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

function OverflowMenu({ context, direction }: OverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closedByFocusModeRef = useRef(false);

  // Close immediately when focus mode hides the toolbars (e.g. Ctrl+Shift+F).
  if (isOpen && context.isFocusMode) {
    closedByFocusModeRef.current = true;
    setIsOpen(false);
  }

  useLayoutEffect(() => {
    if (!isOpen) {
      if (closedByFocusModeRef.current) {
        closedByFocusModeRef.current = false;
        context.editor.commands.focus(null, { scrollIntoView: false });
      }
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (menuRef.current?.contains(target) || panelRef.current?.contains(target))) {
        return;
      }
      setIsOpen(false);
    };
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as Node | null;
      if (target && (menuRef.current?.contains(target) || panelRef.current?.contains(target))) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    const syncPosition = () => {
      if (!triggerRef.current || !panelRef.current) return;
      const panel = panelRef.current;
      const savedScrollTop = panel.scrollTop;
      // Reset any prior viewport-capped maxHeight before measuring so a growing viewport
      // measures the natural menu height instead of a stale short-viewport cap.
      panel.style.maxHeight = '34rem';
      const position = getEditorMenuPosition(
        triggerRef.current.getBoundingClientRect(),
        panel.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
        direction,
      );
      const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      const cappedMaxHeight = Math.min(34 * rootFontSize, position.maxHeight);
      Object.assign(panel.style, {
        position: 'fixed',
        left: `${position.left}px`,
        top: `${position.top}px`,
        right: 'auto',
        bottom: 'auto',
        maxHeight: `${cappedMaxHeight}px`,
      });
      panel.dataset.placement = position.placement;
      if (panel.scrollTop !== savedScrollTop) {
        panel.scrollTop = savedScrollTop;
      }
    };
    const positionPanel = () => {
      if (!triggerRef.current || !panelRef.current) return;
      if (!isElementVisible(triggerRef.current)) {
        setIsOpen(false);
        return;
      }
      syncPosition();
    };
    const handleScroll = (event: Event) => {
      const target = event.target as Node | null;
      // Scrolling inside the menu itself must not re-measure or reset scrollTop.
      if (target && panelRef.current?.contains(target)) return;
      positionPanel();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', positionPanel);
    syncPosition();
    const frame = requestAnimationFrame(() => {
      positionPanel();
      panelRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', positionPanel);
    };
  }, [context.editor, direction, isOpen]);

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
        onClick={() => {
          if (context.isFocusMode) return;
          setIsOpen((open) => !open);
        }}
      >
        <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {isOpen && createPortal(
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
        </div>,
        document.body,
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
  const focusModeCommand = EDITOR_COMMANDS_BY_ID.get('focusMode');
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
      {focusModeCommand && <ToolbarButton command={focusModeCommand} context={context} />}
      <OverflowMenu context={context} direction={overflowDirection} />
    </div>
  );
}
