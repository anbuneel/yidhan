-- Migration: Enforce note ownership on note_shares INSERT/UPDATE
--
-- The original RLS policy only checks auth.uid() = user_id, but does not
-- verify that note_id belongs to the same user. Combined with UNIQUE(note_id),
-- an attacker who guesses a note UUID could block the real owner from creating
-- a share (DoS via constraint conflict).
--
-- Fix: Add WITH CHECK that validates note ownership on INSERT and UPDATE.
-- SELECT/DELETE continue to use the simpler USING clause (you can always
-- see/delete your own share rows).

-- Drop older policy shapes (created in add_note_shares.sql and enable_e2ee_sharing.sql)
DROP POLICY IF EXISTS "Users can manage their own shares" ON note_shares;
DROP POLICY IF EXISTS "Users can read their own shares" ON note_shares;
DROP POLICY IF EXISTS "Users can create their own shares" ON note_shares;
DROP POLICY IF EXISTS "Users can update their own shares" ON note_shares;
DROP POLICY IF EXISTS "Users can delete their own shares" ON note_shares;
DROP POLICY IF EXISTS "Users can read their own encrypted shares" ON note_shares;
DROP POLICY IF EXISTS "Users can create their own encrypted shares" ON note_shares;
DROP POLICY IF EXISTS "Users can update their own encrypted shares" ON note_shares;
DROP POLICY IF EXISTS "Users can delete their own encrypted shares" ON note_shares;

-- Recreate with note ownership checks on writes
CREATE POLICY "Users can read their own shares"
  ON note_shares FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create shares for their own notes"
  ON note_shares FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM notes WHERE id = note_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update shares for their own notes"
  ON note_shares FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM notes WHERE id = note_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own shares"
  ON note_shares FOR DELETE
  USING (auth.uid() = user_id);
