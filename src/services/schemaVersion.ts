/**
 * The deployment guard (item 36).
 *
 * Migrations are applied by hand. A client shipped ahead of its migration fails
 * **only on writes**, silently, while reads keep working — so it presents as a sync
 * bug, not a missing migration. That is how `default_user_id_to_auth_uid.sql` shipped
 * to production unapplied: every new note failed RLS and blocked in the sync queue,
 * and nothing said why.
 *
 * So the client carries the migration level it needs and reads the level the database
 * is actually at. When the database is behind, the app says "database update pending"
 * and stops writing, instead of filling the queue with writes that cannot land.
 */

import { supabase } from '../lib/supabase';

/**
 * The migration level this build requires.
 *
 * Bump it in the same PR as a migration the client depends on, and advance
 * `schema_version.version` in the SQL editor when that migration is applied. A build
 * that requires more than the database has is what the guard exists to catch.
 */
export const REQUIRED_SCHEMA_VERSION = 1;

export type SchemaCompatibility =
  /** The database is at or ahead of what this build needs. Write freely. */
  | { status: 'ok'; appliedVersion: number }
  /** The database is behind. Writes would block in the queue; refuse them instead. */
  | { status: 'database-behind'; appliedVersion: number; requiredVersion: number }
  /**
   * We could not find out — offline, a network failure, or a database that predates
   * the `schema_version` table.
   *
   * **This fails open, deliberately.** Yidhan is offline-first: a reader on a train
   * cannot reach the database at all, and treating "no answer" as "database behind"
   * would lock them out of their own notes for the length of the journey. The guard
   * exists to catch a *known* mismatch, and only a definite answer is one.
   */
  | { status: 'unknown'; reason: SchemaUnknownReason };

type SchemaUnknownReason =
  | 'offline'
  | 'unreachable'
  /** The table is not there. A database that predates this migration is version 0. */
  | 'not-provisioned';

/** Decide, from an applied version, whether this build may write. Pure. */
export function evaluateSchemaCompatibility(
  appliedVersion: number,
  requiredVersion: number = REQUIRED_SCHEMA_VERSION
): SchemaCompatibility {
  if (appliedVersion >= requiredVersion) {
    return { status: 'ok', appliedVersion };
  }
  return { status: 'database-behind', appliedVersion, requiredVersion };
}

/** Postgres codes that mean "the table or column is not there", not "query failed". */
const MISSING_RELATION_CODES = new Set([
  '42P01', // undefined_table
  '42703', // undefined_column
  'PGRST205', // PostgREST: table not found in schema cache
]);

interface SupabaseErrorLike {
  code?: string;
  message?: string;
}

function isMissingRelation(error: SupabaseErrorLike): boolean {
  if (error.code && MISSING_RELATION_CODES.has(error.code)) return true;
  // PostgREST reports a missing table through the message when the schema cache is
  // stale; the code alone is not always enough.
  return /schema_version/i.test(error.message ?? '') && /does not exist|not find/i.test(error.message ?? '');
}

/**
 * Read the level the database is at, and say what this build may do.
 *
 * Never throws. Every failure path lands on `unknown`, which fails open.
 */
export async function checkSchemaCompatibility(
  requiredVersion: number = REQUIRED_SCHEMA_VERSION
): Promise<SchemaCompatibility> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { status: 'unknown', reason: 'offline' };
  }

  try {
    const { data, error } = await supabase
      .from('schema_version')
      .select('version')
      .maybeSingle();

    if (error) {
      if (isMissingRelation(error)) {
        // The table itself is the migration. A database without it has not had this
        // one applied, so it is behind by definition — but say so as version 0 rather
        // than as an unreachable database, because it is a real answer.
        return requiredVersion > 0
          ? { status: 'database-behind', appliedVersion: 0, requiredVersion }
          : { status: 'ok', appliedVersion: 0 };
      }
      console.warn('[schema] Could not read schema_version:', error.message);
      return { status: 'unknown', reason: 'unreachable' };
    }

    if (!data || typeof data.version !== 'number') {
      // The table exists but carries no row. Somebody created it without seeding it;
      // that is a provisioning gap, not a version we can compare against.
      return { status: 'unknown', reason: 'not-provisioned' };
    }

    return evaluateSchemaCompatibility(data.version, requiredVersion);
  } catch (error) {
    console.warn('[schema] Schema version check failed:', error);
    return { status: 'unknown', reason: 'unreachable' };
  }
}

/** True when this build must not write. Only a definite mismatch counts. */
export function blocksWrites(compatibility: SchemaCompatibility): boolean {
  return compatibility.status === 'database-behind';
}
