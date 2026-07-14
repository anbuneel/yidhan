-- Read-only verification after applying add_account_deletion_workflow.sql.
-- Run in Supabase SQL Editor. Any failure raises an exception.

DO $$
DECLARE
  rls_disabled_tables text[];
  missing_policies text[];
  unexpected_public_policies text[];
  direct_client_privileges text[];
  missing_service_privileges text[];
  missing_constraints text[];
BEGIN
  SELECT array_agg(tablename ORDER BY tablename) INTO rls_disabled_tables
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'account_deletion_requests',
      'sensitive_action_confirmations',
      'account_deletion_audit'
    )
    AND rowsecurity = false;

  IF rls_disabled_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Account deletion verification failed: RLS disabled on %.', rls_disabled_tables;
  END IF;

  WITH expected(policyname) AS (
    VALUES ('account_deletion_requests_select_own')
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
    RAISE EXCEPTION 'Account deletion verification failed: missing policies %.', missing_policies;
  END IF;

  SELECT array_agg(tablename || ':' || policyname ORDER BY tablename, policyname)
  INTO unexpected_public_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'account_deletion_requests',
      'sensitive_action_confirmations',
      'account_deletion_audit'
    )
    AND (
      array_to_string(roles, ',') = 'public'
      OR array_to_string(roles, ',') LIKE '%anon%'
    );

  IF unexpected_public_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Account deletion verification failed: unexpected anon/public table policies %.', unexpected_public_policies;
  END IF;

  SELECT array_agg(table_name || ':' || privilege_type ORDER BY table_name, privilege_type)
  INTO direct_client_privileges
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN (
      'account_deletion_requests',
      'sensitive_action_confirmations',
      'account_deletion_audit'
    )
    AND grantee IN ('anon', 'authenticated')
    AND (
      table_name <> 'account_deletion_requests'
      OR privilege_type <> 'SELECT'
    );

  IF direct_client_privileges IS NOT NULL THEN
    RAISE EXCEPTION 'Account deletion verification failed: unexpected client table grants %.', direct_client_privileges;
  END IF;

  WITH expected_service_grants(table_name, privilege_type) AS (
    VALUES
      ('account_deletion_requests', 'SELECT'),
      ('sensitive_action_confirmations', 'INSERT'),
      ('account_deletion_audit', 'INSERT')
  )
  SELECT array_agg(table_name || ':' || privilege_type ORDER BY table_name, privilege_type)
  INTO missing_service_privileges
  FROM expected_service_grants
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee = 'service_role'
      AND role_table_grants.table_name = expected_service_grants.table_name
      AND role_table_grants.privilege_type = expected_service_grants.privilege_type
  );

  IF missing_service_privileges IS NOT NULL THEN
    RAISE EXCEPTION 'Account deletion verification failed: missing service_role table grants %.', missing_service_privileges;
  END IF;

  IF NOT has_sequence_privilege('service_role', 'public.account_deletion_audit_id_seq', 'USAGE') THEN
    RAISE EXCEPTION 'Account deletion verification failed: service_role cannot use account_deletion_audit_id_seq.';
  END IF;

  WITH expected_constraints(conname) AS (
    VALUES
      ('account_deletion_requests_status_check'),
      ('account_deletion_requests_release_after_request_check'),
      ('account_deletion_requests_attempt_count_check'),
      ('account_deletion_requests_cancelled_shape_check'),
      ('sensitive_action_confirmations_action_check'),
      ('sensitive_action_confirmations_method_check'),
      ('sensitive_action_confirmations_expiry_check'),
      ('account_deletion_audit_outcome_check')
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
    RAISE EXCEPTION 'Account deletion verification failed: missing validated constraints %.', missing_constraints;
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.request_account_deletion(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Account deletion verification failed: authenticated cannot execute request_account_deletion(text).';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.cancel_account_deletion()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Account deletion verification failed: authenticated cannot execute cancel_account_deletion().';
  END IF;

  IF has_function_privilege('anon', 'public.request_account_deletion(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Account deletion verification failed: anon can execute request_account_deletion(text).';
  END IF;

  IF has_function_privilege('anon', 'public.cancel_account_deletion()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Account deletion verification failed: anon can execute cancel_account_deletion().';
  END IF;

  IF has_function_privilege('authenticated', 'public.claim_due_account_deletions(integer, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Account deletion verification failed: authenticated can execute claim_due_account_deletions(integer, text).';
  END IF;

  IF has_function_privilege('authenticated', 'public.delete_account_app_data(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Account deletion verification failed: authenticated can execute delete_account_app_data(uuid).';
  END IF;

  IF has_function_privilege('authenticated', 'public.mark_account_deletion_failed(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Account deletion verification failed: authenticated can execute mark_account_deletion_failed(uuid, text).';
  END IF;

  IF has_function_privilege('authenticated', 'public.mark_account_deletion_skipped_cancelled(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Account deletion verification failed: authenticated can execute mark_account_deletion_skipped_cancelled(uuid).';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_requests
    WHERE cancelled_at IS NOT NULL
      AND status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Account deletion verification failed: cancelled request has non-cancelled status.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_requests
    WHERE cancelled_at IS NOT NULL
      AND status IN ('pending', 'failed', 'processing')
      AND release_at <= now()
  ) THEN
    RAISE EXCEPTION 'Account deletion verification failed: dry-run due query would include cancelled rows.';
  END IF;
END $$;

DO $$
DECLARE
  scheduled_job_count integer;
  scheduled_command text;
  missing_vault_secrets text[];
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'cron.job not available in this database session. Verify external scheduler separately if pg_cron is not used.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO scheduled_job_count
  FROM cron.job
  WHERE jobname = 'process-account-deletions';

  IF scheduled_job_count = 0 THEN
    RAISE NOTICE 'No pg_cron job named process-account-deletions was found. Configure pg_cron or verify the external scheduler before re-enabling offboarding.';
    RETURN;
  END IF;

  IF scheduled_job_count > 1 THEN
    RAISE EXCEPTION 'Account deletion verification failed: multiple pg_cron jobs named process-account-deletions were found.';
  END IF;

  SELECT command INTO scheduled_command
  FROM cron.job
  WHERE jobname = 'process-account-deletions'
  LIMIT 1;

  IF position('Authorization' IN scheduled_command) = 0
    OR position('account_deletion_function_bearer' IN scheduled_command) = 0
    OR position('x-account-deletion-secret' IN scheduled_command) = 0
    OR position('account_deletion_worker_secret' IN scheduled_command) = 0 THEN
    RAISE EXCEPTION 'Account deletion verification failed: process-account-deletions cron job is missing required authorization headers.';
  END IF;

  IF to_regclass('vault.secrets') IS NULL THEN
    RAISE EXCEPTION 'Account deletion verification failed: Vault secrets table is unavailable for scheduled worker secrets.';
  END IF;

  WITH expected(name) AS (
    VALUES
      ('account_deletion_function_url'),
      ('account_deletion_function_bearer'),
      ('account_deletion_worker_secret')
  )
  SELECT array_agg(name ORDER BY name) INTO missing_vault_secrets
  FROM expected
  WHERE NOT EXISTS (
    SELECT 1
    FROM vault.secrets
    WHERE vault.secrets.name = expected.name
  );

  IF missing_vault_secrets IS NOT NULL THEN
    RAISE EXCEPTION 'Account deletion verification failed: missing Vault scheduler secrets %.', missing_vault_secrets;
  END IF;
END $$;

SELECT 'account_deletion_verification_passed' AS result;
