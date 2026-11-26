Status: PROPOSAL
Last verified: 2026-11-26

# Design critique decisions

Decisions from going through the 2026-11-25 design critique
(`.impeccable/critique/2026-11-25T21-26-06Z__src-app-tsx.md`, score 24/40) one section
at a time on 2026-11-26. Each finding was checked against the code at `12a993c` before
deciding. Where the critique was wrong or incomplete, the entry says so.

This is a proposal. It does not replace `2026-11-07-public-launch-plan.md`, which stays
ACTIVE, and it sits beside `2026-11-24-launch-review-work-order.md`. Nothing here is
approved until it moves into the ACTIVE plan's **Now**.

## Four PRs

The work is grouped into as few PRs as the review rules allow. Security work stays apart
because it needs the multi-agent review. The toolbar stays apart from the copy so a red
E2E run points at one cause.

| PR | Contains | Review | Size |
|---|---|---|---|
| 1 · Honest session timeout | I1, I2 | Multi-agent | Hours |
| 2 · Wording and polish | G1 to G12, K1 to K9, K11, K12, roadmap #146 line | `/code-review` | Days |
| 3 · Editor | H1 to H12, L1 | `/code-review` | Days |
| 4 · Security presets | J1 to J4, K10, two-secrets `DECISIONS.md` entry | Multi-agent | Days |

Order: PR 1 first. PRs 2 and 3 can run at the same time, each in its own worktree. PR 4
starts after 2 and 3 merge. Whether PR 4 ships before launch is open.

PRs 2 and 3 are each likely to take more than one session on the same branch (`CLAUDE.md`,
one lane per session).

After all four merge: one VoiceOver or NVDA pass over sign-up, unlock, library, editor
and Settings (roadmap 68). Log findings as issues. Not a PR.

After launch, first:

- Roadmap 136, then 25: passphrase change.
- Roadmap 58, then 59: revision history.
- Roadmap 44: quick capture. Already queued as track F in the work order.

The work order's own queue (#288, #284, track F) comes first. These PRs do not change
that.

## Rules

The work order's "Rules for every track" apply. In particular: each "done when" ships as
a test with its "should not fire" cases, one changelog entry per PR, and confirm any
unverified item before changing it.

**Conflicts to expect:** PRs 2 and 3 both add changelog and `docs/progress.md` entries;
the second to merge rebases and renumbers. PR 2 edits `DemoPage.tsx` and `index.css`;
PR 3 edits `index.css` (toolbar strip). PRs 1 and 4 both edit `SettingsModal.tsx` and
`useSessionSettings.ts`; 1 merges first.

---

## PR 1 · Honest session timeout

PR title: `Session timeout always does what Settings shows`. Hours. Touches auth.

| ID | Change |
|---|---|
| I1 | `getEffectiveTimeout` returns the chosen timeout. Trusted device only unlocks "Never" and keeps its 90-day expiry. Remove `TRUSTED_DEVICE_TIMEOUT_MINUTES` and the "Extends session to 14 days" line (`useSessionSettings.ts:237`, `SettingsModal.tsx:294`). Today, with trusted device on, every choice except Never becomes 14 days while the dropdown still shows the choice |
| I2 | A "Change passphrase" row in the Security tab: "To change your passphrase, lock your notes and choose '…' on the unlock screen. You'll need your recovery key." Use the unlock screen's real button label |

Changelog note: a trusted device on the default timeout is now signed out after 1 week,
not 14 days.

Done when: with trusted device on and 30 minutes chosen, the session ends after 30
minutes of inactivity · unit test for each option.

Should not fire: "Never" still requires a trusted device. Trust still expires after 90
days, with its toast. Vault auto-lock and "Remember this browser" are unaffected.

---

## PR 2 · Wording and polish

PR title: `Plain wording, touch pin fix and small polish`. Days. Do not touch
`SettingsModal.tsx` (PRs 1 and 4) or the toolbar files (PR 3).

### Wording

