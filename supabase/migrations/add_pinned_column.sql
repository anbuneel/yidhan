-- Add pinned column to notes table
-- This allows users to pin important notes to the top of their library

ALTER TABLE notes ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false NOT NULL;

-- Create an index for efficient sorting by pinned status
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes (user_id, pinned DESC, updated_at DESC);
