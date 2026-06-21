-- Migration: Re-enable sharing with E2EE encrypted share links
-- Share content is encrypted client-side with a per-share random key.
-- The decryption key lives in the URL fragment (#k=...) and never reaches the server.
-- Server stores only ciphertext — zero-knowledge sharing.

-- 1. Add encryption columns to note_shares
ALTER TABLE note_shares ADD COLUMN encrypted_payload text;
ALTER TABLE note_shares ADD COLUMN iv text;
ALTER TABLE note_shares ADD COLUMN encryption_version smallint NOT NULL DEFAULT 1;
ALTER TABLE note_shares ADD COLUMN revoked_at timestamptz DEFAULT NULL;

-- 2. Widen share_token for new 22-char base64url tokens (was varchar(32))
ALTER TABLE note_shares ALTER COLUMN share_token TYPE varchar(64);

-- 3. Drop the disabled read-only policy from expire_shares_for_e2ee.sql
DROP POLICY IF EXISTS "Users can read their own shares (disabled)" ON note_shares;

-- 4. Re-enable owner management policies.
-- Split write policies so ownership is enforced at insert/update time.
CREATE POLICY "Users can read their own encrypted shares"
  ON note_shares FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own encrypted shares"
  ON note_shares FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own encrypted shares"
  ON note_shares FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own encrypted shares"
  ON note_shares FOR DELETE
  USING (auth.uid() = user_id);

-- 5. RPC function for public (unauthenticated) share lookup
-- Returns only ciphertext — no plaintext, no metadata, no enumeration.
-- Uniform empty result for not-found, expired, revoked, or soft-deleted note.
CREATE OR REPLACE FUNCTION fetch_shared_note(share_token_param text)
RETURNS TABLE (
  encrypted_payload text,
  iv text,
  encryption_version smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT ns.encrypted_payload, ns.iv, ns.encryption_version
  FROM note_shares ns
  JOIN notes n ON n.id = ns.note_id
  WHERE ns.share_token = share_token_param
    AND ns.revoked_at IS NULL
    AND (ns.expires_at IS NULL OR ns.expires_at > now())
    AND ns.encrypted_payload IS NOT NULL
    AND n.deleted_at IS NULL;
END;
$$;

-- 6. Grant execute to both anonymous and authenticated users
GRANT EXECUTE ON FUNCTION fetch_shared_note(text) TO anon;
GRANT EXECUTE ON FUNCTION fetch_shared_note(text) TO authenticated;