| ID | Change | Where |
|---|---|---|
| G1 | Per-note permanent delete: title "Delete permanently?", body "This can't be undone.", button and icon label "Delete permanently". Remove "Release" and "This is a gentle goodbye." | `FadedNoteCard.tsx` |
| G2 | Bulk delete: title "Delete all faded notes?", body "N notes will be deleted. This can't be undone.", button "Delete all" | `FadedNotesView.tsx` |
| G3 | Account deletion: replace "Thank you for the quiet moments." with "Your account and notes will be deleted on {date}." Read the modal around line 311 first and keep what else it says accurate | `LettingGoModal.tsx` |
| G4 | Faded countdown: replace "Just arrived / Resting quietly / Fading gently / Nearly gone / Releasing today" with "Deleted in N days", "Deleted tomorrow", "Deleted today" | `FadedNoteCard.tsx` `getOrganicPhrase` |
| G5 | Conflict dialog: heading "This note changed on two devices". Subtitle "Choose which version to keep. You can also keep both." Deleted case: "You edited this note here, but it was deleted on another device." Use "This device" and "Other device" on the cards and the diff lines | `ConflictModal.tsx` |
| G6 | Sign-up action is "Create an account" on every button and link. With a reason: "Create an account to keep your notes". "Sign up" stays only as the Auth tab opposite "Sign in". "Start writing with Yidhan" on shared notes stays | `InvitationModal.tsx` ("Keep my thoughts"), `ImpermanenceRibbon.tsx` ("Sign up to keep them", and "Keep them" on phones), `LandingPage.tsx:165`, `demoStarters.ts` |
| G7 | Drop "vault" from user-facing text outside Settings: "Unlock your notes and try again"; "your account passphrase" in the backup dialog; the demo starter's "set up your vault". For `RecoveryKeyKit.tsx:56` ("Your vault changed on another device"), check what the error code means (passphrase change or key rotation) and word it to match | `EncryptedConflictModal.tsx:63`, `BackupPassphraseModal.tsx:123-124`, `RecoveryKeyKit.tsx:56`, `demoStorage.ts` |
| G8 | Generated passphrase: "Picked at random on this device: 6 words, very hard to guess. Keep it in a password manager or write it down." Add one sentence to `/security` giving the word count and bits | `PassphraseSetup.tsx:315`, `SecurityPage.tsx` |
| G9 | Setup done step: "Your passphrase opens your notes on any device. If you forget it, use your recovery key to choose a new one. A few starter notes are waiting." Check that the recovery flow tells the user that devices already open keep working until they next ask for the passphrase; add it there if not | `PassphraseSetup.tsx:263` |
| G10 | Delete undo toast: duration 8 seconds. Failure text "Couldn't restore the note. It's still in Faded notes." | `useNoteActions.tsx:122-151`, `DemoPage.tsx` |
| G11 | Landing FAQ on pricing: "Yidhan is free and open source. If paid storage for attachments is ever added, everything that is free today stays free." Change `index.html`'s shell too if it carries the FAQ | `LandingPage.tsx:250-255` |
| G12 | Grep user-facing copy for other mood words and metaphor (`quiet`, `gentle`, `truer`, `path`, `whisper`, `release`). Fix labels, headings and helper text. List anything left alone in the PR | `src/` |

Keep: the names "Faded notes" and "Letting go" (`DESIGN.md` Voice). Internal names
(`useReleasedDraft`, `daysUntilRelease`, `isVaultUnlocked`) stay.

### Touch and polish

