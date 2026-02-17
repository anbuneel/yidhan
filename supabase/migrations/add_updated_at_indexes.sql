-- Add composite indexes for incremental sync queries
-- These indexes support the pullRemoteChanges() queries:
--   WHERE user_id = ? AND updated_at > ?
-- Without them, each sync does a sequential scan on the entire table.

CREATE INDEX IF NOT EXISTS idx_notes_user_updated
  ON notes (user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_tags_user_updated
  ON tags (user_id, updated_at);
