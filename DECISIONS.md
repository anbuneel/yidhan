# Decisions

Append-only, newest first. Why the codebase became what it is.

The historical core is immutable. Only two edits are allowed: flipping `Status`
to `Superseded` with a pointer to the replacement, and adding a dated erratum
(`**Erratum YYYY-MM-DD:** …`). Never rewrite the original reasoning — a decision
that turned out wrong is more useful with its reasoning intact than deleted.

This file carries **no live state**. No open-issue gates, no "do not change until
X", no `file:line` references offered as current guidance. Those rot, and an
immutable file containing them becomes confidently wrong. Current rules live in
`CLAUDE.md`.

Entries dated on or before 2026-03-22 are reconstructed from the plan documents
that recorded them: the working clone's git history is shallow and bottoms out at
that date, so commit evidence for older decisions is not available here. Their
reasoning is sourced from the plans now in `docs/archive/`, not invented.

---

## 2026-09-08 — Back to one ACTIVE plan

**Status:** Active

**Why:** The documentation overhaul shipped. Every box in its Execution section
is ticked and the six canonical docs it installed are the ones in use, so it is
COMPLETE and lives in `docs/archive/`. The second lane no longer exists.

The exception that raised `MAX_ACTIVE_PLANS` to 2 named that specific pair of
plans. An exception that outlives the thing it was granted for stops being an
exception and quietly becomes the default — which is the drift the cap exists to
prevent. The comment in `.githooks/pre-commit` justifying the 2 named a plan now
sitting in the archive, so it would have been false on its face.

The cap is 1 again. Raising it is still allowed and still needs an entry here
saying why, which is the same door the overhaul came through.

**Rejected:** Leaving the cap at 2 because a second plan might be wanted later —
nothing is using the slot today, and raising it again costs one paragraph at the
moment there is a real second lane, which is when the decision can actually be
judged. Deleting the cap now that the exception is spent — the cap is the only
thing that stopped nine documents claiming to own "now".

---

## 2026-09-08 — Adversarial cases are written before the happy path

**Status:** Active

**Why:** Item 43 (keyboard navigation over library cards) passed every gate —
typecheck, lint, the export audit, 1,255 unit tests and the browser suite — while
carrying six bugs. A second push fixed five and passed again with the sixth still
there. None were in the new code by itself. All six were where it met old code:

- `Delete` destroyed Practice Space notes outright, with no undo. The signed-in
  path fades with an Undo toast. A keystroke could take words back with no way
  to recover them.
- `Enter`, `P` and `Delete` acted on the selected card after `Tab` had moved focus
  to another control.
- Card shortcuts stayed armed behind an open dialog, including one that appears on
  its own and so never moves focus off the card.
- `P` passed the current pin state where the caller expects the desired one, so it
  never toggled.
- Selection could move to a card outside the viewport, with nothing scrolled.
- `Cmd/Ctrl+K` stopped focusing Practice Space search after leaving and returning
  to `/demo`, because the shortcut was rerouted through component state guarded by
  a module-scoped value that does not reset with it.

The item's "done when" was "library usable without a mouse; focus ring visible".
That says what the feature does. Tests written from it checked that and nothing
else, so every check passed. No test asked the other question: where should this
*not* fire? Acceptance criteria should keep saying what done means, so the fix is
in how tests are written, not in rewriting the criteria.

**Rejected:** Raising the coverage threshold or requiring a test count per item —
coverage was already enforced and already green; the gap was the kind of case
written, not the number. Requiring a reviewer sign-off before merge — the defects
survived an automated review pass and a human read of the summary, and a second
pair of eyes on the same happy-path framing finds the same nothing. Writing the
rule as "test edge cases" — too vague to act on, which is why the rule in
`CLAUDE.md` names the shapes: the other surface, behind a dialog, the wrong
target, after a remount.

---

## 2026-09-08 — The Playwright failure report is not uploaded from a credentialed CI run

**Status:** Active

**Why:** A Playwright failure report embeds the values typed into the page, in
plaintext. Verified with a canary string on the branch that made the `e2e` job
live: `playwright-report/data/<hash>.md` — the error-context attachment written on
every failure — renders the accessibility tree as
`textbox "Password" [active]: <the value>`, and the trace zip carries the same
string four more times across the action log and the source snapshot.
`type="password"` on the input is a rendering mask, not value redaction.

