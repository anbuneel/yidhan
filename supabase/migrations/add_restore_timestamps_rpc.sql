-- RPC function to restore note timestamps after E2EE migration.
-- The notes_updated_at_trigger normally overwrites updated_at on every UPDATE,
-- which clobbers original timestamps during migration. This function bypasses
-- the trigger for the duration of the transaction using session_replication_role.
--
-- SECURITY DEFINER runs as postgres (superuser) so it can set replication role.
-- Explicit user_id check ensures users can only affect their own notes.

CREATE OR REPLACE FUNCTION restore_note_timestamps(
  note_timestamps jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
BEGIN
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Disable all triggers for this transaction only (safe, no global side effects)
  SET LOCAL session_replication_role = 'replica';

  UPDATE notes n
  SET updated_at = (t->>'updated_at')::timestamptz
  FROM jsonb_array_elements(note_timestamps) AS t
  WHERE n.id = (t->>'id')::uuid
    AND n.user_id = calling_user_id;

  -- Re-enable triggers (automatic at transaction end, but explicit for clarity)
  SET LOCAL session_replication_role = 'origin';
END;
$$;
