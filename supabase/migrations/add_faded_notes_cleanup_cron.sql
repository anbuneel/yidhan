-- Automatic cleanup of expired faded notes (30+ days old)
-- Requires Supabase Pro plan for pg_cron extension
--
-- Run this migration after upgrading to Pro to enable server-side cleanup.
-- Until then, client-side cleanup runs on each app load via cleanupExpiredFadedNotes().

-- Step 1: Enable pg_cron extension (requires Pro plan)
-- Uncomment these lines after upgrading to Pro:
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Create the cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_faded_notes()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM notes
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  IF deleted_count > 0 THEN
    RAISE NOTICE 'Released % expired faded note(s)', deleted_count;
  END IF;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Schedule the cron job (requires pg_cron extension)
-- Runs daily at 3:00 AM UTC
-- Uncomment these lines after enabling pg_cron:
--
-- SELECT cron.schedule(
--   'cleanup-faded-notes',      -- job name
--   '0 3 * * *',                -- cron schedule (3 AM UTC daily)
--   'SELECT cleanup_expired_faded_notes()'
-- );

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('cleanup-faded-notes');

-- Manual test (safe to run anytime):
-- SELECT cleanup_expired_faded_notes();
