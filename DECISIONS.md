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

## 2026-11-09 — The design direction is Bright Spring: green on paper, a marigold accent, Fraunces and Source Sans 3

**Status:** Active

**Why:** Three design reviews (two in `docs/reviews/`, dated 2026-11-08 and 2026-11-09,
and one outside the repo) found these faults between them. The two themes share no brand
colour: light is terracotta, dark is gold. Dark's `#D4AF37` on near-black reads as a
luxury or crypto template. Light's terracotta on greige with a light serif reads as
Claude.ai. The Japanese framing (wabi-sabi, kintsugi, Muji, the enso) has no link to the
name, and the theme called Kintsugi has no gold in it. The owner reviewed all three on
2026-11-09 and decided the following. None of it is in the code yet; the token values
and the order of work belong to a themes and type plan in `docs/plans/`.

*Direction.* Bright Spring, the meaning of the name. The Japanese framing is dropped.
The logo entry below already made this move for the mark; this entry makes it for the
rest of the design.

*Colour.* Green is the brand colour in both themes. The light theme is a paper page.
Marigold `#F2A21B`, the sun in the logo, is the one small accent. It never carries text
on the light page, where it measures 1.9:1. The constraint is one brand across both
themes and the logo: green is the spring, marigold is the brightness, and both are
already in the logo.

*Night.* The page is `#0F1F18` and cards are `#163026`, the logo tile colour. The old
page `#050A06` reads as black on screen, so the green only showed on cards.

*Fonts.* Fraunces for titles and quotes, because it is the logo's font. Source Sans 3
for body text and UI. Cormorant Garamond is removed. Real italic font files are added:
today no italic face is shipped, so every italic is synthesized by the browser.

*Leaf corner.* The asymmetric corner (`2px 24px 4px 24px`) stays on note cards and the
editor sheet only. Applied to every card and small element, it read as a template quirk,
not as a shape with a meaning.

*Editor glow.* It stays, fainter. The reviews flagged glows as a template pattern. One
named the editor glow as worth keeping.

*Default theme.* The theme keeps following the device setting, as the code already
does. One review asked whether light should be the default.

**Rejected:** Persimmon or terracotta as the brand colour. It is too close to the
Claude.ai look, and it has nothing to do with the name.

**Rejected:** Gold in both themes. It turns mustard on a light page.

**Rejected:** Two brand colours, one per theme. That is the fault the reviews found:
switching themes changed the brand.

**Rejected:** Fraunces as the only font. Small UI labels in a serif can look fussy.

**Rejected:** Keeping Cormorant Garamond. Its thin strokes are weak at small sizes and on
dark backgrounds, and it would be a different serif from the logo.

**Rejected:** A fixed default theme, light or dark. A first visit should arrive in the
theme the device is already in.

---

## 2026-11-09 — New logo: a Fraunces wordmark with a sun on the i, and a "yi" monogram as the app icon

**Status:** Active

**Why:** The owner is moving the product away from its Japanese design language, starting
with the enso mark. The name comes from the owner's children, Ishya (spring) and Idhanth
(brightness). Both names begin with I, written இ in Tamil. The brief: carry spring and
brightness, hide இ well enough that a reader who doesn't know Tamil sees a logo rather
than a letter, and work for a writing app.

The logo is the wordmark: lowercase "yidhan" in Fraunces (SOFT 100, weight 440),
outlined, with a marigold sun as the dot on the i, set on the i's optical centre. Yidhan
stays the product name; "yi" is its monogram. The app icon is that monogram, taken from
the wordmark and cut heavier (weight 560, opsz 24), cream on an evergreen tile
(`#163026`), with the same sun dot. The favicon is a separate drawing of that tile for
16 to 48 px (weight 620, opsz 9, a wider y-i gap and a bigger dot), used on light and dark
tabs alike. A sprout under a sun arch, drawn on the shape of இ, stays as secondary artwork
for the splash screen, empty states and the About page. That is where the Tamil Easter
egg now lives. Existing "yi" apps were checked in the stores. YI Home's icon is a camera
outline, though its screenshots use a sans-serif "yi". The closest icon is YI Smart's
uppercase sans-serif "YI" on blue. The lowercase serif, sun dot and evergreen tile keep
Yidhan apart from both. This is not a trademark clearance. Sources, exports and
the review board are in `images/brand/`. The app
palette is not decided here; the themes are a separate decision.

**Rejected:** The sprout under the sun as the logo (two rounds). Three independent reviews
read it as a gardening, wellness or habit app, and found that the arch read as a doorway,
not a sun. Fixing its geometry would not change what a sprout signals. Reviewers also
recognised இ only once told.

**Rejected:** The letter drawn as one continuous line. Simplifying its crossing loop made
it look like an ear. A faithful tracing was legible as the letter but was not a picture.

