-- Keep user-facing note chronology separate from the sync cursor.
-- updated_at remains server-authoritative for incremental sync.
-- display_updated_at preserves imported/history-aware ordering in the UI.

ALTER TABLE notes
ADD COLUMN IF NOT EXISTS display_updated_at timestamptz;

UPDATE notes
SET display_updated_at = updated_at
WHERE display_updated_at IS NULL;

ALTER TABLE notes
ALTER COLUMN display_updated_at SET DEFAULT now();

ALTER TABLE notes
ALTER COLUMN display_updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();

  IF TG_OP = 'UPDATE' AND NEW.display_updated_at IS NOT DISTINCT FROM OLD.display_updated_at THEN
    NEW.display_updated_at = NEW.updated_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS idx_notes_pinned_display_updated_at
ON notes (user_id, pinned DESC, display_updated_at DESC);
