-- Allow public access to notes that have a valid, non-expired share token
-- This fixes the issue where unauthenticated users couldn't view shared notes
-- due to the existing RLS policy requiring auth.uid() = user_id

-- Policy for public access to shared notes
CREATE POLICY "Public can view notes with valid share token"
  ON notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM note_shares
      WHERE note_shares.note_id = notes.id
        AND (note_shares.expires_at IS NULL OR note_shares.expires_at > now())
    )
  );

-- Also need to allow public access to tags for shared notes
-- (so tags display correctly on shared note view)
CREATE POLICY "Public can view tags for shared notes"
  ON tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM note_tags
      JOIN notes ON notes.id = note_tags.note_id
      JOIN note_shares ON note_shares.note_id = notes.id
      WHERE note_tags.tag_id = tags.id
        AND (note_shares.expires_at IS NULL OR note_shares.expires_at > now())
    )
  );

-- Also need public access to note_tags junction for the join to work
CREATE POLICY "Public can view note_tags for shared notes"
  ON note_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM note_shares
      WHERE note_shares.note_id = note_tags.note_id
        AND (note_shares.expires_at IS NULL OR note_shares.expires_at > now())
    )
  );
