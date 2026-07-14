-- Server-owned account deletion workflow.
--
-- This intentionally does not re-enable the "Letting Go" UI. It adds the
-- backend authority, confirmation gate, worker claim path, and audit trail
-- required before the feature can be safely restored.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  release_at timestamptz NOT NULL,
  cancelled_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  processing_started_at timestamptz,
  processing_worker_id text,
  released_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_deletion_requests_status_check CHECK (
    status IN ('pending', 'processing', 'cancelled', 'released', 'failed')
  ),
  CONSTRAINT account_deletion_requests_release_after_request_check CHECK (
    release_at >= requested_at
  ),
  CONSTRAINT account_deletion_requests_attempt_count_check CHECK (
    attempt_count >= 0
  ),
  CONSTRAINT account_deletion_requests_cancelled_shape_check CHECK (
    status <> 'cancelled' OR cancelled_at IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.sensitive_action_confirmations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  method text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT sensitive_action_confirmations_action_check CHECK (
    action IN ('account_deletion')
  ),
  CONSTRAINT sensitive_action_confirmations_method_check CHECK (
    method IN ('password', 'oauth', 'email_otp')
  ),
  CONSTRAINT sensitive_action_confirmations_expiry_check CHECK (
    expires_at > created_at
  )
);

CREATE TABLE IF NOT EXISTS public.account_deletion_audit (
  id bigserial PRIMARY KEY,
  user_id uuid,
  user_id_hash text,
  requested_at timestamptz,
  release_at timestamptz,
  attempt_count integer,
  outcome text NOT NULL,
  detail text,
  worker_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_deletion_audit_outcome_check CHECK (
    outcome IN ('processing_started', 'released', 'failed', 'skipped_cancelled', 'no_op')
  )
);

COMMENT ON TABLE public.account_deletion_requests IS
  'Server-authoritative account deletion requests. Client metadata is not a deletion authority.';
COMMENT ON TABLE public.sensitive_action_confirmations IS
  'Short-lived server-verifiable confirmations for sensitive actions such as account deletion.';
COMMENT ON TABLE public.account_deletion_audit IS
  'Append-only operational audit for account deletion attempts, failures, skips, and releases.';

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensitive_action_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletion_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.account_deletion_requests FROM PUBLIC;
REVOKE ALL ON TABLE public.account_deletion_requests FROM anon;
REVOKE ALL ON TABLE public.account_deletion_requests FROM authenticated;
GRANT SELECT ON TABLE public.account_deletion_requests TO authenticated;
GRANT SELECT ON TABLE public.account_deletion_requests TO service_role;

REVOKE ALL ON TABLE public.sensitive_action_confirmations FROM PUBLIC;
REVOKE ALL ON TABLE public.sensitive_action_confirmations FROM anon;
REVOKE ALL ON TABLE public.sensitive_action_confirmations FROM authenticated;
GRANT INSERT ON TABLE public.sensitive_action_confirmations TO service_role;

REVOKE ALL ON TABLE public.account_deletion_audit FROM PUBLIC;
REVOKE ALL ON TABLE public.account_deletion_audit FROM anon;
REVOKE ALL ON TABLE public.account_deletion_audit FROM authenticated;
GRANT INSERT ON TABLE public.account_deletion_audit TO service_role;
REVOKE ALL ON SEQUENCE public.account_deletion_audit_id_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.account_deletion_audit_id_seq FROM anon;
REVOKE ALL ON SEQUENCE public.account_deletion_audit_id_seq FROM authenticated;
GRANT USAGE ON SEQUENCE public.account_deletion_audit_id_seq TO service_role;

DROP POLICY IF EXISTS "account_deletion_requests_select_own"
  ON public.account_deletion_requests;