| ID | Change | Where |
|---|---|---|
| K1 | **Bug.** On touch screens the unpinned pin button is `opacity-0` with no hover, so each card has an invisible 40px pin target in its top-right corner. Under `@media (hover: none)`, show it at the 40% it gets on hover. Check whether phones render the delete button (`NoteCard.tsx:349`); if so, same fix | `NoteCard.tsx:235` |
| K2 | Plain **N** creates a note in the library. Keep Ctrl+N for the installed app. Add N to the `?` modal, and check that the modal names both meanings of Ctrl+K | `useAppShortcuts.ts:46`, `KeyboardShortcutsModal` |
| K3 | Sync captions 11px to 12px | `SyncIndicator.tsx:51-63` |
| K4 | Placeholder contrast: add a placeholder token that passes 4.5:1 in every theme, and set `::placeholder` to it | `index.css`, theme tokens |
| K5 | Replace `opacity: 0.6` on "These starter notes are yours…" with `--color-text-secondary` | `DemoPage.tsx:571-580` |
| K6 | `text-wrap: pretty` on `.landing-section-body`, and in the `index.html` shell if it has the class | `index.css` |
| K7 | Remove the green radial glow over the demo library | `DemoPage.tsx` or `index.css` |
| K8 | "Practice space" in roman, not italic | demo header |
| K9 | Remove the search box's scale on focus. Keep the focus ring | `index.css` |
| K11 | The demo invitation modal shows at most once per browser. Check first; change only if it can show again | `DemoPage.tsx`, `InvitationModal.tsx` |
| K12 | Changelog page groups entries by day, so several patch versions in a day read as one update. Version numbers stay, in small text | changelog view |

### Docs

- `docs/roadmap.md` #146: add that Quiet Intelligence feature names (Daily Whisper, The
  Unsaid and the rest) must pass the `DESIGN.md` Voice rules.

Done when: no user-facing string says "Release", "gentle goodbye", "quiet moments",
"Two paths", "Keep my thoughts" or "Keep them"; every sign-up control says "Create an
account"; the countdown shows a day count; tapping the top-right corner of an unpinned
card on a touch device opens the note and the pin icon is visible · E2E at 375px; the
two `/demo` lines pass 4.5:1 in every theme · theme contrast test.

Should not fire: restore from Faded notes still works and is not renamed. The conflict
dialog's three actions keep their behaviour. The Auth "Sign up" / "Sign in" tabs are
unchanged. Locked notes and the released-draft banner keep their copy. On desktop the
pin and delete icons still hide until hover. N does nothing while typing in a field or
in the editor. Swipe to pin still works.

---

## PR 3 · Editor

PR title: `Editor: five-button toolbar, grouped menu, text size`. Days. Owns
`EditorToolbar.tsx`, `src/editor/editorCommands.tsx`, `RichTextEditor.tsx`,
`EditorSidebar.tsx`, and the per-note export menu in `Editor.tsx`.

| ID | Change |
|---|---|
| H1 | Primary row on all three toolbars (inline, phone bottom bar, sidebar rail): Bold, Italic, H1, Bullet list, Link. Link gets an icon. Focus mode and ⋯ follow |
| H2 | Remove `WIDE_COMMANDS`. The toolbar is the same at every width |
| H3 | Undo and Redo leave the inline toolbar and the sidebar rail. The phone bottom bar keeps them, as icons. The existing under-380px rule that hides them stays |
| H4 | Inline code and code block leave every toolbar. They stay in ⋯, the slash menu, backticks and Ctrl+E |
| H5 | Remove Align left, Right and Justify from ⋯ and the slash menu. Keep Centre, and make it a toggle: running it on centred text unsets the alignment. Keep the `TextAlign` extension, its shortcuts and the sanitizer rule, so existing notes keep their alignment |
| H6 | ⋯ lists only commands that are not in the row, under headings Text, Blocks, Insert, Edit, View. Focus mode is left out (it has its own button) |
| H7 | Layout: no box on the inline toolbar (transparent background, no border or shadow). Focus and ⋯ pushed to the right edge. Restyle `editor-toolbar-sticky` so no strip remains behind it. The phone bar stays centred |
| H8 | Smart typography: the toggle moves from ⋯ to Settings → Editor. The feature stays on by default |
| H9 | Insert commands: keep `/date` and `/now` in the slash menu only. Remove Time. All three leave ⋯ |
| H10 | Per-note export menu: drop "Download (.json)". Rename the icon's label to "Share and export" and put Share as letter first. The full-library JSON export in the header stays |
| H11 | `docs/ui-layout.md`: rewrite the toolbar section, and fix "JUST NOW" capitals and pill tags to match `DESIGN.md` |
| H12 | `DECISIONS.md`: a new entry. The overflow menu no longer lists every command; every command is reachable from the row plus ⋯. Refer to the 2026-09-10 entry |
| L1 | Text size (roadmap 109, narrowed): three steps, persisted per device, applied to the editor and note cards. Line length and typeface stay on the roadmap |

