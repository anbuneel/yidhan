import { useState } from 'react';

/**
 * Open state for the Settings modal, closed whenever the vault locks.
 *
 * The modal lives in `App`, above the vault gate, so its state outlives a lock.
 * Without this, Settings reopened after the next unlock on a different tab.
 * Any lock closes it: "Lock now", auto-lock and sign-out alike.
 */
export function useSettingsModalState(isUnlocked: boolean) {
  const [isOpen, setIsOpen] = useState(false);
  const [wasUnlocked, setWasUnlocked] = useState(isUnlocked);

  if (wasUnlocked !== isUnlocked) {
    setWasUnlocked(isUnlocked);
    if (!isUnlocked && isOpen) setIsOpen(false);
  }

  return [isOpen, setIsOpen] as const;
}