**Rejected:** A lone "i" as the icon. A dotted i on a tile is the standard information
icon, and the name starts with Y.

**Rejected:** A "y" with the sun above it, or between its arms. The first reads as ẏ, or a
person with raised arms, and moves the sun off the i, so the icon stops matching the
wordmark. The second reads as a y holding a ball, and the sun clogs the fork at 16px.

**Rejected:** A pen nib in the mark. The owner wanted a logo that suits a writing app, not
one that depicts writing. The writing signal comes from the book typeface.

**Rejected:** A rounded sans wordmark (Outfit). It reads as a wellness app rather than a
place to write.

**Rejected:** A bare, untiled favicon. Its dark letters disappear on dark tab bars, and a
favicon cannot switch with the tab colour reliably.

---

## 2026-11-08 — Public pages get a static document each, built from their components

**Status:** Active

**Why:** Item 60 asks that `/privacy`, `/terms`, `/support`, `/security`, `/changelog` and
`/roadmap` be readable with JavaScript off. Until now each served `index.html`, so a
visitor without scripts saw the landing shell on every one of them, which the 2026-09-10
entry accepted.

Each page now has its own document, `dist/<page>.html`. A script run after `vite build`
renders the page component with `renderToStaticMarkup` and puts the markup where the
landing shell sits in a copy of the built `index.html`: same head, stylesheet, boot.js
and bundle, its own title and canonical URL. `/changelog` and `/roadmap` render from
`src/data/` at every build, so nothing is maintained by hand. Vercel serves the files
through six explicit rewrites ahead of the catch-all; `vite preview` finds them on its
own; the dev server, which the Playwright suite runs against, renders them on request
from the same module.

It is the 2026-09-10 pattern extended, not replaced. Nothing is hydrated: React's root
render replaces the static copy, as it replaces the landing shell. With JavaScript on,
boot.js already adds `boot-hidden` off `/`, and that class now hides the static copy
too, so the page loads exactly as before: hidden, then the public shell renders it. The
static copy shows only when boot.js never ran. Its theme comes from the OS, because the
stored choice needs boot.js; the dark tokens are repeated under
`prefers-color-scheme: dark` for a root with no `data-theme`, generated from the same
theme definition as `index.css`. The theme toggle and Sign in are hidden there, since
they need JavaScript, and the footer and in-text links render as plain links because no
handlers are passed.

The documents stay out of the service worker's precache: the script runs after the
worker is generated, and the budget check forbids any HTML but `index.html` in it. A
visitor with the worker installed has JavaScript and gets `index.html` from the precache
as before. No first-visit budget moves.

**Rejected:** A prerender with hydration — it would show the page sooner with JavaScript
on, but the server render cannot know the stored theme or whether the visitor is
signed in, so the first client render would disagree with it on both, and a signed-in
visitor on `/privacy` starts the app shell, not the public one. That mismatch was the
cost 2026-09-10 declined, and it buys nothing a JavaScript-off reader needs. Showing the
static copy with JavaScript on until React mounts — the lazy page chunk shows a loading
fallback first, so the page would flash from content to spinner to content; a change in
what JavaScript visitors see is out of item 60's scope. Hand-written HTML per route —
the changelog and roadmap change with every release, and copies drift. Precaching the
documents — they serve only visitors who cannot run the worker.

---

## 2026-11-08 — Session Replay waits for the app shell; a budget at its target is capped there

**Status:** Active