H8 and L1 add rows to Settings → Editor. That is not the Security tab, so it does not
conflict with PRs 1 and 4, but check before editing `SettingsModal.tsx`.

Done when: each toolbar shows exactly the H1 set (plus undo and redo on the phone bar);
⋯ shows about 16 grouped items; a note saved with `text-align: justify` still renders
justified after load and autosave; the text size survives a refresh · E2E.

Should not fire: the Playwright reachability check still finds every command on every
width, through the row or ⋯. Exactly one toolbar surface shows at each width
(`DECISIONS.md` 2026-09-10). Ctrl+K in the note still makes a link. Focus mode hides
the toolbars as before. Centre toggled twice leaves no `style` attribute. Slash commands
for removed toolbar items still work. Text size does not change the landing shell or
public pages. The manuscript glow still tracks the scroll at each size.

---

## PR 4 · Security presets

PR title: `Security settings: one choice per device`. Days. Starts after PRs 2 and 3
merge. Touches key storage and auth.

| ID | Change |
|---|---|
| J1 | One "On this device" choice with three presets, plus "Lock now". Draft values, to check against what the auth code supports before building: **Shared device**: auto-lock 15 min, Remember this browser off, signed in for 1 hour. **My device** (default): 60 min, off, 1 week. **Stay unlocked**: auto-lock off, on, 90 days |
| J2 | "Custom" shows when stored settings match no preset. The individual controls sit behind "Details" |
| J3 | The trusted-device flag goes away |
| J4 | Wording: headings "On this device" and "Recovery key". "Session & trust" goes. Status reads "Your notes are unlocked on this device" / "Your notes are locked", in the secondary text colour for both, no green. "Lock now" |
| K10 | Settings theme row: replace "Click to switch" with the current theme's name |

`DECISIONS.md`: why sign-in uses a password and encryption uses a separate passphrase.
The server checks the password, so it must never be able to derive the passphrase.
Rejected: a single secret with a derived auth hash (replaces Supabase password auth,
reworks password reset and recovery; a month or more). Rejected: leading sign-up with
Google and GitHub to avoid the password (pushes a privacy audience toward big accounts).

Constraints: "Remember this browser" stays default off, fails closed when localStorage
is unavailable, and every restore path still verifies the key-check (`CLAUDE.md`
security invariants). `auto-lock` versus `manual` and `sign-out` lock reasons keep their
storage behaviour.

Should not fire: existing users' settings are not changed by the upgrade; they land on
the matching preset or on Custom. Picking a preset never enables "Remember this browser"
where localStorage is unavailable.

---

## Decided against

- Keeping Quote in the primary row: reachable by `> ` and the slash menu.
- Removing code formatting: existing notes need it, and it is off the toolbar anyway.
- Removing the `TextAlign` extension: old notes would silently lose their alignment on
  the next autosave.
- Moving the New note button on phones: quick capture (44) fixes one-handed capture
  better without adding chrome.
- Changing the library arrange row: the critique gave no failure, only density.
- Changing the recovery key confirmation: pasting works at setup.
- Promoting passphrase change (136, 25) into launch: the recovery route already works,
  and two crypto changes near launch add risk. PR 1 adds a Settings row that points to
  it.
- Removing the subscription system and Bloom tier from the roadmap (pricing option A).
  The FAQ is changed instead (G11).
