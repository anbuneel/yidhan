# Release checklist

Migrations are applied **by hand**. Nothing runs them for you, and nothing tells you
they are missing — a client shipped ahead of its migration fails only on *writes*,
silently, while reads keep working. That is why this file exists and why the migration
step is not optional.

The history: `default_user_id_to_auth_uid.sql` shipped alongside a client change that
stopped sending `user_id` on inserts, and was never applied to production. Updates to
existing rows kept working, so nothing looked broken — while every new note and tag
failed RLS and blocked in the sync queue.

---

## Before merging a PR that touches the database

1. **Write the migration** in `supabase/migrations/`, named for what it does.
2. **Add its checks to `verify_migration_state.sql`** — one row per thing the migration
   creates (a column default, a constraint, an RPC, a policy set). A migration with no
   check is a migration nobody will notice is missing.
3. **Update `src/types/database.ts`**, then the service functions, then `src/types.ts`.
4. **Decide whether the client depends on it.** If a client shipped before the
   migration would *break* — not merely miss a feature — then:
   - bump `REQUIRED_SCHEMA_VERSION` in `src/services/schemaVersion.ts`, and
   - add the matching `UPDATE public.schema_version SET version = N` to the migration.

   If the client works fine either way, leave the version alone. Bumping it for a
   migration nobody needs blocks every reader for no reason.

## On deploy

Run these in the Supabase SQL editor **against the deployment target**, in order.
Getting the order wrong is how a `schema_version` row ends up claiming a level the
database is not at.

1. **The migration itself.**

2. **`supabase/migrations/verify_migration_state.sql`.**
   Every row must read `applied`. A single `MISSING` means the client is running ahead
   of the database — stop and apply what is missing before going further.

3. **The version bump**, if step 4 above called for one:

   ```sql
   UPDATE public.schema_version
   SET version = <N>, applied_at = now(), note = '<what this level means>';
   ```

   Only after step 2 is clean. The version row is a promise to every client that the
   migrations below it are applied; advancing it early makes the guard lie.

4. **Re-run `verify_migration_state.sql`** and confirm it is still all `applied`.

## Record it in the PR

Paste the `verify_migration_state.sql` output into the PR before merging — the
`check_name` / `status` table, as it came back, against the environment you ran it on.
Not a summary, not "ran it, all good": the output. It is the only evidence that the
step happened, and the whole reason this checklist exists is that a step everyone
assumed had happened had not.

```
check_name                                  | status
--------------------------------------------|--------
notes.user_id defaults to auth.uid()        | applied
...
```

## What the guard does when this is skipped

`src/services/schemaVersion.ts` reads `schema_version.version` at startup and compares
it to the level the build requires. When the database is behind, the app shows
`DatabaseUpdatePending` — "a database update is pending", the two version numbers, and
a retry — instead of letting the queue fill with writes that cannot land.

It deliberately **fails open**. Offline, unreachable, or a table that was never seeded
all resolve to `unknown`, and `unknown` writes normally. Yidhan is offline-first: a
reader with no connection must not be locked out of their own notes because a version
check could not reach the server. Only a definite answer — a version number lower than
the one the build needs — closes anything.

Two consequences worth knowing:

- The guard catches a **missed version bump only if you made one**. It cannot detect a
  migration you forgot to record. `verify_migration_state.sql` is what catches that,
  which is why step 2 is not replaced by the guard.
- A database *ahead* of the client is fine and expected — migrate first, deploy second.

## When the deployment target is not production

The same steps, against that environment. The guard compares whatever database the
client is pointed at, so a staging database at version 1 and a staging build requiring
2 will show the pending screen there too. That is the check working.
