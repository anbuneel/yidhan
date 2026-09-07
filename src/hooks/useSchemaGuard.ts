/**
 * Reads the database's migration level once the reader is signed in, and again on
 * demand when they ask to retry.
 *
 * The result starts as `unknown`, which fails open — the app is fully usable while the
 * check is in flight, and stays usable if it never answers. Only a definite
 * "database is behind" closes anything.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  checkSchemaCompatibility,
  type SchemaCompatibility,
} from '../services/schemaVersion';

export interface SchemaGuard {
  compatibility: SchemaCompatibility;
  /** True while a check is in flight, so a Retry button can say so. */
  isChecking: boolean;
  recheck: () => void;
}

const PENDING: SchemaCompatibility = { status: 'unknown', reason: 'unreachable' };

export function useSchemaGuard(enabled: boolean): SchemaGuard {
  const [compatibility, setCompatibility] = useState<SchemaCompatibility>(PENDING);
  const [isChecking, setIsChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCompatibility(PENDING);
      return;
    }

    let cancelled = false;
    setIsChecking(true);

    void checkSchemaCompatibility()
      .then((result) => {
        if (!cancelled) setCompatibility(result);
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, attempt]);

  const recheck = useCallback(() => setAttempt((n) => n + 1), []);

  return { compatibility, isChecking, recheck };
}
