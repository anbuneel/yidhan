import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Paginated fetch helper for Supabase queries.
 *
 * Supabase returns a maximum of 1000 rows per request by default.
 * This helper paginates through all results using .order('id') for
 * deterministic pagination (UUIDs are immutable across concurrent writes).
 *
 * On mid-pagination error (e.g. pages 1-3 succeeded, page 4 failed),
 * returns both the data collected so far AND the error. Callers decide:
 * - For data upserts: apply what was fetched, report 'partial'
 * - For membership queries: skip deletion reconciliation entirely
 */
const PAGE_SIZE = 1000;

/** Minimal interface for a Supabase query builder that supports pagination */
interface PaginatableQuery<T> {
  order(column: string): this;
  range(from: number, to: number): PromiseLike<{
    data: T[] | null;
    error: { message: string; code?: string } | null;
  }>;
}

export async function fetchAllPaginated<T>(
  queryBuilder: () => PaginatableQuery<T>
): Promise<{ data: T[]; error: Error | null }> {
  const allData: T[] = [];
  let offset = 0;

  while (true) {
    // .order('id') ensures deterministic pagination:
    // without stable ordering, concurrent inserts/updates can shift rows
    // between pages, causing duplicates or skipped entries.
    const { data, error } = await queryBuilder()
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      // Preserve the error code (e.g. PostgreSQL '42703' for missing column)
      // so callers can make decisions based on specific error types
      const err = new Error(error.message);
      if (error.code) {
        (err as Error & { code?: string }).code = error.code;
      }
      return { data: allData, error: err };
    }
    if (!data) break;

    allData.push(...data);
    if (data.length < PAGE_SIZE) break; // Last page
    offset += PAGE_SIZE;
  }

  return { data: allData, error: null };
}