CREATE POLICY "account_deletion_requests_select_own"
  ON public.account_deletion_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_due
  ON public.account_deletion_requests (release_at, next_attempt_at)
  WHERE status IN ('pending', 'failed', 'processing') AND cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sensitive_action_confirmations_lookup
  ON public.sensitive_action_confirmations (user_id, action, token_hash)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sensitive_action_confirmations_expiry
  ON public.sensitive_action_confirmations (expires_at)
  WHERE consumed_at IS NULL;

CREATE OR REPLACE FUNCTION public.touch_account_deletion_request_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_deletion_requests_touch_updated_at
  ON public.account_deletion_requests;

CREATE TRIGGER account_deletion_requests_touch_updated_at
  BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_account_deletion_request_updated_at();

CREATE OR REPLACE FUNCTION public.request_account_deletion(confirmation_token text)
RETURNS public.account_deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
  confirmation_id uuid;
  request_row public.account_deletion_requests;
  hashed_token text;
BEGIN
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to request account deletion.'
      USING ERRCODE = '42501';
  END IF;

  IF confirmation_token IS NULL OR length(confirmation_token) < 32 THEN
    RAISE EXCEPTION 'Fresh confirmation is required to request account deletion.'
      USING ERRCODE = '42501';
  END IF;

  hashed_token := encode(extensions.digest(confirmation_token, 'sha256'), 'hex');

  SELECT id INTO confirmation_id
  FROM public.sensitive_action_confirmations
  WHERE user_id = calling_user_id
    AND action = 'account_deletion'
    AND token_hash = hashed_token
    AND consumed_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF confirmation_id IS NULL THEN
    RAISE EXCEPTION 'Fresh confirmation is required to request account deletion.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.sensitive_action_confirmations
  SET consumed_at = now()
  WHERE id = confirmation_id;

  INSERT INTO public.account_deletion_requests (
    user_id,
    requested_at,
    release_at,
    cancelled_at,
    status,
    attempt_count,
    last_attempt_at,
    next_attempt_at,
    processing_started_at,
    processing_worker_id,
    released_at,
    error
  )
  VALUES (
    calling_user_id,
    now(),
    now() + INTERVAL '14 days',
    NULL,
    'pending',
    0,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
  )
  ON CONFLICT (user_id) DO UPDATE
  SET requested_at = EXCLUDED.requested_at,
      release_at = EXCLUDED.release_at,
      cancelled_at = NULL,
      status = 'pending',
      attempt_count = 0,
      last_attempt_at = NULL,
      next_attempt_at = NULL,
      processing_started_at = NULL,
      processing_worker_id = NULL,
      released_at = NULL,
      error = NULL
  WHERE public.account_deletion_requests.status <> 'processing'
  RETURNING * INTO request_row;

  IF request_row.user_id IS NULL THEN
    RAISE EXCEPTION 'Account deletion is already being processed.'
      USING ERRCODE = '55000';
  END IF;

  RETURN request_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS public.account_deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
  request_row public.account_deletion_requests;