**Why:** Item 61 step 5 split the landing page and the public pages into a public shell
that loads no Supabase. With that done, the landing still requested 329 KB before
network idle against the 300 KB target, and 39 KB of it was Session Replay, which step 2
loads right after Sentry on every route but `/s/*`. The proposal's 300 KB arithmetic
counts "Sentry after `load` (~45 without Replay)", so the target assumed Replay was not
on the landing, but step 2 did not do that and nothing said so. Separately, the landing
JS measured 89.9 KB against its 90 KB target. The headroom rule (2026-11-08, "Ratcheted
bundle budgets carry 1 KB of headroom") would set its limit to 91 KB, which lets CI pass a
build that misses the target.

**Decision:** Replay loads once the app shell starts: at startup when the visitor has a
session, an auth callback or a non-public route, or at the handoff when they open
sign-in or leave the public routes. Sentry itself still loads after `load` on every
route, so errors on the public pages are still reported. Replay is still never loaded on
`/s/*`, and that is now checked again at the moment Replay would load, not only at page
start. A budget whose measurement meets its target has its limit capped at the target:
the lower of the target and the measurement plus 1 KB. The landing JS limit is 90 KB.

**Rejected:** Keeping Replay on the landing and leaving the page total over target.
Replays of a static, signed-out page show little, and the target is the item's "done
when".

**Rejected:** A 91 KB limit, following the headroom rule literally. The headroom exists so
small features in the entry path do not each need a budget decision. Since step 5, the
signed-in app is no longer in the landing's path, so features rarely touch it; growth
there past the target should need a decision.

## 2026-11-08 — A client-side conditional write is a launch gate; the server write contract is not

**Status:** Active

**Why:** An outside launch review found what the sync engine's own comments imply: the
note update reads the server row, compares timestamps, then updates filtered only by
id. A write from another device that lands between the read and the update is
overwritten with no conflict shown. The window is one round trip, so it is rare, but the
failure is a lost paragraph, and the plan's own rule says anything that can lose words
jumps the queue. The full fix, roadmap item 35, is a database RPC with an expected
version, a `client_mutation_id` and replay safety: a migration applied by hand, verified
against production, and a new failure mode (a lost response) to handle. That is weeks,
and it is not what the window needs.

**Decision:** Item 159 enters the launch plan: the same update also filters on the
`updated_at` the pre-write read returned, and a zero-row result re-reads the row to tell
stale from missing. Stale raises the existing conflict path with both versions
preserved; missing keeps the current reinsert. Item 35 stays on the roadmap as the
post-launch contract. Item 160, a one-time accessibility pass on the rendered app, also
enters the plan: WCAG AA is a hard constraint in `PRODUCT.md` and nothing has verified
it in a browser.

**Rejected:** Promoting item 35 whole. The RPC's replay safety protects against a lost
response after a successful write, which the current code already tolerates by
re-reading; the migration risk and the hand-applied step are not worth taking in the
week before launch for a window that a filter closes.

**Rejected:** Leaving the race for the writer cohort to find. A silent overwrite is the
one failure a writer cannot report, because nothing tells them it happened.

**Taken from the same review as copy, not items:** the account password and the vault
passphrase named as two different things in setup; "resetting your login does not
unlock your notes" where the reset is requested; what happens on other devices after a
recovery (into item 27); "Nothing to set up" qualified, and a support-page paragraph on
how a one-person free service is maintained (into item 156). **Recorded as roadmap
candidates:** Return to a thought (161), Make a book (162), Share just this passage
(163). **Declined:** moving import earlier than the launch story's eighth slot; Markdown
and JSON import already work, and the preview the review asks for needs the real parser
first.

---

## 2026-11-08 — A new account writes nothing until its recovery key is confirmed

**Status:** Active

**Why:** Item 27 sets new accounts up straight into the wrapped vault with a recovery
key. The key design covers migrating existing accounts (§3) and making a recovery key
for a vault that exists (§2.4); it says nothing about creating an account. Two choices
fell out. First, when to write: the passphrase is chosen in step 1 and the recovery key
is confirmed in step 2, and a tab can close in between. A vault written at step 1 with
no recovery key is the state the item forbids, and if the writer did not keep the
generated passphrase, nothing could open it. Second, what `K` is and what the legacy
fields say: the design makes `K` random, but a new account still needs
`encryption_salt`, which is what marks it as set up.

**Decision:** Step 1 only computes: a random 64-byte `K`, its wrap under an Argon2id KEK,
the vault key-check. Everything stays in memory until the writer has typed the
recovery key back. Then one `updateUser` call writes `encryption_salt`, a legacy
key-check made under a random key that is thrown away, and the whole vault including
`recoveryWrap`. An interruption before that write leaves the account unset, and the
next sign-in starts setup again at step 1; after it, the account is complete. The
write is refused when the account gained an `encryption_salt` since the page loaded.
The legacy key-check is retired from the start, as after a passphrase change: the
legacy derivation can never produce a random `K`, so an old client and the legacy
fallback answer "wrong passphrase" for a new account and fail closed. The suggested
passphrase is six words from the BIP-0039 English list with 217 words removed, about
65 bits; Argon2id at 64 MB per guess puts that out of reach of an offline search.

**Rejected:**
- *Write the vault at step 1 and mark the setup pending until the recovery key is
  saved.* The next sign-in could resume at step 2, but an account abandoned at step 1
  with an unsaved generated passphrase would hold a vault nothing can open.
- *Derive `K` from the passphrase, as the legacy setup did, so old clients can open new
  accounts.* It keeps `K` tied to the first passphrase, which the design moves away
  from (§1), and an old client could only open the account until the first passphrase
  change anyway.
- *Keep the legacy setup and let the first unlock migrate.* That is a second
  Argon2id run and a window with no vault and no recovery key, which the item rules out.
- *Seven words, about 76 bits.* Longer to type on a second device, for margin the
  Argon2id cost already provides.

**Revisit:** Item 136, when the vault moves to a table with a conditional write: the
"already set up" check becomes part of the write instead of a read before it. Item 86,
if a new account can write locally before its email is confirmed: setup would then have
to run before the first note.

---

## 2026-11-08 — A passphrase set after recovery retires the legacy key-check

**Status:** Active

**Why:** Item 26 runs §2.1 of the key design after a recovery-key unlock. §2.1 step 5
and §3.3 say to re-encrypt the legacy `encryption_key_check` so that an old client
opens with the *new* passphrase and not the old one. That cannot be built. The legacy
path uses whatever Argon2id derives from the passphrase and `encryption_salt` as the
note key. For a new passphrase that is never `K`, so a legacy key-check that the new
passphrase verifies would unlock with the wrong key: notes would not open, and new
notes would be written under a key no other device holds. The same holds for the
legacy fallback in this client (2026-11-08, the vault fallback entry).

**Decision:** The write that sets the new passphrase replaces the legacy key-check with
one made under a random key that is thrown away. No passphrase verifies it. An old
client, and the legacy fallback, answer "wrong passphrase" for both the old and the
new one, and fail closed. `encryption_salt` is left as it is. Item 25 should reuse
this. Two smaller choices made with it: the recovery key keeps working after it is
used, so the printed kit stays valid; and the keys a recovery key opens are held back
until the new passphrase is saved, so a refresh in between asks for the recovery key
again rather than skipping the new passphrase.

**Rejected:**
- *Re-encrypt the legacy key-check for the new passphrase, as §2.1 step 5 reads.* It
  unlocks old clients with the wrong key.
- *Leave the legacy key-check alone.* The old passphrase would keep opening the vault
  on an old client and on the legacy fallback, which is the revocation that did not
  happen that §3.3 warns about.
- *Retire the recovery key once used, and show a new one.* Safer if the key was seen
  while typed, but it adds a second kit to the moment the writer is already locked
  out, and replacing it is one step in Settings.

**Revisit:** Item 136, when the vault moves to a table with a conditional write. Item
25 and item 26's writes are then compare-and-set; today they are a fresh read, the
write and a read-back.

---

## 2026-11-08 — Ratcheted bundle budgets carry 1 KB of headroom

**Status:** Active

**Why:** The first-visit budgets (item 61) ratchet: each landed step lowers the limit to
what it measured. PR #246 set three limits at the exact measurement, rounded up to the
next KB, which left between 0 and 300 bytes of room. The next two PRs failed the build
for growth they could not avoid: #248 adds about 190 bytes to the app shell because the
decision to keep a released note's editor mounted has to run in `App`, and #247 adds
about 200 bytes for the vault unlock. Each would have needed its own budget decision for
a change smaller than a comment, and the second would have failed after the first landed.
The same tight limits also failed every Vercel preview, because Vercel inlines the
production Supabase key, which does not compress, and measures a few hundred bytes more
than CI's placeholder build.

**Decision:** A ratcheted limit is the CI measurement after the last landed step, rounded
up to the next whole KB, plus 1 KB. Limits still only move down, each time a step lands,
to the new measurement plus 1 KB. The targets in the proposal are unchanged. CI is the
only gate: on Vercel the script prints the same report as a warning and the deploy
proceeds (`e769d27`).

**Rejected:** Zero headroom, with a `DECISIONS.md` entry per PR that grows the entry path.
It turns every feature into a budget negotiation over bytes that a comment would outweigh,
and it blocks a lose-words fix behind a process step.

**Rejected:** Percentage headroom. One per cent of the app shell is 3.4 KB, enough for
the creep the ratchet exists to stop. One KB bounds creep between steps to less than the
smallest step saves.

**Rejected:** Moving #248's hook out of the entry path to fit. The hook decides whether the
editor stays mounted, which is `App`'s decision, and the review fixes it carries are the
point of the change.

---

## 2026-11-08 — A vault that does not open falls back to the legacy key path

**Status:** Active

**Why:** Item 24 adds the wrapped master key. The design says to read
`vault.wrappedKey` first and fall back to the legacy derivation only when the vault
is absent. It does not say what happens when the vault is present and does not
open. Read strictly, that is a wrong passphrase, and a corrupted or mis-written
vault would lock the user out on every new client, even though the legacy fields
still describe the same `K` and an old client still opens the account. Item 24's
rule is that a failed migration never leaves a user locked out.

**Decision:** When the vault is readable but does not unwrap, or unwraps and fails
its key-check, the unlock tries the legacy derivation with the same passphrase. If
the legacy key-check verifies, the vault unlocks with those keys and the event is
reported. The vault is never overwritten in that case. A vault with a version this
client does not know, or a malformed one, is treated the same way: legacy path, no
overwrite. A wrong passphrase on a migrated account now costs two Argon2id
derivations instead of one.

**Rejected:**
- *Fail closed on a vault that does not open.* Safe for secrecy, but it turns any
  bad vault write into a lockout on the current client, with no recovery short of
  an old client.
- *Rewrite the vault when the legacy path succeeds.* It would repair corruption,
  but it would also overwrite state this client does not understand. After item 25
  or 103 a mismatch can mean the vault is newer than the legacy fields, and
  overwriting it would undo a key change.

**Revisit:** Item 25. Once a passphrase change re-encrypts the legacy key-check
(design §3.3), the legacy path stops opening with a retired passphrase, so the
fallback cannot reopen one. Item 25 should confirm that and keep a test for it.
When a later release removes the legacy fields, the fallback goes with them.

---

## 2026-11-07 — The execution plan is superseded by a public launch plan

**Status:** Active

**Why:** The improvement plan had emptied its **Now** list; what remained was one
testing item blocked on the maintainer and the validation cohort. A fresh review
of the app against the landing page found that three promises on that page run
ahead of the product: "nothing to set up" leads to a passphrase that cannot be
recovered; "free and open source" has no licence file behind it; "not even us" has
no outside review behind it. Two more things fail under load rather than at rest:
the built-in Supabase auth email, and a first visit that pulls 270 KB of script and
a 6 MB precache. None of these is a feature. A plan organised around lanes of
product work had no place to say "these come before anyone is invited".

**Decision:** Open `docs/plans/2026-11-07-public-launch-plan.md` as the one ACTIVE
plan and flip the execution plan to SUPERSEDED. **Now** holds only launch blockers,
moved out of the roadmap with their "done when" intact (items 24, 26, 27, 60, 61,
81, 85, 86, 111) plus four new ones (154 licence, 155 page titles and sitemap, 156
honest hero, 157 domain and plan). **Next** lists the features to build after
launch, in order, but does not promote them: they stay on the roadmap, which owns
their acceptance tests, until each enters **Now**. Open bugs #205 and #207 gate the
launch from the issue tracker, not from the plan.

**Rejected:** Promoting the feature list into the plan as well. Twenty-five items in
one ACTIVE plan is a roadmap with a different heading, and it would have moved every
"done when" out of the file that owns it before anyone had decided to build them.

**Rejected:** Promoting item 104 (independent security review) as a launch blocker.
It needs item 101 (encrypted tag names), which is weeks of work, and an unmet need
cannot be promoted. Item 156 is the fallback: the hero claims only what the security
page can already back, and links to it.

**Rejected:** Leaving the old plan ACTIVE with a new "Launch" lane. Its lanes were
closed or shipped and its lookup table is history; a launch is a change of intent,
and the working agreement says a change of intent is a new plan.

**Revisit when:** the launch has happened. The plan then flips to COMPLETE and the
next plan starts from **Next**, reordered by whatever the first real writers say.

---

## 2026-09-14 — Modal focus containment uses `inert`, not a portal with `showModal()`

**Status:** Active

**Why:** The auth close-confirmation renders as a sibling of the auth dialog, and both
carried `aria-modal="true"` at once — a state some assistive technology, VoiceOver and
Safari notably, announces as two active modal containers. #189 proposed the textbook
remedy: portal the confirmation to `document.body` and call `showModal()` for a native
focus trap.

**Decision:** Mark the dialog behind the confirmation `inert` and drop its `aria-modal`,
leaving exactly one live container. `inert` also makes the form genuinely unreachable
rather than merely unlabelled, which is the half that actually traps a keyboard user.

**Rejected:** The portal plus `showModal()` route, for two reasons found by checking
before following it. jsdom does not implement `showModal` — `typeof dialog.showModal` is
`undefined` — so the native focus trap that is the whole point of the change could not be
asserted in any test. And `createPortal` appears nowhere else in this codebase, so one
call site would introduce a pattern the repo does not otherwise use.

**Revisit when:** several places need real portalled modals. At that point `showModal()`
is worth taking as a shared component, with whatever test-environment shim it needs, not
as a one-off here.

---

## 2026-09-14 — A leading raw-HTML block ends at the first blank line, not at the end of the file

**Status:** Active

**Why:** `markdownToHtml` short-circuited on its first line: an input opening with a
block tag was returned as sanitized raw HTML in its entirety. That shortcut exists to
reverse our own export fallback — `htmlToMarkdown` stores a note as a raw HTML block
when the regex serializer would mangle it — but `App.tsx` calls the same function on
arbitrary uploaded `.md` files, where it misfires. A note that merely *opens* with a
literal tag, say one about HTML starting `<p> tags define paragraphs...`, had its
entire remainder returned verbatim, so real Markdown below rendered as literal text.
CommonMark explicitly permits a leading raw-HTML block followed by Markdown, so this
was valid input we mishandled. Filed as #208.

The import path cannot tell "our own fallback block" from "a Markdown file that starts
with a tag" by inspection — there is nothing to compare an arbitrary upload against,
unlike the export path, which guards its fallback with a round-trip check.

**Decision:** Honour CommonMark's own rule. A raw HTML block runs until the first blank
line; everything after it is parsed as Markdown. Our export fallback is a single block
with nothing after it — Tiptap's `getHTML()` emits no blank lines — so it still returns
verbatim and already-exported files keep round-tripping unchanged.

**Rejected:** An explicit marker or fenced wrapper around fallback blocks on export.
It would make the two cases distinguishable, but it changes the export format and
breaks every file already exported, to fix input we can handle correctly without it.

**Rejected:** Accepting the limitation and documenting it. The failure is silent and
looks like corruption to the person importing; no notice makes that acceptable.

**Cost:** The passthrough is now recursive over blank-line-separated blocks. The
remainder must have its leading blank lines stripped before recursing or a remainder
that itself opens with a tag matches at offset zero and recurses forever — that bug
was written and caught by its own test before merge.

---

## 2026-09-14 — Markdown export stays synchronous, and its cost is accepted

**Status:** Active

**Why:** `htmlToMarkdown` verifies its own output before returning it, falling back to
a raw sanitized HTML block when the conversion would be lossy. Because Tiptap always
emits a top-level block element, essentially every real note takes that path, so every
note pays sanitize → convert → sanitize → compare on top of the conversion. Measured in
jsdom: ~9ms for a twenty-paragraph note, and a whole library in one pass ran ~0.9s at
100 notes, ~5s at 500, ~19s at 1000 — the import ceiling. A full account backup is
exactly where a user has the most notes. Filed as #209.

**Decision:** Keep the verification, keep the loop synchronous, and accept the cost —
which #209's own acceptance criteria allow, as the alternative to not blocking.

**Rejected:** Chunking the loop and yielding to the main thread between batches. This
was implemented first and reverted during review of #240. `downloadFile` triggers the
download by clicking an anchor, and browsers only honour a programmatic download while
the user activation from the originating gesture is still live. Yielding pushes that
click past many event-loop turns — on a 500-note library, several seconds and hundreds
of task boundaries after the click — so the very libraries the change was meant to help
are the ones whose download a browser may silently decline. A slow export the user
waits through is a far better failure than a backup that appears to succeed and saves
nothing. The synchronous call is now pinned by a test that fails if any `await` is
introduced before `downloadFile`.

**Rejected:** Verifying only constructs the serializer is known to struggle with. It
would cut the cost most, but the check is the thing standing between a lossy regex
conversion and a silently corrupted note, and the list of constructs it must cover is
the same list that has no tripwire today.

**Rejected:** Caching by content hash. It helps a repeat export of an unchanged library
and does nothing for the first one, which is the case that hurts.

**Left open:** Making a large export responsive needs a progress indicator and a second
user gesture to save, or the conversion moved to a worker. Both are UI changes rather
than a yield, and neither belongs in a cleanup PR.

---

## 2026-09-10 — One toolbar per width in the editor

**Status:** Active

**Why:** PR #219 kept the inline toolbar on every desktop width and added the vertical
sidebar beside it from 1100px, so that every command stayed mouse-reachable from one
surface. On a wide screen that put two toolbars on one note: a strip under the title and
a rail in the margin, both offering Bold, Italic and the rest. Two surfaces for one job
is the opposite of the quiet page the product promises, and the sidebar's overflow menu
already lists every command, so the sidebar can carry the wide layout alone. From
1100px the inline toolbar is hidden again wherever the sidebar renders, as it was before
#219. 768px to 1099px keeps the inline toolbar; phones keep the bottom one. Touch
tablets never render the sidebar, so they keep the inline toolbar at every width —
before #219 they had no toolbar at all above 1100px, which is the one thing #219's
layout fixed and this keeps. The Playwright reachability check now also asserts that
exactly one surface is visible at each width.

**Rejected:** Keeping both and dimming the inline toolbar — the count is the problem,
not the contrast. Dropping the sidebar instead — it is the surface that was there first
and the one the wide layout was designed around. A preference — a setting hands the
decision back to the writer.

## 2026-09-10 — A static first screen in the shell, not a prerender

**Status:** Active

**Why:** The app mounts into an empty root, so a share link opened to a blank page until
the whole bundle had arrived and run. Roadmap item 60's answer is to prerender the public
routes and hydrate, and it is a weeks-long item because hydration has to agree with two
things that live only in the browser: the theme, and whether the visitor is signed in.
Launch needed the first second fixed now. So `index.html` carries a static copy of the
landing's first screen, styled by an inline block that mirrors the landing CSS and both
themes, and a tiny same-origin script runs before paint to set the theme the way
`useAppTheme` would and to hide the shell on any path but `/` or when a Supabase
session key exists. React's root render replaces the shell's children, so there is no
hydration and nothing to keep in sync at runtime; the only coupling is copy and CSS
values, which the shell's comment says to keep in step. The script is a file rather than
inline because the Content Security Policy allows only same-origin scripts, and a hash
would have to change with every edit.

**Rejected:** Prerendering with hydration now — the mismatch risk on theme and session is
the whole of item 60's cost, and it is not worth carrying before launch. A loading
spinner in the shell — it fixes the blank page by showing a different nothing. Showing the
shell on every route without JavaScript — it does, and that is accepted: a visitor with
scripts off cannot use the app anyway, and the shell at least says what Yidhan is.

**Erratum 2026-11-08:** The accepted limitation, the landing shell on every route without
JavaScript, is superseded for the six public pages by item 60 ("Public pages get a
static document each, built from their components"). Every other route still serves
`index.html` and its shell.

---

## 2026-09-10 — The landing page shows the product beside the promise

**Status:** Active

**Why:** Four landing pages have shipped since January and none turned a visitor's
attention into a sentence about what Yidhan is. The archive blamed the first three on
their arrangement — a headline beside a product card, the shape of every SaaS hero. The
fourth removed the product entirely and led with mood, and it failed the same way. The
common factor was never the layout. In every version the copy pitched a feeling and never
said "notes", the card showed fiction, and the encryption promise arrived last and hedged.
The fourth also revealed a plain textarea as its signature moment while the real editor
sat one route away.

This version names the product in the headline, carries both messages in the
sub-headline — nothing to set up, locked on the device before it syncs — and renders the
real editor beside them as a static picture under an overlay button, so the page shows the
editor rather than imitating one. Every "Try writing" opens the Practice Space draft at
every width; the account is asked for from inside the Practice Space, or from one link
under the preview. Proof is one line of facts and the promise is stated once. The Practice
Space starters became four short personal notes so the landing samples and the Practice
Space agree about what a first note looks like.

**Rejected:** A single centred column with the editor below the headline — it cannot hold
a headline, a sub-headline, a button, a legible editor and a proof line in one 1440×900
viewport without shrinking the editor, which is the one thing that must not shrink. A live
editor in the hero — a textarea demonstrates nothing the real editor does not, and on a
phone the keyboard fights any in-place transition; the one-tap route from item 45 stands.
A full-bleed dark trust band, a proof rail with dividers and a "Why Yidhan" nav item — the
elements that make a page read as a product site; the calm is in the chrome, not the
columns. Deferring the privacy message below the fold — it is the answer to "why not the
notes app already on the phone", and the unencrypted trial is disclosed once in the
preview footer rather than by hedging the promise three times.

---

## 2026-09-10 — The editor's header title waits for the scroll, and its width floor moves into JS

**Status:** Active

**Why:** The note title rendered twice (ledger item 83). The header copy was hidden by
`hidden sm:inline`, so a phone in portrait was fine and everything from 640px up was
not: a phone in landscape, a small tablet, and every desktop sitting at the top of a
note showed the title twice.

The cheaper fix was to hide the header copy on mobile through `useMobileDetect()`
instead of the CSS breakpoint. It was rejected. It swaps one width test for another and
leaves the desktop duplication in place, which is the same defect at a width nobody
called mobile.

The header copy is a scroll-to-top button. It has nothing to say while the title it
scrolls to is on screen, so it now appears only once the editable title has passed under
the header. Its `display` is written straight to the node from a rAF-throttled scroll
handler, the same pattern as the manuscript glow, because scrolling the editor must not
re-render it. Focus mode is checked in the same expression: it strips the chrome, and a
fix for a doubled title must not put chrome back.

The 640px floor survives, but as a term in that expression rather than a `sm:` class.
Below it the header is already logo, save status, delete, theme and avatar, which leaves
far less than the 200px the breadcrumb reserves — it would overflow the row, and
WhisperBack already offers scrolling back at every width. Leaving the floor in CSS would have meant two owners of one
question, which is how the original defect read: a class that answered "is there room?"
being used to answer "is this a duplicate?".

Scroll is not the only thing that moves a title. A rotation into landscape crosses the
width floor without scrolling, and the resume chip and the remote-update banner are in
flow above the writing area, so showing one carries the title back under the reader's
eye at an unchanged scroll position. The handler therefore listens for resize and
watches the scroll container's own children, not just scroll.

---

## 2026-09-10 — List view goes back to the roadmap unbuilt

**Status:** Active

**Why:** Item 30 — a one-line-per-note list view with a header toggle — was the last
item in Lane E and the only one left that was not blocked on the maintainer. It was
deferred rather than started, on the grounds that it makes the app more complicated.

A second layout is not one feature. Every library feature now has to work in both:
temporal chapters, keyboard navigation, the preview mask and age fade, ranked search
results, and the arrange controls — five things that shipped in the last two days
alone. The plan itself expected the cost: item 99 exists to virtualize the list once
someone measures 2,000 notes, which reads as an admission that item 30 ships something
slow and fixes it later.

Nothing in the product said a list view was wanted. `PRODUCT.md` describes a calm
surface, and the cards are that surface. Item 87 — the validation cohort of 8 to 12
writers — is the mechanism for finding out what readers actually want, and it is now
unblocked. Building a second layout before asking would be answering a question nobody
had put.

So it returns to `docs/roadmap.md` with a start condition rather than a number: when the
cohort asks for one. Items 98 and 99 keep depending on it and stay deferred behind it.

**Rejected:** Building it now because it was already in the plan — being in the plan is
not evidence, and the plan's own rules say order changes when a real writer or a
measurement says so. Refusing it permanently in `PRODUCT.md` — this is a "not now", not a
principle; a writer with two thousand notes may well want a denser view, and that is
exactly what the cohort would surface.

---

## 2026-09-08 — The in-memory search index stays on the main thread

**Status:** Active

**Why:** Item 51 says to add a Worker only after measurement shows the main thread is
a problem. A local 10,000-note generator now lives beside the search tests; it does not
pretend to be item 80's fixture, which has not been built. On this machine, 40 mixed
queries measured 42.13 ms at p95 and 79.91 ms at the maximum. Building the index took
306.98 ms, and reconciling one edited note and running its query took 11.13 ms. The
benchmark excludes HTML-to-text sanitization because item 11 already owns and caches
that cost; it measures the index work item 51 adds.

Those numbers leave the 200 ms query budget clear and show that the incremental path is
short. The hook therefore keeps synchronous query results and a component-owned index.
The index contains plaintext title and content only in process memory. It is never
exported or connected to localStorage, IndexedDB, or a network API. Persisting an
encrypted index remains item 142.

**Rejected:** A Worker now — it would add asynchronous lifecycle, message ordering, and
plaintext copies across the thread boundary without fixing a measured latency problem.
Move the same index behind a Worker only if browser measurements on real libraries show
long main-thread tasks or the 200 ms p95 budget fails.

---

## 2026-09-08 — MiniSearch earns the search dependency

**Status:** Active

**Why:** Item 51 needs ranked title and content fields, controlled fuzziness, and exact
incremental add, replace, and removal. MiniSearch supplies those primitives directly.
It has no runtime dependencies, supports a per-field boost and edit-distance cutoff,
and lets the hook remove the exact old document before adding its replacement. The app
still places every title match ahead of content-only matches explicitly, then uses the
library score within those tiers.

The feature increases the production entry chunk by 19,638 bytes raw and 6,787 bytes
gzip against the same `origin/main` build. That is a real runtime cost, but it replaces
a linear scan with the ranking, prefix search, fuzziness, and mutable index this item
requires. Fuzzy matching starts at four characters, is weighted below exact and prefix
matches, and is capped at two edits. Quoted phrases stay exact.

**Rejected:** FlexSearch — its strongest advantages are raw throughput, configurable
tokenizers and encoders, and built-in Worker variants. The measured workload does not
need a Worker, and its tokenizer/encoder approach would require more policy around
field-result merging and typo tolerance than this search contract needs. A hand-built
index was also rejected: it would save a small bundle addition by taking ownership of
ranking and fuzzy-search correctness indefinitely.

---

## 2026-09-08 — Chapter grouping owns the within-chapter order

**Status:** Active

**Why:** Item 48 lets the reader pick which timestamp decides a chapter and how notes
order inside one. The order could have lived in `useVisibleNotes`, which already sorted
the library before filtering, with `groupNotesByChapter` left as a pure grouper. It
lives in `groupNotesByChapter` instead, because that function is called twice per render
from two places: `ChapteredLibrary` to draw the cards, and `useLibraryCardNavigation` to
build the keyboard order. A sort held anywhere else is a sort the second caller can
disagree with, and a keyboard that walks notes in an order the reader cannot see is the
same defect shape item 43 shipped six of.

Two rules fall out of the same reasoning. Pinned notes ignore the basis — a pinned note
is pinned whichever timestamp is read — while the order *within* Pinned does follow the
chosen sort, since Pinned is a chapter like any other. And grouping only reorders: every
note in, exactly once out, under any arrangement. Nothing about the reader's choice may
filter, or a search result would quietly stop being one.

Ties are broken explicitly — newest edit, then id — rather than left to `Array.sort`
stability over whatever order the caller happened to supply. Duplicate titles and
identical timestamps are common (an untitled note, a bulk import), and an order that
depends on the input order shuffles when an unrelated note changes.

**Rejected:** Sorting in `useVisibleNotes` and leaving grouping pure — the two callers
drift, as above. Sorting in `ChapterSection` — the keyboard order never sees it at all,
and item 49 is in that file. Making the card's timestamp follow the basis in the same
change — it is the right thing to do and is recorded as unfinished in
`docs/progress.md`, but it lands in `ChapterSection` and `NoteCard` alongside item 49's
age-fade work, so it waits for that to land rather than colliding with it.

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
