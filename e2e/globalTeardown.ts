/**
 * globalTeardown.ts — removes the notes and tags this run created.
 *
 * `tags.spec.ts` calls `createTag` in eleven tests and deletes in one, and most of
 * `notes.spec.ts` leaves its notes behind, so every credentialed run added a couple
 * of dozen rows to the shared test account and never took any away. Left alone the
 * library grows noisy, and `notes.spec.ts`'s empty-state test skips itself
 * permanently because the account is never empty.
 *
 * Two guardrails, because this deletes real rows on whatever account the credentials
 * name:
 *
 * 1. It only deletes rows whose `created_at` is at or after `E2E_RUN_STARTED_AT`,
 *    stamped by `globalSetup.ts`. Anything that existed before the run is out of
 *    reach — including a human's notes, if the credentials are ever pointed
 *    somewhere they should not be.
 * 2. It does nothing at all unless a real Supabase URL and the account credentials
 *    are all present. A placeholder CI run writes nothing, so there is nothing to
 *    clean.
 *
 * Deleting by timestamp rather than by name is deliberate. The specs generate names
 * from 29 different prefixes with no shared marker, so a name filter would both miss
 * rows and risk matching real ones.
 *
 * This never fails the run. A green suite reporting failure because its cleanup could
 * not reach the network would be worse than the mess it is tidying — but it says so
 * loudly, because silent cleanup failure is how the accumulation comes back.
 */
import { createClient } from '@supabase/supabase-js';

export default async function globalTeardown(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const startedAt = process.env.E2E_RUN_STARTED_AT;

  if (!url || !anonKey || !email || !password || !startedAt) {
    return;
  }
  if (url.includes('placeholder.invalid')) {
    return;
  }

  try {
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: session, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !session.user) {
      console.warn(`[e2e cleanup] sign-in failed, leaving data in place: ${signInError?.message ?? 'no session'}`);
      return;
    }

    // note_tags and note_shares cascade from notes; tags are deleted on their own.
    const notes = await supabase
      .from('notes')
      .delete()
      .eq('user_id', session.user.id)
      .gte('created_at', startedAt)
      .select('id');

    const tags = await supabase
      .from('tags')
      .delete()
      .eq('user_id', session.user.id)
      .gte('created_at', startedAt)
      .select('id');

    await supabase.auth.signOut();

    if (notes.error || tags.error) {
      console.warn(`[e2e cleanup] partial: notes=${notes.error?.message ?? 'ok'} tags=${tags.error?.message ?? 'ok'}`);
      return;
    }

    console.log(`[e2e cleanup] removed ${notes.data?.length ?? 0} notes and ${tags.data?.length ?? 0} tags created since ${startedAt}`);
  } catch (error) {
    console.warn(`[e2e cleanup] skipped: ${error instanceof Error ? error.message : String(error)}`);
  }
}
