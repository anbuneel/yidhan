import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled])';

interface UseMenuButtonOptions {
  /** Shared by the trigger's aria-controls and the menu's id. */
  menuId: string;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

/**
 * Keyboard behaviour for a WAI-ARIA menu button.
 *
 * - Opening the menu focuses its first item (ArrowUp on the trigger: the last).
 * - ArrowUp/ArrowDown wrap through the items; Home and End jump to the ends.
 * - Escape closes the menu and returns focus to the trigger. It is consumed, so
 *   window-level Escape handlers (closing the editor, a dialog behind) do not run.
 * - Choosing an item returns focus to the trigger unless something else took it.
 * - Tab closes the menu and lets focus move on.
 */
export function useMenuButton({ menuId, isOpen, setOpen }: UseMenuButtonOptions) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusOnOpenRef = useRef<'first' | 'last'>('first');
  const returnFocusRef = useRef(false);

  const items = useCallback(
    () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []),
    [],
  );

  useEffect(() => {
    if (isOpen) {
      const list = items();
      const target = focusOnOpenRef.current === 'last' ? list[list.length - 1] : list[0];
      focusOnOpenRef.current = 'first';
      target?.focus();
      return;
    }
    if (!returnFocusRef.current) return;
    returnFocusRef.current = false;
    // Only reclaim focus that was lost with the menu. A dialog an item opened keeps it.
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) {
      triggerRef.current?.focus();
    }
  }, [isOpen, items]);

  const closeAndReturnFocus = useCallback(() => {
    returnFocusRef.current = true;
    setOpen(false);
  }, [setOpen]);

  const onTriggerKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusOnOpenRef.current = event.key === 'ArrowUp' ? 'last' : 'first';
      if (isOpen) {
        const list = items();
        (event.key === 'ArrowUp' ? list[list.length - 1] : list[0])?.focus();
      } else {
        setOpen(true);
      }
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      closeAndReturnFocus();
    }
  }, [closeAndReturnFocus, isOpen, items, setOpen]);

  const onMenuKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    let next: HTMLElement | undefined;
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        closeAndReturnFocus();
        return;
      case 'Tab':
        setOpen(false);
        return;
      case 'ArrowDown':
        next = list[(index + 1) % list.length];
        break;
      case 'ArrowUp':
        next = index === -1 ? list[list.length - 1] : list[(index - 1 + list.length) % list.length];
        break;
      case 'Home':
        next = list[0];
        break;
      case 'End':
        next = list[list.length - 1];
        break;
      default:
        return;
    }
    event.preventDefault();
    next?.focus();
  }, [closeAndReturnFocus, items, setOpen]);

  // Clicks on items bubble here after the item's own handler has closed the menu.
  const onMenuClick = useCallback(() => {
    returnFocusRef.current = true;
  }, []);

  return {
    triggerProps: {
      ref: triggerRef,
      'aria-haspopup': 'menu' as const,
      'aria-expanded': isOpen,
      'aria-controls': isOpen ? menuId : undefined,
      onKeyDown: onTriggerKeyDown,
    },
    menuProps: {
      ref: menuRef,
      id: menuId,
      role: 'menu' as const,
      onKeyDown: onMenuKeyDown,
      onClick: onMenuClick,
    },
  };
}
