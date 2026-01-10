/**
 * useSoftPrompt Hook
 *
 * Determines when to show the soft signup prompt to demo users.
 * Follows a non-aggressive pattern aligned with Zenote's calm philosophy.
 */

import { useMemo, useEffect, useState } from 'react';
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

// ============================================================================
// Hook
// ============================================================================

export interface UseSoftPromptOptions {
  metadata: DemoMetadata | null;
  userNoteCount: number;
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
  onDismissPrompt,
  onDismissRibbon,
}: UseSoftPromptOptions): UseSoftPromptReturn {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Update current time every minute to re-evaluate time-based conditions
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60 * 1000);

    return () => clearInterval(interval);
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
      shouldShowPrompt: meetsMinimumRequirements && !promptRecentlyDismissed,
      shouldShowInlineNudge:
        metadata?.promptDismissedAt != null &&
        userNoteCount >= MIN_NOTES_FOR_PROMPT,
      shouldShowRibbon: !ribbonRecentlyDismissed,
    };
  }, [metadata, userNoteCount, currentTime]);

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
