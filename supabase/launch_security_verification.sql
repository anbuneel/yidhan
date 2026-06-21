-- Read-only verification after applying supabase/migrations/launch_security_hardening.sql.
-- Run this in Supabase SQL Editor. Any failure raises an exception.

DO $$
DECLARE
  unsafe_note_count integer;
  unsafe_share_count integer;
  rls_disabled_tables text[];
  missing_policies text[];
  unexpected_public_policies text[];
  missing_constraints text[];
BEGIN
  SELECT COUNT(*) INTO unsafe_note_count
  FROM public.notes
  WHERE encrypted_payload IS NULL
    OR length(encrypted_payload) = 0
    OR encryption_iv IS NULL
    OR length(encryption_iv) = 0
    OR encryption_version IS NULL
    OR encryption_version < 1
    OR content_hash IS NULL
    OR length(content_hash) = 0
    OR COALESCE(title, '') <> ''
    OR COALESCE(content, '') <> '';

  IF unsafe_note_count <> 0 THEN
    RAISE EXCEPTION 'Launch verification failed: % unsafe note row(s).', unsafe_note_count;
  END IF;

  SELECT COUNT(*) INTO unsafe_share_count
  FROM public.note_shares
  WHERE encrypted_payload IS NULL
    OR length(encrypted_payload) = 0
    OR iv IS NULL
    OR length(iv) = 0
    OR encryption_version IS NULL
    OR encryption_version < 1
    OR expires_at IS NULL
    OR expires_at > now() + INTERVAL '30 days';

  IF unsafe_share_count <> 0 THEN
    RAISE EXCEPTION 'Launch verification failed: % unsafe share row(s).', unsafe_share_count;
  END IF;

  SELECT array_agg(tablename ORDER BY tablename) INTO rls_disabled_tables
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('notes', 'tags', 'note_tags', 'note_shares')
    AND rowsecurity = false;

  IF rls_disabled_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Launch verification failed: RLS disabled on %.', rls_disabled_tables;
  END IF;

  WITH expected(policyname) AS (
    VALUES
      ('notes_select_own'),
      ('notes_insert_own_encrypted'),
      ('notes_update_own_encrypted'),
      ('notes_delete_own'),
      ('tags_select_own'),
      ('tags_insert_own'),
      ('tags_update_own'),
      ('tags_delete_own'),
      ('note_tags_select_own'),
      ('note_tags_insert_own'),
      ('note_tags_delete_own'),
      ('note_shares_select_own'),
      ('note_shares_insert_own_note'),
      ('note_shares_update_own_note'),
      ('note_shares_delete_own')
  )
  SELECT array_agg(policyname ORDER BY policyname) INTO missing_policies
  FROM expected
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND pg_policies.policyname = expected.policyname
  );

  IF missing_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Launch verification failed: missing policies %.', missing_policies;
  END IF;

  SELECT array_agg(tablename || ':' || policyname ORDER BY tablename, policyname)
  INTO unexpected_public_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('notes', 'tags', 'note_tags', 'note_shares')
    AND (
      array_to_string(roles, ',') = 'public'
      OR array_to_string(roles, ',') LIKE '%anon%'
    );

  IF unexpected_public_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Launch verification failed: unexpected anon/public table policies %.', unexpected_public_policies;
  END IF;

  WITH expected_constraints(conname) AS (
    VALUES
      ('chk_notes_e2ee_only'),
      ('chk_note_shares_e2ee_only')
  )
  SELECT array_agg(conname ORDER BY conname) INTO missing_constraints
  FROM expected_constraints
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND pg_constraint.conname = expected_constraints.conname
      AND convalidated = true
  );

  IF missing_constraints IS NOT NULL THEN
    RAISE EXCEPTION 'Launch verification failed: missing validated constraints %.', missing_constraints;
  END IF;

  IF to_regprocedure('public.restore_note_timestamps(jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'Launch verification failed: restore_note_timestamps(jsonb) still exists.';
  END IF;

  IF NOT has_function_privilege('anon', 'public.fetch_shared_note(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Launch verification failed: anon cannot execute fetch_shared_note(text).';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.fetch_shared_note(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Launch verification failed: authenticated cannot execute fetch_shared_note(text).';
  END IF;

  IF has_function_privilege('anon', 'public.purge_old_deleted_notes()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Launch verification failed: anon can execute purge_old_deleted_notes().';
  END IF;

  IF has_function_privilege('authenticated', 'public.purge_old_deleted_notes()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Launch verification failed: authenticated can execute purge_old_deleted_notes().';
  END IF;

  IF has_function_privilege('anon', 'public.cleanup_expired_faded_notes()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Launch verification failed: anon can execute cleanup_expired_faded_notes().';
  END IF;

  IF has_function_privilege('authenticated', 'public.cleanup_expired_faded_notes()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Launch verification failed: authenticated can execute cleanup_expired_faded_notes().';
  END IF;
END $$;

SELECT 'launch_security_verification_passed' AS result;