BEGIN
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to cancel account deletion.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.account_deletion_requests
  SET cancelled_at = now(),
      status = 'cancelled',
      processing_started_at = NULL,
      processing_worker_id = NULL,
      next_attempt_at = NULL,
      error = NULL
  WHERE user_id = calling_user_id
    AND status IN ('pending', 'failed', 'processing')
  RETURNING * INTO request_row;

  IF request_row.user_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN request_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_due_account_deletions(
  batch_limit integer DEFAULT 10,
  worker_id text DEFAULT NULL
)
RETURNS SETOF public.account_deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  effective_limit integer := LEAST(GREATEST(COALESCE(batch_limit, 10), 1), 50);
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service_role may claim account deletions.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH due AS (
    SELECT user_id
    FROM public.account_deletion_requests
    WHERE cancelled_at IS NULL
      AND release_at <= now()
      AND attempt_count < 10
      AND (
        status IN ('pending', 'failed')
        OR (
          status = 'processing'
          AND processing_started_at < now() - INTERVAL '1 hour'
        )
      )
      AND (next_attempt_at IS NULL OR next_attempt_at <= now())
    ORDER BY release_at ASC
    LIMIT effective_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.account_deletion_requests adr
  SET status = 'processing',
      processing_started_at = now(),
      processing_worker_id = COALESCE(worker_id, extensions.gen_random_uuid()::text),
      attempt_count = adr.attempt_count + 1,
      last_attempt_at = now(),
      next_attempt_at = NULL,
      error = NULL
  FROM due
  WHERE adr.user_id = due.user_id
  RETURNING adr.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_account_app_data(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service_role may delete account app data.'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.note_shares
  WHERE user_id = target_user_id;

  DELETE FROM public.note_tags nt
  WHERE EXISTS (
    SELECT 1 FROM public.notes n
    WHERE n.id = nt.note_id
      AND n.user_id = target_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.tags t
    WHERE t.id = nt.tag_id
      AND t.user_id = target_user_id
  );

  DELETE FROM public.notes
  WHERE user_id = target_user_id;

  DELETE FROM public.tags
  WHERE user_id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_account_deletion_failed(
  target_user_id uuid,
  failure_detail text
)
RETURNS public.account_deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  request_row public.account_deletion_requests;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service_role may mark account deletion failures.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.account_deletion_requests
  SET status = 'failed',
      error = left(COALESCE(failure_detail, 'Unknown failure'), 1000),
      processing_started_at = NULL,
      processing_worker_id = NULL,
      next_attempt_at = now() + (LEAST(GREATEST(attempt_count, 1), 8) * INTERVAL '15 minutes')
  WHERE user_id = target_user_id
  RETURNING * INTO request_row;

  IF request_row.user_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN request_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_account_deletion_skipped_cancelled(
  target_user_id uuid
)
RETURNS public.account_deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  request_row public.account_deletion_requests;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service_role may mark account deletion skips.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.account_deletion_requests
  SET status = 'cancelled',
      cancelled_at = COALESCE(cancelled_at, now()),
      processing_started_at = NULL,
      processing_worker_id = NULL,
      next_attempt_at = NULL
  WHERE user_id = target_user_id
  RETURNING * INTO request_row;

  IF request_row.user_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN request_row;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_account_deletion_request_updated_at() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.request_account_deletion(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_account_deletion(text) FROM anon;
REVOKE ALL ON FUNCTION public.request_account_deletion(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(text) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_account_deletion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_account_deletion() FROM anon;
REVOKE ALL ON FUNCTION public.cancel_account_deletion() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion() TO authenticated;

REVOKE ALL ON FUNCTION public.claim_due_account_deletions(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_due_account_deletions(integer, text) FROM anon;
REVOKE ALL ON FUNCTION public.claim_due_account_deletions(integer, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_account_deletions(integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.delete_account_app_data(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_account_app_data(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.delete_account_app_data(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_app_data(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mark_account_deletion_failed(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_account_deletion_failed(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.mark_account_deletion_failed(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_account_deletion_failed(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mark_account_deletion_skipped_cancelled(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_account_deletion_skipped_cancelled(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.mark_account_deletion_skipped_cancelled(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_account_deletion_skipped_cancelled(uuid) TO service_role;

COMMENT ON FUNCTION public.request_account_deletion(text) IS
  'Starts the 14-day account deletion grace period after consuming a fresh server-side confirmation token.';
COMMENT ON FUNCTION public.cancel_account_deletion() IS
  'Cancels the caller account deletion request if it is still pending, failed, or processing.';
COMMENT ON FUNCTION public.claim_due_account_deletions(integer, text) IS
  'Service-only worker claim function for due account deletions using row locking.';
COMMENT ON FUNCTION public.delete_account_app_data(uuid) IS
  'Service-only deletion of Yidhan app rows for a user. Auth user deletion remains in the Edge Function Admin API step.';
