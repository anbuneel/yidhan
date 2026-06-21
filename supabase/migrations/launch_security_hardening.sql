-- Launch security hardening for public E2EE posture.
--
-- This migration intentionally does not preserve plaintext-note compatibility.
-- Yidhan is pre-public and migration pain is not a concern, so production
-- should fail fast if any server notes are still plaintext or partially
-- encrypted before enabling the stricter constraints below.

-- 1. Refuse to proceed if existing server notes violate the E2EE invariant.
DO $$
DECLARE
  unsafe_note_count integer;
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

  IF unsafe_note_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to enable launch E2EE hardening: % note row(s) are plaintext, partially encrypted, or retain plaintext title/content.',
      unsafe_note_count
      USING ERRCODE = '23514';
  END IF;
END $$;

ALTER TABLE public.notes
  DROP CONSTRAINT IF EXISTS chk_encryption_all_or_nothing;

ALTER TABLE public.notes
  DROP CONSTRAINT IF EXISTS chk_notes_e2ee_only;

ALTER TABLE public.notes
  ADD CONSTRAINT chk_notes_e2ee_only CHECK (
    encrypted_payload IS NOT NULL
    AND length(encrypted_payload) > 0
    AND encryption_iv IS NOT NULL
    AND length(encryption_iv) > 0
    AND encryption_version IS NOT NULL
    AND encryption_version >= 1
    AND content_hash IS NOT NULL
    AND length(content_hash) > 0
    AND COALESCE(title, '') = ''
    AND COALESCE(content, '') = ''
  );

COMMENT ON CONSTRAINT chk_notes_e2ee_only ON public.notes IS
  'Launch E2EE invariant: server note rows must contain encrypted payload metadata and empty plaintext title/content columns.';

-- 2. Make core RLS reproducible and remove public table-read sharing policies.
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_shares ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('notes', 'tags', 'note_tags', 'note_shares')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

CREATE POLICY "notes_select_own"
  ON public.notes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notes_insert_own_encrypted"
  ON public.notes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND encrypted_payload IS NOT NULL
    AND encryption_iv IS NOT NULL
    AND encryption_version IS NOT NULL
    AND content_hash IS NOT NULL
    AND COALESCE(title, '') = ''
    AND COALESCE(content, '') = ''
  );

CREATE POLICY "notes_update_own_encrypted"
  ON public.notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND encrypted_payload IS NOT NULL
    AND encryption_iv IS NOT NULL
    AND encryption_version IS NOT NULL
    AND content_hash IS NOT NULL
    AND COALESCE(title, '') = ''
    AND COALESCE(content, '') = ''
  );

CREATE POLICY "notes_delete_own"
  ON public.notes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "tags_select_own"
  ON public.tags FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "tags_insert_own"
  ON public.tags FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tags_update_own"
  ON public.tags FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tags_delete_own"
  ON public.tags FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "note_tags_select_own"
  ON public.note_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id
        AND notes.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.tags
      WHERE tags.id = note_tags.tag_id
        AND tags.user_id = auth.uid()
    )
  );

CREATE POLICY "note_tags_insert_own"
  ON public.note_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id
        AND notes.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.tags
      WHERE tags.id = note_tags.tag_id
        AND tags.user_id = auth.uid()
    )
  );

CREATE POLICY "note_tags_delete_own"
  ON public.note_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id
        AND notes.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.tags
      WHERE tags.id = note_tags.tag_id
        AND tags.user_id = auth.uid()
    )
  );

CREATE POLICY "note_shares_select_own"
  ON public.note_shares FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "note_shares_insert_own_note"
  ON public.note_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND encrypted_payload IS NOT NULL
    AND iv IS NOT NULL
    AND encryption_version IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_shares.note_id
        AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "note_shares_update_own_note"
  ON public.note_shares FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND encrypted_payload IS NOT NULL
    AND iv IS NOT NULL
    AND encryption_version IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_shares.note_id
        AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "note_shares_delete_own"
  ON public.note_shares FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Enforce encrypted, time-limited share rows for direct API callers.
