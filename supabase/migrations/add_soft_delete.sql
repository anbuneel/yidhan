-- Migration: Add soft delete support to notes table
-- This adds a deleted_at column for soft-delete functionality
-- Notes with deleted_at = NULL are active, notes with a timestamp are "faded" (soft-deleted)

-- Add deleted_at column to notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Create index for efficient filtering of active vs deleted notes
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);

-- Create index for efficient querying of deleted notes by deletion date
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at_not_null ON notes(deleted_at) WHERE deleted_at IS NOT NULL;

-- Update RLS policies to handle soft-deleted notes
-- (The existing policies already scope to user_id, so no changes needed for security)

-- Optional: Create a function to auto-purge notes deleted more than 30 days ago
-- This can be called by a scheduled job or triggered manually
CREATE OR REPLACE FUNCTION purge_old_deleted_notes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notes
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (they can only delete their own notes due to RLS)
GRANT EXECUTE ON FUNCTION purge_old_deleted_notes() TO authenticated;

COMMENT ON COLUMN notes.deleted_at IS 'Timestamp when note was soft-deleted. NULL means active, non-NULL means faded/deleted.';
COMMENT ON FUNCTION purge_old_deleted_notes() IS 'Permanently removes notes that have been soft-deleted for more than 30 days.';
