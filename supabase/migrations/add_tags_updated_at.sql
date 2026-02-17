-- Add updated_at column to tags table for incremental sync support
-- This enables the sync engine to pull only changed tags instead of all tags,
-- and ensures server timestamps are used for sync cursor consistency.

ALTER TABLE tags ADD COLUMN updated_at timestamptz DEFAULT now() NOT NULL;

-- Backfill existing rows with their created_at value
UPDATE tags SET updated_at = created_at;

-- Auto-maintain updated_at on every UPDATE via trigger
CREATE OR REPLACE FUNCTION update_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tags_updated_at_trigger
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_tags_updated_at();
