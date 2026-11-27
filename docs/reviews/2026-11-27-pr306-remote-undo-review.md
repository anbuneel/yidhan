# PR #306 review: apply remote updates outside undo history

Multi-agent code review, id `a3f19c07`, 2026-11-27. Base `main` at `425771b`. Closes #284.

## Reviewers

| Reviewer | Independence | Rounds run | Result |
|---|---|---|---|
| primary (Claude Code) | primary-native | 1–4 | counter-reviewed every finding |
| lens: code-reviewer | native | 1–3 | REVISE in round 1, APPROVED from round 2 |
| lens: silent-failure-hunter | native | 1–4 | REVISE in rounds 1 and 2, APPROVED from round 3 |
| lens: type-design-analyzer | native | 1–2 | APPROVED |
| Codex CLI | independent | 1 | failed: usage limit (resets 2026-11-28) |

No cross-family reviewer ran.

## Findings

| # | Round | Finding | Source | Severity | Disposition |
|---|---|---|---|---|---|
| 1 | 1 | `addToHistory: false` leaves an undo step that starts at document position 0. After select-all and type, undo after a remote update still restored the replaced text | code-reviewer | MUST_FIX | agree, fixed in `1b0ba78`: rebuild the editor state (`src/utils/editorHistory.ts`) |
| 2 | 1 | Tests only edited inside a paragraph, so they missed finding 1 | code-reviewer | SHOULD_FIX | agree, fixed in `1b0ba78`; the new test fails on the old fix |
| 3 | 1 | After "Load changes", undo no longer recovered the unsaved words the writer dropped | silent-failure | SHOULD_FIX | agree, fixed in `1b0ba78`: the words are kept as a new note "… (my version)" first |
| 4 | 1 | The `setContent` result is ignored | silent-failure | CONSIDER | reject, see below |
| 5 | 1 | Chain mock in `Editor.test.tsx` records nothing | type-design | CONSIDER | resolved in `1b0ba78`: the helper is mocked as a stable spy |
| 6 | 1 | `savedContents` casts; weak `not.toContain` assertions | type-design | CONSIDER | agree, fixed in `1b0ba78` |
| 7 | 1 | The remote-only contract lives only in the name | type-design | CONSIDER | agree: the helper's comment says never to use it for the writer's own edits |
| 8 | 2 | A blur save and a pending autosave could write the dropped words over the remote edit during "Load changes" | silent-failure, code-reviewer | MUST_FIX | agree, fixed in `d039178`: cancel the pending autosave, pause autosave during the copy, banner buttons do not take focus |
| 9 | 2 | "Keep mine" pressed during the copy was overridden | silent-failure | SHOULD_FIX | agree, fixed in `d039178`: disabled during the copy |
| 10 | 2 | Bailing out after the writer typed showed only the success toast | silent-failure | CONSIDER | partial, fixed in `d039178`: a second toast says why nothing loaded; a second click makes a second copy (accepted, no words lost) |
| 11 | 2 | An empty title gave the copy a leading space | type-design, code-reviewer | CONSIDER | agree, fixed in `d039178` |
| 12 | 2 | `keepReleasedDraft`'s `releasedNote` parameter name misleads; seven positional parameters | type-design | CONSIDER | partial: renamed to `source` in `d039178`; no options object for three callers |
| 13 | 2 | A newer remote copy arriving during the copy is not compared | type-design | CONSIDER | reject: the render-phase detection applies it on the next render, as the reviewer traced |
| 14 | 2 | A copy is made when the screen equals the committed text | code-reviewer | CONSIDER | reject, see below; reviewer accepted |
| 15 | 2 | With the banner up, autosave overwrites the other device's edit about 800 ms later and the banner closes | code-reviewer | — | pre-existing, defer → #307 |
| 16 | 3 | A tag-only sync during the copy made "Load changes" back out | silent-failure | CONSIDER | agree, fixed in `daaf696`: compare title and content only |
| 17 | 3 | A save already running when the handler finishes lands after the remote text | silent-failure, code-reviewer | CONSIDER | agree, fixed in `daaf696`: wait for it, then back out if it landed |
| 18 | 3 | A failed copy hands the words back to autosave, which saves them over the remote edit | silent-failure | CONSIDER | defer → #307, linked from the code |

## Rejected findings

**4. The `setContent` result is ignored.** `setContent` returns false only when Tiptap's `enableContentCheck` rejects the content, and nothing in `src` turns it on. A comment in `editorHistory.ts` records the dependency. The reviewer agreed the rejection is reasonable today.

**13. A newer remote copy during the copy.** The handler applies the copy it captured. If a newer one arrived, the editor is then clean against the older committed copy, so the render-phase detection applies the newer one silently on the next render. No words are lost.

**14. A copy when the screen equals the committed text.** The committed text is what the remote edit replaced on the server. After "Load changes" it is on neither the server nor the screen. The copy is the only place it survives, so it is not a duplicate.

## Needs a decision

#307: the "Updated on another device" banner does not hold autosave. Until it does, the other device's edit is overwritten if the writer does not choose within about 800 ms.
