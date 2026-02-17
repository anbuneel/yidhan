-- Server-side trigger to enforce updated_at on notes table
-- This ensures the server is the sole timestamp authority, eliminating
-- clock-skew issues where a device with a fast clock pushes future
-- timestamps that cause other devices' incremental pulls to miss updates.

CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_updated_at_trigger
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_notes_updated_at();