DO $$
DECLARE
  unsafe_share_count integer;
BEGIN
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

  IF unsafe_share_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to enable share hardening: % share row(s) are unencrypted, unbounded, or exceed the 30-day launch TTL.',
      unsafe_share_count
      USING ERRCODE = '23514';
  END IF;
END $$;

ALTER TABLE public.note_shares
  DROP CONSTRAINT IF EXISTS chk_note_shares_e2ee_only;

ALTER TABLE public.note_shares
  ADD CONSTRAINT chk_note_shares_e2ee_only CHECK (
    encrypted_payload IS NOT NULL
    AND length(encrypted_payload) > 0
    AND iv IS NOT NULL
    AND length(iv) > 0
    AND encryption_version IS NOT NULL
    AND encryption_version >= 1
    AND expires_at IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.enforce_note_share_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    RAISE EXCEPTION 'Share links must have an expiration timestamp.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.expires_at > now() + INTERVAL '30 days' THEN
    RAISE EXCEPTION 'Share links cannot expire more than 30 days from now.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS note_shares_expiry_limit ON public.note_shares;

CREATE TRIGGER note_shares_expiry_limit
  BEFORE INSERT OR UPDATE OF expires_at ON public.note_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_note_share_expiry();

-- Public share access must go through this ciphertext-only RPC, not public
-- SELECT policies on notes/tags/note_tags/note_shares.
CREATE OR REPLACE FUNCTION public.fetch_shared_note(share_token_param text)
RETURNS TABLE (
  encrypted_payload text,
  iv text,
  encryption_version smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF share_token_param IS NULL OR share_token_param !~ '^[A-Za-z0-9_-]{22}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ns.encrypted_payload, ns.iv, ns.encryption_version
  FROM public.note_shares ns
  JOIN public.notes n ON n.id = ns.note_id
    AND n.user_id = ns.user_id
  WHERE ns.share_token = share_token_param
    AND ns.revoked_at IS NULL
    AND ns.expires_at IS NOT NULL
    AND ns.expires_at > now()
    AND ns.encrypted_payload IS NOT NULL
    AND ns.iv IS NOT NULL
    AND ns.encryption_version IS NOT NULL
    AND n.deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_shared_note(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fetch_shared_note(text) FROM anon;
REVOKE ALL ON FUNCTION public.fetch_shared_note(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_shared_note(text) TO anon;
GRANT EXECUTE ON FUNCTION public.fetch_shared_note(text) TO authenticated;

-- 4. Keep global cleanup functions out of normal authenticated reach.
CREATE OR REPLACE FUNCTION public.purge_old_deleted_notes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.notes
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_faded_notes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.notes
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  IF deleted_count > 0 THEN
    RAISE NOTICE 'Released % expired faded note(s)', deleted_count;
  END IF;

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_deleted_notes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_old_deleted_notes() FROM anon;
REVOKE ALL ON FUNCTION public.purge_old_deleted_notes() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_deleted_notes() TO service_role;

REVOKE ALL ON FUNCTION public.cleanup_expired_faded_notes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_faded_notes() FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_expired_faded_notes() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_faded_notes() TO service_role;

-- This migration helper bypasses triggers and is not needed once pre-launch
-- plaintext migration is no longer supported.
DROP FUNCTION IF EXISTS public.restore_note_timestamps(jsonb);

COMMENT ON FUNCTION public.fetch_shared_note(text) IS
  'Ciphertext-only public share lookup. URL fragment keys never reach the server.';
COMMENT ON FUNCTION public.purge_old_deleted_notes() IS
  'Service-owned cleanup for notes that have been soft-deleted for more than 30 days.';
COMMENT ON FUNCTION public.cleanup_expired_faded_notes() IS
  'Service-owned cleanup for notes that have been soft-deleted for more than 30 days.';
