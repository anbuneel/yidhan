-- Account deletion scheduler setup.
--
-- Replace the placeholders below in the live Supabase SQL Editor after the
-- process-account-deletions Edge Function is deployed and secrets are set.
-- Do not commit real function URLs or scheduler secrets to the repository.

-- Required extensions in Supabase:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- Example schedule: every day at 03:30 UTC.
-- Replace:
--   __PROCESS_ACCOUNT_DELETIONS_FUNCTION_URL__
--   __PROCESS_ACCOUNT_DELETIONS_SECRET__

-- SELECT cron.schedule(
--   'process-account-deletions',
--   '30 3 * * *',
--   $$
--   SELECT net.http_post(
--     url := '__PROCESS_ACCOUNT_DELETIONS_FUNCTION_URL__',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-account-deletion-secret', '__PROCESS_ACCOUNT_DELETIONS_SECRET__'
--     ),
--     body := jsonb_build_object('source', 'pg_cron')
--   );
--   $$
-- );

-- Verification:
-- SELECT jobid, schedule, command
-- FROM cron.job
-- WHERE jobname = 'process-account-deletions';

-- Rollback:
-- SELECT cron.unschedule('process-account-deletions');
