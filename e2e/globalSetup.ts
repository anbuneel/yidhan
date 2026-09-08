/**
 * globalSetup.ts — stamps the moment the run began.
 *
 * `globalTeardown.ts` deletes only rows created at or after this instant, which is
 * what makes the cleanup safe: it cannot reach anything that existed before the run,
 * on any account, however the credentials are pointed. Nothing here needs the
 * network — it only records a timestamp.
 */
export default function globalSetup(): void {
  // A second of slack. Postgres stamps created_at from the server clock, which can
  // sit slightly behind the runner's; without this a row written in the first moments
  // of the run could carry a timestamp just before it and survive the cleanup.
  process.env.E2E_RUN_STARTED_AT = new Date(Date.now() - 1000).toISOString();
}
