import { useEffect, useEffectEvent, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TEMPLATE']);

interface ModalStackEntry {
  id: symbol;
  dialogEl: HTMLElement;
  opener: HTMLElement | null;
  fallbackOpener: HTMLElement | null;
  onEscape: () => void;
  canEscape: () => boolean;
}

interface SavedInertState {
  hadInertAttr: boolean;
  prevAriaHidden: string | null;
}

const modalStack: ModalStackEntry[] = [];
const managedInert = new Map<HTMLElement, SavedInertState>();
const managedAriaModal = new Map<HTMLElement, string>();
let listenerAttached = false;
let backgroundObserver: MutationObserver | null = null;

function isVisibleAndActive(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled') || el.hasAttribute('hidden')) return false;
  if (el.closest('[hidden], [inert]')) return false;

  if (el.tagName === 'SUMMARY' && el.parentElement?.tagName !== 'DETAILS') return false;

  // Elements inside a closed <details> (other than its direct <summary>) cannot take focus.
  let ancestor = el.parentElement;
  while (ancestor) {
    if (ancestor.tagName === 'DETAILS' && !ancestor.hasAttribute('open')) {
      const isDirectSummary = el.tagName === 'SUMMARY' && el.parentElement === ancestor;
      if (!isDirectSummary) return false;
    }
    ancestor = ancestor.parentElement;
  }

  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function isTabbable(el: HTMLElement): boolean {
  return el.tabIndex >= 0 && isVisibleAndActive(el);
}

function canProgrammaticallyFocus(el: HTMLElement): boolean {
  return (el.tabIndex >= 0 || el.hasAttribute('tabindex')) && isVisibleAndActive(el);
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isTabbable);
}

function getTopEntry(): ModalStackEntry | undefined {
  return modalStack[modalStack.length - 1];
}

function focusInside(dialogEl: HTMLElement, preferred?: HTMLElement | null): void {
  if (preferred && dialogEl.contains(preferred) && canProgrammaticallyFocus(preferred)) {
    preferred.focus();
    return;
  }
  if (dialogEl.contains(document.activeElement)) return;
  const firstFocusable = getFocusableElements(dialogEl)[0];
  if (firstFocusable) {
    firstFocusable.focus();
  } else {
    if (!dialogEl.hasAttribute('tabindex')) {
      dialogEl.setAttribute('tabindex', '-1');
    }
    dialogEl.focus();
  }
}

function isRestorableOpener(el: HTMLElement | null): el is HTMLElement {
  return Boolean(el && el !== document.body && el.isConnected && !el.closest('[inert]'));
}

function restoreFocusAfterClose(entry: ModalStackEntry): void {
  if (isRestorableOpener(entry.opener)) {
    entry.opener.focus();
    return;
  }
  if (isRestorableOpener(entry.fallbackOpener)) {
    entry.fallbackOpener.focus();
    return;
  }
  // If no modal remains open and saved openers unmounted, avoid stranding focus on document.body.
  if (modalStack.length === 0 && typeof document !== 'undefined') {
    const landmark = document.querySelector<HTMLElement>('main, [role="main"]');
    const fallback =
      (landmark ? getFocusableElements(landmark)[0] : undefined) ??
      getFocusableElements(document.body)[0];
    if (fallback) {
      fallback.focus();
    }
  }
}

function restoreElementInert(el: HTMLElement, saved: SavedInertState): void {
  if (!saved.hadInertAttr) {
    el.removeAttribute('inert');
    if ('inert' in el) {
      (el as HTMLElement & { inert: boolean }).inert = false;
    }
  }
  if (saved.prevAriaHidden === null) {
    el.removeAttribute('aria-hidden');
  } else {
    el.setAttribute('aria-hidden', saved.prevAriaHidden);
  }
}

function disconnectBackgroundObserver(): void {
  if (backgroundObserver) {
    backgroundObserver.disconnect();
  }
}

function observeBackgroundAncestors(ancestors: HTMLElement[]): void {
  disconnectBackgroundObserver();
  if (ancestors.length === 0 || typeof MutationObserver === 'undefined') return;
  if (!backgroundObserver) {
    backgroundObserver = new MutationObserver(() => {
      if (modalStack.length > 0) {
        syncModalLayers();
      }
    });
  }
  for (const parent of ancestors) {
    backgroundObserver.observe(parent, { childList: true });
  }
}

/**
 * Reconcile `inert`, `aria-hidden`, and `aria-modal` so only the topmost open
 * modal is interactive and announced as `aria-modal="true"`.
 */
function syncModalLayers(): void {
  const top = getTopEntry();
  const desiredInert = new Set<HTMLElement>();
  const ancestorsToObserve: HTMLElement[] = [];

  if (top && top.dialogEl.isConnected) {
    let current: HTMLElement | null = top.dialogEl;
    while (current && current !== document.body && current.parentElement) {
      const parent: HTMLElement = current.parentElement;
      ancestorsToObserve.push(parent);
      for (const child of Array.from(parent.children)) {
        if (child === current || !(child instanceof HTMLElement)) continue;
        if (IGNORED_TAGS.has(child.tagName)) continue;
        // Keep react-hot-toast live regions announcing to screen readers while a modal is open.
        if (child.hasAttribute('data-rht-toaster')) continue;
        // Keep the active modal's own click-to-dismiss backdrop interactive.
        if (current === top.dialogEl && child.hasAttribute('data-modal-backdrop')) continue;
        desiredInert.add(child);
      }
      current = parent;
    }
  }

  // Un-inert elements that are no longer behind the topmost modal FIRST,
  // so restoring focus into an underlying modal or page opener succeeds.
  for (const [el, saved] of Array.from(managedInert.entries())) {
    if (!desiredInert.has(el)) {
      restoreElementInert(el, saved);
      managedInert.delete(el);
    }
  }

  // Mark siblings outside the topmost modal inert and hidden from assistive tech.
  for (const el of desiredInert) {
    if (!managedInert.has(el)) {
      managedInert.set(el, {
        hadInertAttr: el.hasAttribute('inert'),
        prevAriaHidden: el.getAttribute('aria-hidden'),
      });
      el.setAttribute('inert', '');
      if ('inert' in el) {
        (el as HTMLElement & { inert: boolean }).inert = true;
      }
      el.setAttribute('aria-hidden', 'true');
    }
  }

  // Keep only one aria-modal="true" container live at a time when modals stack.
  const activeSet = new Set(modalStack.map((entry) => entry.dialogEl));
  for (const [el, prevValue] of Array.from(managedAriaModal.entries())) {
    if (!activeSet.has(el) || top?.dialogEl === el) {
      el.setAttribute('aria-modal', prevValue);
      managedAriaModal.delete(el);
    }
  }

  for (const entry of modalStack) {
    if (entry === top) continue;
    const currentVal = entry.dialogEl.getAttribute('aria-modal');
    if (currentVal !== null && !managedAriaModal.has(entry.dialogEl)) {
      managedAriaModal.set(entry.dialogEl, currentVal);
      entry.dialogEl.removeAttribute('aria-modal');
    }
  }

  observeBackgroundAncestors(ancestorsToObserve);
}

function handleDocumentKeyDown(event: KeyboardEvent): void {
  const top = getTopEntry();
  if (!top || !top.dialogEl.isConnected) return;

  if (event.key === 'Escape') {
    // Do not hijack IME Escape (cancelling composition) or already-handled events.
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
    // Always consume Escape while any modal is topmost so it never leaks to
    // background listeners (such as editor exit) during mandatory or busy dialogs.
    event.preventDefault();
    if (top.canEscape()) {
      top.onEscape();
    }
    return;
  }

  if (event.key !== 'Tab') return;

  const focusable = getFocusableElements(top.dialogEl);
  if (focusable.length === 0) {
    event.preventDefault();
    if (!top.dialogEl.hasAttribute('tabindex')) {
      top.dialogEl.setAttribute('tabindex', '-1');
    }
    top.dialogEl.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (!active || !top.dialogEl.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }

  const isNonTabbableInside = active instanceof HTMLElement && active.tabIndex < 0;
  if (event.shiftKey && (active === first || active === top.dialogEl || isNonTabbableInside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function attachGlobalListener(): void {
  if (listenerAttached || typeof document === 'undefined') return;
  document.addEventListener('keydown', handleDocumentKeyDown);
  listenerAttached = true;
}

function detachGlobalListenerIfEmpty(): void {
  if (!listenerAttached || modalStack.length > 0 || typeof document === 'undefined') return;
  document.removeEventListener('keydown', handleDocumentKeyDown);
  listenerAttached = false;
  disconnectBackgroundObserver();
}

export interface UseModalFocusTrapOptions {
  /** Whether the modal is currently open and mounted in the DOM. */
  isOpen: boolean;
  /** Called when Escape is pressed on this modal (while it is topmost). Omit for non-dismissible modals. */
  onClose?: () => void;
  /** Optional ref to focus when the modal opens instead of the first focusable control. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Existing ref to the dialog element, if the caller already owns one. */
  dialogRef?: RefObject<HTMLElement | null>;
  /**
   * Optional key that changes when the underlying dialog DOM element swaps while
   * remaining open (for example, BottomSheet switching between desktop and mobile).
   * Updates the existing stack entry in place without reordering stacked modals.
   */
  nodeKey?: unknown;
}

/**
 * Shared focus trap, inert background, Escape handling, and focus restoration
 * for modal dialogs. Handles nested/stacked modals through a shared stack so
 * only the topmost dialog traps Tab and answers Escape, and closing it restores
 * focus into the dialog below.
 */
export function useModalFocusTrap<T extends HTMLElement = HTMLDialogElement>({
  isOpen,
  onClose,
  initialFocusRef,
  dialogRef: externalRef,
  nodeKey,
}: UseModalFocusTrapOptions): RefObject<T | null> {
  const internalRef = useRef<T | null>(null);
  const activeRef = (externalRef as RefObject<T | null> | undefined) ?? internalRef;
  const entryRef = useRef<ModalStackEntry | null>(null);

  const onEscapeEvent = useEffectEvent(() => {
    onClose?.();
  });
  const canEscapeEvent = useEffectEvent(() => Boolean(onClose));

  useEffect(() => {
    if (!isOpen) return;
    const dialogEl = activeRef.current;
    if (!dialogEl) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // If opened from inside an existing modal, inherit that modal's opener chain as a
    // fallback in case the parent modal closes before this one does.
    let fallbackOpener: HTMLElement | null = null;
    if (opener) {
      for (let i = modalStack.length - 1; i >= 0; i--) {
        const parent = modalStack[i];
        if (parent.dialogEl.contains(opener)) {
          fallbackOpener = isRestorableOpener(parent.opener)
            ? parent.opener
            : parent.fallbackOpener;
          break;
        }
      }
    }

    const entry: ModalStackEntry = {
      id: Symbol('modal'),
      dialogEl,
      opener,
      fallbackOpener,
      onEscape: () => onEscapeEvent(),
      canEscape: () => canEscapeEvent(),
    };

    entryRef.current = entry;
    modalStack.push(entry);
    attachGlobalListener();
    syncModalLayers();
    focusInside(dialogEl, initialFocusRef?.current);

    return () => {
      const wasTop = getTopEntry()?.id === entry.id;
      entryRef.current = null;
      const index = modalStack.findIndex((item) => item.id === entry.id);
      if (index !== -1) {
        modalStack.splice(index, 1);
      }
      syncModalLayers();
      detachGlobalListenerIfEmpty();

      if (wasTop || modalStack.length === 0) {
        restoreFocusAfterClose(entry);
      }
    };
  }, [isOpen, activeRef, initialFocusRef]);

  // Update the existing stack entry in place if the dialog DOM node swaps while open,
  // preserving stack position when covered by another modal.
  useEffect(() => {
    const entry = entryRef.current;
    const dialogEl = activeRef.current;
    if (!isOpen || !entry || !dialogEl || entry.dialogEl === dialogEl) return;

    const prevEl = entry.dialogEl;
    if (managedAriaModal.has(prevEl)) {
      managedAriaModal.delete(prevEl);
    }
    entry.dialogEl = dialogEl;
    syncModalLayers();

    if (getTopEntry() === entry) {
      focusInside(dialogEl, initialFocusRef?.current);
    }
  }, [isOpen, nodeKey, activeRef, initialFocusRef]);

  return activeRef;
}