That matters because `loginUser()` now types the vault passphrase. Once
`E2E_TEST_PASSWORD` and `E2E_TEST_PASSPHRASE` are set as repository secrets, one
failing authenticated test would publish the test account's password *and* its
vault passphrase to anyone who can read the run's artifacts. The passphrase is
E2EE key material; the repository already treats leaked test credentials as an
incident (`docs/setup/e2e-testing-setup.md`, 2025-12-28).

So the upload step is gated on the credentials being *absent*. Without them there
is nothing to leak — the placeholders are in the workflow file — so the report
still uploads for the runs contributors and forks actually debug. A credentialed
run that fails prints a notice instead, pointing at local reproduction.

The cost is accepted and real: an authenticated test that fails only in CI has no
downloadable trace, which is exactly the case item 153 will care about. The fix
when that bites is a redaction pass over the report before upload, not re-opening
the upload.

**Rejected:** Turning off `trace` and `video` — the plainest leak is
error-context, which is written on the first failure whether or not tracing is on,
so this looks like a fix and is not one. Uploading with a shorter retention or a
restricted artifact — retention is not a permission, and the exposure is to
everyone who can read the run either way. Scrubbing the secrets out of the report
in the job — the right long-term answer, but a redaction pass that misses one
encoding fails open silently, and this PR should not be where that is written
under time pressure. Doing nothing because no secrets are configured yet — this
PR is precisely what makes the credentialed path executable for the first time.

---

## 2026-09-08 — The browser suite runs on placeholder Supabase values, not behind a secret gate

**Status:** Active

