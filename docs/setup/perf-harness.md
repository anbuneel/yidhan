# Timing harness

A Playwright suite that times a production build under CPU throttling. It is a
before/after tool for the shell-size and snappiness work
(`docs/plans/2026-11-27-shell-size-and-snappiness-proposal.md`, item D1). It is not
a regression gate: CI checks only loose ceilings.

## What it measures

Every sample runs in a fresh browser context, so caches start empty. CPU is
throttled 4x through CDP (`Emulation.setCPUThrottlingRate`). The service worker is
blocked, so its precache download does not compete with what is timed.

| Metric | From | To |
|---|---|---|
| `boot.toLibrary` | navigation start | first frame with library cards painted |
| `boot.fcp` | navigation start | first contentful paint |
| `boot.longTasks`, `boot.tbt` | navigation start | library painted |
| `boot.settled.longTasks`, `boot.settled.tbt` | navigation start | network idle plus 1 s |
| `open.cold` | pointerdown on the long note's card | first frame with the editor visible and editable |
| `open.warm` | the same, second open in the same page | the same |
| `typing.p50`, `typing.p95` | each keydown | the frame after it |
| `typing.longTasks`, `typing.tbt` | first keystroke | 0.5 s after the last |
| `unlock.toLibrary` | pointerdown on Unlock | library painted, or the recovery-key offer |
| `unlock.longTasks`, `unlock.tbt`, `unlock.longestTask` | the same | the same |
| `unlock.maxFrameGap` | the same | the same: the longest gap between animation frames |
| `signedIn.libraryLoad` | keys available | notes set: local read plus decrypt (the app's own measure) |
| `signedIn.toCards` | navigation start (a reload) | first frame with cards painted |
| `signedIn.tbt`, `signedIn.longestTask` | navigation start | cards painted |
| `signedIn.noteCount` | — | live notes in the account, counted from Node |

Total blocking time (TBT) is the sum of each long task's time over 50 ms.
`unlock.maxFrameGap` is how long a spinner on the unlock screen could freeze. Unlock
time itself may not change when Argon2id moves to a worker; blocking and frame gap
should.

Start times are input event timestamps, so time an event spent queued behind a busy
main thread counts. End times are read two tasks after the `requestAnimationFrame`
callback that first sees the result: after that frame paints, and after any React
render that work scheduled. The second task is cheap insurance. Tiptap's update runs
inside the input event, so React most likely commits before the frame anyway.

Long tasks are clipped to the window: a task that only overlaps it counts only the
overlap, for both blocking time and the longest task.

Each metric reports the median across samples (5 by default; typing takes 3, each
of 60 keystrokes 100 ms apart, at the end of a 2,500-word note). The raw samples
are in the JSON.

The long note mixes headings, bold, italic, links, bullet lists and task lists, so
serialising it walks many nodes and marks. Its text is generated from a fixed seed.
The 40 short notes are plain paragraphs. Typing numbers recorded before 2026-11-27's
richer note (flat paragraphs only) are not comparable with later ones.

Notes:

- `open.cold` is the first Editor mount in the page, not the chunk download. The
  library preloads the Editor chunk, and the harness waits for the network to go
  idle before it clicks.
- The signed-out cases use a seeded Practice Space at `/demo` (`e2e-perf/seed.ts`):
  41 notes, fixed text, no Supabase. The signed-in boot path differs (Supabase,
  Dexie, decryption), so `boot.*` tracks the app shell's code, not a signed-in
  cold start.
- What desktop boot covers: only the first viewport of cards mounts, about 8 to 14
  of the 41, and the long note's card dominates them. The project is Desktop
  Chrome, so the swipe and pull-to-refresh wrappers never mount. Boot therefore
  includes the gesture libraries' parse cost, but not their mount or run cost.
  There is no mobile project yet.
- `unlock.*` and `signedIn.*` need the shared test account. They sign in, unlock,
  reload and count notes. They create and change nothing, so they leave no data
  behind. If the account has no recovery key, the recovery-key offer appears before
  the library; `unlock.*` stops there and says so in the notes. Each unlock sample
  is a password sign-in, so it takes at most 3.
- `signedIn.*` signs in and unlocks once, declines the recovery-key offer if shown,
  then reloads up to 5 times. A reload restores the keys from sessionStorage, so
  these samples have no Argon2id in them. The static server sends `no-cache` with no
  validators, so each reload fetches every asset again. If the unlock form is still
  up 5 s after a reload, the restore counts as failed and the case fails.
- An empty account paints its empty state outside `library-view`. The harness
  accepts that text as the end of a library wait.
- `signedIn.libraryLoad` comes from a `performance.measure` named
  `yidhan:library-load` in `src/hooks/useNotesSync.ts`, around
  `fetchDecryptedNotes`. Its names are fixed and it carries no detail. It is the
  only hook in `src/`. Read it next to `signedIn.noteCount`: a decrypt time means
  little without the library size. Sentry's `browserTracingIntegration` turns this
  mark and measure into spans on sampled page loads. They carry no note data. If
  tracing stays after the bundle work, `ignorePerformanceApiSpans: [/^yidhan:/]` in
  `src/utils/sentryClient.ts` would keep them out.

## Run it

```powershell
npm run e2e:perf
```

It builds for production first (`npm run build`, with the bundle budget check),
then serves `dist/` on 127.0.0.1. It takes about two minutes.

Not part of `npm run e2e`, `npm run e2e:sw` or `npm run check`: it has its own
directory (`e2e-perf/`) and config (`playwright.perf.config.ts`).

For the unlock case, put `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`,
`E2E_TEST_PASSPHRASE` and a real `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
in `.env.local`. Without them it skips. See `docs/setup/e2e-testing-setup.md`.

On a machine where `npx playwright install` does not work, point Playwright at
system Chrome:

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
```

Options, as environment variables:

| Variable | Default | Effect |
|---|---|---|
| `PERF_SAMPLES` | 5 | samples per metric (typing takes half, at least 3; unlock at most 3) |
| `PERF_CPU_THROTTLE` | 4 | CPU slowdown factor |
| `PERF_SKIP_BUILD` | unset | `1` reuses `dist/` as it is |
| `PERF_LONG_NOTE_WORDS` | 2500 | words in the long note used by `open.*` and `typing.*` |

Close other heavy programs first. The numbers are only worth comparing between runs
on the same machine, at the same throttle rate.

## Run only the signed-in cases

For someone with the test account's credentials:

1. Put these in `.env.local` at the repo root: `E2E_TEST_EMAIL`,
   `E2E_TEST_PASSWORD`, `E2E_TEST_PASSPHRASE`, and the real `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`. The build must use the real Supabase URL, so do not
   pass `PERF_SKIP_BUILD=1` on the first run after adding them.
2. Run the two cases alone:

   ```powershell
   npx playwright test --config playwright.perf.config.ts --reporter=line -g "shared test account"
   ```

3. Paste the printed table into the PR, or attach `perf-results/latest.json`. It
   holds `unlock.*` and `signedIn.*`, with the note count. It holds no credentials.

Without the credentials both cases skip and the run passes.

## Output

The run prints a table and writes `perf-results/<time>-<commit>.json` and
`perf-results/latest.json`. The folder is gitignored. Each file records the commit,
whether the tree was dirty, the machine, the browser version, the throttle rate and
every sample.

## Compare two runs

```powershell
git switch main; npm run e2e:perf; Copy-Item perf-results/latest.json perf-results/before.json
```

```powershell
git switch my-branch; npm run e2e:perf
```

```powershell
node scripts/compare-perf.mjs perf-results/before.json
```

The script prints before, after, the change and the change in percent for every
metric. It warns when the runs used a different throttle rate or CPU.

Run each side twice if a change is small. At 4x throttling a 10% swing between two
runs of the same build is normal; a change worth reporting is one that holds across
runs and is larger than that.

## CI

The `perf` job runs `npm run e2e:perf` and uploads `perf-results/` as an artifact.
It is its own job, so a missed ceiling never turns the service worker guard red. It
has no E2E secrets, so the signed-in cases skip.

The spec checks loose ceilings on four medians: `boot.toLibrary`, `open.cold`,
`open.warm` and `typing.p95`. They are set many times above the local baseline so a
slow shared runner does not fail them. They catch a step change, such as the Editor
never becoming editable or typing stalling for a second per key. Long-task counts,
TBT, frame gaps and the signed-in metrics have no ceiling: on a shared runner they
vary too much to mean anything.
