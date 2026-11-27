/**
 * The held-save notice with its Retry and Copy (issue #288). Loaded on demand by App,
 * only while words are held or Lock now was held back, so the app shell does not
 * carry it. While mounted it lends App its retry, so a lock can retry held saves.
 */
import { useEffect } from 'react';
import { useHeldSaves } from '../stores/heldSaves';
import { useHeldSaveActions, type UseHeldSaveActionsOptions } from '../hooks/useHeldSaveActions';
import { HeldSavesNotice } from './HeldSavesNotice';

export interface HeldSavesLayerProps extends UseHeldSaveActionsOptions {
  lockBlocked: boolean;
  onLockAnyway: () => void;
  /** Retry or Copy dealt with an entry. */
  onDealtWith: () => void;
  /** Lock now again, when it was held back by saves still running. */
  onTryLockAgain: () => void;
  /** Where App's locks find the retry for held saves. */
  retryHeldSavesRef: React.RefObject<() => Promise<boolean>>;
}

export default function HeldSavesLayer({ lockBlocked, onLockAnyway, onDealtWith, onTryLockAgain, retryHeldSavesRef, ...options }: HeldSavesLayerProps) {
  const entries = useHeldSaves();
  const { retry, retryAll, copy } = useHeldSaveActions(options);

  useEffect(() => {
    retryHeldSavesRef.current = retryAll;
    return () => { retryHeldSavesRef.current = async () => true; };
  }, [retryAll, retryHeldSavesRef]);

  return (
    <HeldSavesNotice
      entries={entries}
      onRetry={async (key) => {
        if (await retry(key)) onDealtWith();
      }}
      onCopy={async (key) => {
        const copied = await copy(key);
        if (copied) onDealtWith();
        return copied;
      }}
      lockBlocked={lockBlocked}
      onLockAnyway={onLockAnyway}
      onTryLockAgain={onTryLockAgain}
    />
  );
}
