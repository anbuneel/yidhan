# Review audit — item 61, step 5, public shell

Date: 2026-11-08
Reviewer: `/code-review` at high effort, one round, on the uncommitted diff
Outcome: 8 accepted and fixed before the first push, 1 accepted in part, 1 rejected

Written because findings were rejected. `CLAUDE.md` asks for an audit in that case.
The accepted findings are listed only for context.

## Accepted — eight

| Finding | The fix |
|---|---|
| `showAuthModal` stays set after a sign-in, because `Auth` never calls `onClose` on success. Sign-in from the public shell now mounts App with the modal open, so this became the common path: shortcuts stayed off for the session, and the modal would reopen over a public page | App clears the flag when a user appears. The bug predates this change |
| Replay checks for `/s/*` only at page start, but now starts at the handoff, which can be Back to a shared note | `startMonitoring` asks again just before it imports Replay. Test: the app shell starting on `/s/...` adds no Replay |
| `migrateLocalStorageKeys()` throws where storage throws, before React mounts | Wrapped in `try`/`catch` in `main.tsx`; the public shell renders. The throw predates this change; it ran from App's module before |
| Leaving the public routes rendered a spinner in place of the landing while the app chunk loaded | The public shell keeps the last public page on screen, and Root's transition holds it until the app can render. Test with a held-back chunk; it fails against the old code |
| `boot.js` tested only the session key, so an OAuth return or share-target content on `/` showed the landing shell before the loader | `boot.js` mirrors every input of `shouldStartApp`. The agreement test runs `boot.js` for eleven URLs and storage states |
| Capping a budget at its target, and holding Replay until the app shell starts, are consequential choices with no `DECISIONS.md` entry | Added, 2026-11-08 |
| The legacy starters' doc comment moved onto `DEFAULT_TAGS` when the starters were split out | Moved back to `LEGACY_STARTER_NOTES` |
| `PublicShell` repeated the gate's rule for which routes are public | Both call `isPublicShellRoute` in `src/appGate.ts` |

## Accepted in part — one

**"The `landing-handoff` class is never removed, so the hero entrance never plays
again in this document."** The class now goes on only for sign-in and sign-up, the two
handoffs that remount the landing under the auth modal; Try writing and route changes
no longer set it. It is not removed afterwards, on purpose. A CSS animation starts when
its `animation` property is applied, so removing the class while the landing is mounted
would play the entrance under the open modal, which is the flash the class exists to
stop. The cost is that a visitor who signs in and later signs out sees the landing
without its entrance until the next page load. The hero has already entered once in
that document.

## Rejected — one

**"`PublicShell` copies the twelve-prop `LandingPage` wiring and the `PublicPage`
wiring from `renderEntryScreen`; share a builder."** The two call sites differ in what
the callbacks do: in the public shell, Sign in and Create an account hand over to the
app shell, while in `renderEntryScreen` they open the modal App already owns. A shared
builder would take every callback as a parameter, which is the same twelve props
behind one more name. It also could not live in `entryScreens.tsx`, which imports `Auth`
and `DemoPage` and would put the app shell back on the landing's path. TypeScript
already fails both call sites when `LandingPage` gains a required prop. What has to
match at runtime, that both shells render the same page for the same route, is covered
by `src/shells/Root.test.tsx` and by the e2e specs, which run through both.
