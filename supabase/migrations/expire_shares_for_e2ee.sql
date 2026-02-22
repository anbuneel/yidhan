-- Migration: Expire all share links and revoke public access for E2EE
-- E2EE requires that note content is never readable by the server,
-- so all existing share links must be invalidated.

-- Delete all active share links
DELETE FROM note_shares;

-- Revoke public SELECT policy on notes (shared note viewing)
DROP POLICY IF EXISTS "Public can view notes with valid share token" ON notes;

-- Revoke public tag viewing for shared notes
DROP POLICY IF EXISTS "Public can view tags for shared notes" ON tags;

-- Revoke public note_tags viewing for shared notes
DROP POLICY IF EXISTS "Public can view note_tags for shared notes" ON note_tags;

-- Block ALL share operations: revoke the management policy
DROP POLICY IF EXISTS "Users can manage their own shares" ON note_shares;

-- Drop any other policies on note_shares (catch-all safety)
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'note_shares' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON note_shares', pol.policyname);
  END LOOP;
END $$;

-- Replace with read-only policy so existing code doesn't error on queries
CREATE POLICY "Users can read their own shares (disabled)"
  ON note_shares FOR SELECT
  USING (auth.uid() = user_id);
