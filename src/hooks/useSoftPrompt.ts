/**
 * useSoftPrompt Hook
 *
 * Determines when to show the soft signup prompt to demo users.
 * Follows a non-aggressive pattern aligned with Yidhan's calm philosophy.
 */

import { useMemo, useEffect, useRef, useState } from 'react';
import type { DemoMetadata } from '../services/demoStorage';

// ============================================================================
// Constants
// ============================================================================

// Minimum notes before showing prompt (user-created, excludes welcome note)
const MIN_NOTES_FOR_PROMPT = 3;

// Minimum time spent in demo before showing prompt (5 minutes)
const MIN_TIME_FOR_PROMPT_MS = 5 * 60 * 1000;

// Cooldown period after dismissing prompt (24 hours)
const PROMPT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Cooldown period after dismissing ribbon (7 days)
const RIBBON_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

// ============================================================================
// Hook
// ============================================================================

export interface UseSoftPromptOptions {
  metadata: DemoMetadata | null;
  userNoteCount: number;
  /** Suppress opening the modal prompt (e.g. while another dialog is open or in the editor). */
  suppressed?: boolean;
  onDismissPrompt: () => void;
  onDismissRibbon: () => void;
}

export interface UseSoftPromptReturn {
  // Modal prompt (more prominent)
  shouldShowPrompt: boolean;
  dismissPrompt: () => void;

  // Inline nudge (less prominent, shown after modal dismissed)
  shouldShowInlineNudge: boolean;

  // Impermanence ribbon
  shouldShowRibbon: boolean;
  dismissRibbon: () => void;

  // Stats for display
  noteCount: number;
  timeSpentMinutes: number;
}

export function useSoftPrompt({
  metadata,
  userNoteCount,
  suppressed = false,
  onDismissPrompt,
  onDismissRibbon,
}: UseSoftPromptOptions): UseSoftPromptReturn {
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [isTyping, setIsTyping] = useState<boolean>(() =>
    typeof document !== 'undefined' ? isEditableElement(document.activeElement) : false
  );
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update current time every minute and re-verify activeElement so a focused
  // editable unmounted without firing focusout cannot wedge isTyping forever.
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
      if (typeof document !== 'undefined' && !isEditableElement(document.activeElement)) {
        setIsTyping(false);
      }
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Re-check activeElement when suppression ends (e.g. leaving the editor or closing a dialog).
  const prevSuppressedRef = useRef(suppressed);
  useEffect(() => {
    const wasSuppressed = prevSuppressedRef.current;
    prevSuppressedRef.current = suppressed;
    if (!wasSuppressed || suppressed || typeof document === 'undefined') return;
    if (!isEditableElement(document.activeElement)) {
      queueMicrotask(() => {
        if (!isEditableElement(document.activeElement)) {
          setIsTyping(false);
        }
      });
    }
  }, [suppressed]);

  // Track whether focus is currently inside a text input / editable surface so the
  // prompt never interrupts the visitor mid-thought. Defer clearing on focusout so
  // an in-flight pointer click (mousedown -> focusout -> focusin -> click) finishes
  // before InvitationModal can mount and swallow it.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const clearPendingBlur = () => {
      if (blurTimerRef.current !== null) {
        clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
    };
    const scheduleClearTyping = () => {
      if (blurTimerRef.current !== null) return;
      blurTimerRef.current = setTimeout(() => {
        blurTimerRef.current = null;
        setIsTyping(isEditableElement(document.activeElement));
      }, 200);
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (isEditableElement(event.target)) {
        clearPendingBlur();
        setIsTyping(true);
      } else {
        // Leave an active blur timer running (or start one) so a pointer click
        // sequence (mousedown -> focusout -> focusin -> mouseup -> click) completes
        // before InvitationModal can mount and swallow the click.
        scheduleClearTyping();
      }
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (isEditableElement(event.relatedTarget)) {
        clearPendingBlur();
        setIsTyping(true);
        return;
      }
      scheduleClearTyping();
    };
    // Recover from a focused editable unmounting without firing focusout.
    const handlePointerDown = () => {
      if (!isEditableElement(document.activeElement)) {
        scheduleClearTyping();
      }
    };
    const handleKeyDown = () => {
      if (!isEditableElement(document.activeElement)) {
        setIsTyping(false);
      }
    };
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearPendingBlur();
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Calculate all prompt states in a single memo
  const promptState = useMemo(() => {
    // Time spent in demo (in minutes)
    const timeSpentMinutes = metadata
      ? Math.floor((currentTime - metadata.createdAt) / (60 * 1000))
      : 0;

    // Check minimum requirements for prompt
    const meetsMinimumRequirements =
      metadata !== null &&
      userNoteCount >= MIN_NOTES_FOR_PROMPT &&
      currentTime - metadata.createdAt >= MIN_TIME_FOR_PROMPT_MS;

    // Check cooldown periods
    const promptRecentlyDismissed =
      metadata?.promptDismissedAt != null &&
      currentTime - metadata.promptDismissedAt < PROMPT_COOLDOWN_MS;

    const ribbonRecentlyDismissed =
      metadata?.ribbonDismissedAt != null &&
      currentTime - metadata.ribbonDismissedAt < RIBBON_COOLDOWN_MS;

    return {
      timeSpentMinutes,
      shouldShowPrompt:
        meetsMinimumRequirements && !promptRecentlyDismissed && !suppressed && !isTyping,
      shouldShowInlineNudge:
        metadata?.promptDismissedAt != null &&
        userNoteCount >= MIN_NOTES_FOR_PROMPT,
      shouldShowRibbon: !ribbonRecentlyDismissed,
    };
  }, [metadata, userNoteCount, currentTime, suppressed, isTyping]);

  return {
    shouldShowPrompt: promptState.shouldShowPrompt,
    dismissPrompt: onDismissPrompt,

    shouldShowInlineNudge: promptState.shouldShowInlineNudge,

    shouldShowRibbon: promptState.shouldShowRibbon,
    dismissRibbon: onDismissRibbon,

    noteCount: userNoteCount,
    timeSpentMinutes: promptState.timeSpentMinutes,
  };
}