**Why:** `npm run e2e` had a CI job that was gated, step by step, on the
`VITE_SUPABASE_URL` secret being present. No secret was ever added, so the job
passed in seconds having run nothing. That is worse than no job: the suite read
as coverage while `e2e/auth.spec.ts` sat on `main` asserting behaviour item 45
had already replaced, green through CI on two PRs (#223).

`src/lib/supabase.ts` throws at import without a URL and anon key, so the app
cannot boot without them and the gate looked forced. It is not. The
unauthenticated half of the suite makes no Supabase network call — it exercises
routing, 404s, the public pages, the Practice Space (localStorage only), editor
fluency and cross-tab sync-lock ownership. Measured on this commit against
`https://placeholder.invalid`: 66 passed, 128 skipped, 0 failed across Desktop Chrome
and Pixel 5 — the same 66 the issue measured. 33 of the 97 tests per project need no
credentials. The
one unauthenticated spec that does POST to Supabase, "shows error for invalid
credentials", already accepts a connectivity error as a pass, so an unreachable
host is a pass by its own terms.

So the job now supplies placeholders when the secrets are absent and runs
unconditionally. A fork, a first-time contributor and the maintainer all get the
same gating suite; real secrets, when present, override the placeholders and add
the 64 authenticated tests per project on top.

The cost is accepted: the unauthenticated specs now prove only that the app works
against a Supabase that is not there. Any future spec that needs a real server
belongs in the authenticated half, which still skips without credentials. If a
spec is ever added that quietly depends on a reachable Supabase, it will fail on
forks first, which is the right place to find out.

**Rejected:** Keeping the gate on the Supabase secrets and ungating only once the
maintainer adds them — it leaves #223 open and keeps the job reading as coverage
it does not provide, and it makes contributor PRs and forks permanently ungated
even after the secrets land. Pointing the placeholder at a real but empty
Supabase project — a second project to provision and pay attention to, to buy
network calls that no unauthenticated spec makes. Splitting the suite into two
jobs, one ungated and one gated — the skip logic in `e2e/fixtures.ts` already
draws that line per test, and duplicating it in the workflow gives two places to
keep in agreement.

---

## 2026-09-07 — Two ACTIVE plans are allowed, capped at two

**Status:** Superseded by "Back to one ACTIVE plan" (2026-09-08)

**Why:** The one-ACTIVE-plan rule exists so "what are we working on now" has a
single answer. Two lanes were genuinely in flight and orthogonal: the product
engineering ledger and the documentation overhaul. Forcing one to PROPOSAL would
have made the file lie about what was being worked on, which is the failure the
rule was meant to prevent, not an instance of following it.

The cap was raised to two in `.githooks/pre-commit` rather than removed, so a
third ACTIVE plan still fails and raising it again requires an entry here saying
why. The `Last verified` requirement now applies to every ACTIVE plan, not just
the first one found.

The cost is accepted and real: with two ACTIVE plans, "now" has two answers, and
that only stays legible while the lanes stay orthogonal. If two ACTIVE plans ever
contend for the same files or the same week, close one.

**Rejected:** Deleting the cap entirely — it is the only thing stopping the
drift back to nine owners of "now". Keeping the overhaul at PROPOSAL — an ACTIVE
plan is supposed to describe reality, and the overhaul was reality. A per-lane
ACTIVE allowance — inventing a lane concept to justify a count of two is more
structure than the problem needs.

---

## 2026-09-07 — The execution ledger owns only committed work

**Status:** Active

**Why:** The 60KB ledger was the ninth owner of "what's true now", and it had
become internally inconsistent: items 5–22 appeared in **both** its Next and Done
tables, contradicting its own stated rule that every item sits in exactly one of
four lists. A file that contradicts itself cannot be the answer to "what next".

Split along ownership lines: shipped items to `docs/progress.md`, the 128
deferred items to `docs/roadmap.md`, review-coverage appendices frozen in
`docs/archive/`. Item numbers were preserved through the move because commit
messages, PR titles and GitHub issues cross-reference them — renumbering would
have broken that for no gain. The ledger keeps Now and Next only.

**Rejected:** Leaving the deferred items in the plan — a plan holding 128
someday-items is a roadmap wearing a plan's header, and it is what let the Next
list go stale unnoticed. Renumbering into the roadmap's own scheme.

---

## 2026-09-07 — The docs corpus is quarantined behind a retrieval lane rather than curated in place

**Status:** Active

**Why:** 132 of 169 markdown files had not been touched since the first commit in
visible history while 99 code commits landed on top. 45 live-lane docs still named
the pre-rebrand product "Zenote"; 21 described a share target that had been
deliberately removed. Stale docs are written in the same authoritative present
tense as current ones, so retrieval cannot tell them apart and a grep returns
confident wrong answers. Moving them to a flat `docs/archive/` excluded by a
repo-root `.ignore` fixes retrieval, which is the thing that actually hurts,
without destroying history.

**Rejected:** Per-document triage — it re-litigates the same judgment 95 times and
still leaves the reader trusting whatever survives. Deleting the corpus — archiving
is reversible and costs nothing. Warning banners on stale files — they help a human
reading one file and do nothing for a grep, which is how these docs are actually
read.

---

## 2026-09-07 — One owner per fact; six canonical docs, and no `status.md`

**Status:** Active

**Why:** Nine files claimed to own "what's true now" — `CLAUDE.md`, `README.md`,
`docs/Index.md`, `prd.md`, `roadmap.md`, `backlog.md`, the execution ledger, the
launch-readiness assessment, and `src/data/changelog.ts`. Three were separately
marked "Living Document", and `backlog.md` opened by deferring to the ledger. Every
task paid to reconcile them. Each fact now has exactly one owner and every other doc
links to it.

`status.md` is deliberately absent: it fails the update-trigger test. Nothing
compels a solo developer to refresh a standing summary, so it rots silently. The
one ACTIVE plan in `docs/plans/` owns "now" instead, because work moving *is* the
event that forces the plan to change.

**Rejected:** An `ARCHITECTURE.md` — its real content is invariants, and invariants
belong always-loaded in `CLAUDE.md` where an agent cannot violate what is in
context. Creating it would either duplicate tier 0 or move invariants out of
guaranteed context. Revisit only once `CLAUDE.md` genuinely overflows.

---

## 2026-09-07 — The instruction layer drops rituals that compensated for weaker harnesses

**Status:** Active

**Why:** `CLAUDE.md` mandated a per-document `Author: Claude (Opus 4.x)` header, an
`## Original Prompt` block, and a `-claude` filename suffix. 95 docs carried the
attribution across four different Opus versions, 86 carried the prompt block, and 77
files carried an agent-name suffix. All three encode *who typed it*, not what it is,
and the suffix actively misleads once a different model edits the file. A
409-line hand-maintained `docs/Index.md` and a context-exhaustion handoff prompt
served the same era. Agents glob and grep; the routing table is already in context.

**Rejected:** Renaming the 77 suffixed files — pure churn, and the archive is
non-authoritative anyway. Stripping stale headers from surviving docs — the same
churn for a smaller corpus.

---

## 2026-09-04 — Service worker `registerType` stays `'autoUpdate'`

**Status:** Active

**Why:** Under `'prompt'`, a new worker parks in `waiting` until the page posts
`SKIP_WAITING` — but a client running stale code cannot post it. Browsers stayed
pinned to an old precached shell indefinitely. This is what stranded clients on
pre-hardening code against an already-migrated database. The failure is invisible
in the main E2E suite because it runs against the dev server, which produces no
service worker at all; `npm run e2e:sw` exists specifically to cover it against a
real build.

**Rejected:** `'prompt'` with an update toast — it is the more polite UX and it is
exactly what broke. The politeness is worthless if the client that needs the update
is the one that cannot ask for it.

---

## 2026-09-04 — Fonts are self-hosted, never fetched from Google Fonts

**Status:** Active

**Why:** A third-party font origin is a privacy leak and a CSP hole on an app whose
entire proposition is that notes are private. Subsets live in `src/assets/fonts/`,
`font-src` in `vercel.json` allows `'self'` only, and the service worker precaches
them. Runtime font caching with `statuses: [0, 200]` is specifically avoided — it
can pin a browser to fallback fonts permanently.

**Rejected:** Google Fonts CDN for the smaller bundle and edge caching.

---

## 2026-07-14 — Account deletion is server-owned, with a 14-day grace period

**Status:** Active

**Why:** Client-driven deletion cannot be trusted to complete, and immediate
deletion has no recovery path for a mistaken or coerced action. A service-role
worker processes due requests, re-checks cancellation state, deletes app data,
deletes the Supabase Auth user, and writes an audit trail. OAuth accounts verify by
server-checked email OTP: typed-email confirmation is not proof of control of the
account.

**Rejected:** Immediate hard delete on request. Typed-email confirmation for OAuth
users — it proves the user knows their address, which is public information.

---

## 2026-06-21 — Server note rows must be encrypted; no plaintext compatibility path

**Status:** Active

**Why:** `launch_security_hardening.sql` requires encrypted payload metadata and
empty plaintext `title`/`content` columns, and intentionally *fails* if existing
rows violate that. A migration that silently tolerates bad rows leaves them
forever. Legacy plaintext rows were repaired before hardening and the repair tooling
was then removed: keeping a repair UI in launch builds means keeping a code path
that reads plaintext notes, which is the thing being eliminated. If preflight ever
reports unsafe rows again that is a data incident, and the app should fail closed.

**Rejected:** A tolerant migration plus a repair UI. It keeps the vulnerable read
path alive indefinitely to serve a population that should be empty.

---

## 2026-06-21 — `default_user_id_to_auth_uid.sql` is required, not optional

**Status:** Active

**Why:** Clients stopped sending `user_id` on note and tag inserts. Without the
column default, every create fails RLS (`42501`) or NOT NULL (`23502`) and blocks in
the sync queue. Because migrations are applied by hand, a client shipped ahead of
its migration fails **only on writes**, silently, while reads keep working — which
looks like a sync bug rather than a missing migration. `verify_migration_state.sql`
exists to catch exactly this drift.

**Rejected:** Continuing to send `user_id` from the client.

---

## 2026-03-22 — Dark themes use polarity-flipped CTAs

**Status:** Active

**Why:** The "gold luminance trap": darkening gold enough to carry white text at AA
produces dull olive. Dark themes instead use a bright gold background with dark
text. Measured contrast — Kintsugi 5.44:1, Washi 7.10:1, Midnight 8.55:1, Mori
7.29:1 — clears AA everywhere and AAA on the dark themes.

**Rejected:** A single CTA treatment across all themes with per-theme darkening.

---

## 2026-02-21 — Tags stay plaintext while note title and content are encrypted

**Status:** Active

**Why:** Notes are encrypted as a title+content JSON blob under AES-256-GCM with
AAD (`noteId:userId`), which prevents note-swapping. Tags are deliberately left in
plaintext so filtering, the `note_tags` junction, and RLS scoping stay server-side
queries. Encrypting tags would force every filter to become a full client-side
decrypt pass over the library.

**Rejected:** Encrypting tag names too. The metadata leak is real and accepted:
tag *names* are visible to the server, note contents are not.
