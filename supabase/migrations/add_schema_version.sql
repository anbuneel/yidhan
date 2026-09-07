-- Migration: a version the client can read before it writes
--
-- Migrations here are applied by hand. A client shipped ahead of its migration
-- fails only on WRITES, silently, while reads keep working — which presents as a
-- sync bug rather than a missing migration. That is exactly what happened with
-- `default_user_id_to_auth_uid.sql`: every new note failed RLS and blocked in the
-- sync queue, and nothing said why.
--
-- This table gives the client something to check at startup. It holds one row.
-- The number is a plain counter, bumped by any migration the client depends on;
-- the client carries the version it requires and refuses to write when the
-- database is behind it.
--
-- Read by every authenticated client. Written by nobody through the API — the
-- number is advanced by the same hand that applies the migration.

CREATE TABLE IF NOT EXISTS public.schema_version (
  -- One row, enforced by the constraint below. `id` exists only so the row has a
  -- stable address for the UPDATE that advances it.
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  version integer NOT NULL CHECK (version >= 0),
  applied_at timestamptz NOT NULL DEFAULT now(),
  -- What the version means, for whoever opens this table wondering.
  note text
);

COMMENT ON TABLE public.schema_version IS
  'Single row. The migration level this database is at. Clients read it at startup '
  'and refuse to write when their required version is higher — see item 36.';

-- Version 1 is the state after launch_security_hardening.sql,
-- default_user_id_to_auth_uid.sql and everything before them. Run
-- verify_migration_state.sql first: if any row there reads MISSING, this database
-- is not at version 1 and seeding it here would tell every client otherwise.
INSERT INTO public.schema_version (id, version, note)
VALUES (true, 1, 'Launch hardening, auth.uid() ownership defaults, account deletion workflow')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.schema_version ENABLE ROW LEVEL SECURITY;

-- Readable by any signed-in client. The number is not a secret — it is a
-- deployment fact, and a client that cannot read it fails open (see
-- src/services/schemaVersion.ts) rather than locking anyone out.
DROP POLICY IF EXISTS schema_version_select_authenticated ON public.schema_version;
CREATE POLICY schema_version_select_authenticated
  ON public.schema_version
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT, UPDATE or DELETE policy: with RLS on, that is a deny for every
-- client. The row moves only from the SQL editor, alongside the migration whose
-- level it records.
