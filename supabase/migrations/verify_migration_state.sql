-- Migration drift check
--
-- Run this in the Supabase SQL editor after deploying, and any time sync
-- entries block for a reason that looks environmental (42501, 23502, 23514).
--
-- Why this exists: `default_user_id_to_auth_uid.sql` shipped alongside a client
-- change that stopped sending `user_id` on inserts, but was never applied to
-- production. Updates to existing rows kept working, so nothing looked broken —
-- while every new note and tag silently failed RLS and blocked in the sync
-- queue. Migrations here are applied by hand, so nothing else catches that.
--
-- Every row should read 'applied'. Anything 'MISSING' means the client is
-- running ahead of the database.

WITH checks(check_name, ok) AS (
  VALUES
    -- default_user_id_to_auth_uid.sql
    ('notes.user_id defaults to auth.uid()', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notes'
        AND column_name = 'user_id' AND column_default LIKE '%auth.uid()%')),
    ('tags.user_id defaults to auth.uid()', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tags'
        AND column_name = 'user_id' AND column_default LIKE '%auth.uid()%')),
    ('note_shares.user_id defaults to auth.uid()', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'note_shares'
        AND column_name = 'user_id' AND column_default LIKE '%auth.uid()%')),

    -- launch_security_hardening.sql
    ('notes E2EE-only constraint', EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'chk_notes_e2ee_only')),
    ('note_shares E2EE-only constraint', EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'chk_note_shares_e2ee_only')),
    ('fetch_shared_note RPC', EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'fetch_shared_note')),

    -- launch_security_hardening.sql owns the final note_shares policy set. It
    -- drops every pre-existing policy on the table, so the earlier names from
    -- fix_note_shares_rls_ownership.sql are gone on a correctly migrated
    -- database — check the hardened set, not the superseded one.
    ('note_shares hardened policy set', (
      SELECT count(*) = 4 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = 'note_shares'
        AND policyname IN (
          'note_shares_select_own',
          'note_shares_insert_own_note',
          'note_shares_update_own_note',
          'note_shares_delete_own'))),
    ('no pre-hardening note_shares policies linger', NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = 'note_shares'
        AND policyname NOT LIKE 'note\_shares\_%')),

    -- add_notes_updated_at_trigger.sql
    ('notes updated_at trigger', EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'notes_updated_at_trigger')),

    -- add_account_deletion_workflow.sql
    ('account_deletion_requests table', EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'account_deletion_requests')),
    ('request_account_deletion RPC', EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'request_account_deletion'))
)
SELECT
  check_name,
  CASE WHEN ok THEN 'applied' ELSE 'MISSING' END AS status
FROM checks
ORDER BY ok, check_name;
