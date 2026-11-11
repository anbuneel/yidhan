Status: PROPOSAL

Last verified: 2026-11-10
# Landing page copy
The page should lead with writing: what you can do, what the editor gives you, and how you keep your work. Privacy supports that promise.

The current copy suggests a mood: "a quiet home", "Small thoughts, worth keeping", "Maybe that is enough." Together they make the app sound like it expects one kind of reflective writing. The sample notes each end in a small life lesson.

**Copy rule for the whole page:** describe the writing, the action, or the feature. Let the reader decide how it feels. Keep the warmth in the design and in specific, believable examples.

Words to stop using: _quiet, calm, home, thoughts_ (as a word for notes), _worth keeping, passage, your words_.
## Hero
> **A notes app built around writing.**
> 
> Write a first draft, work through an idea, or make notes for something longer. Use focus mode when you're writing, and tags and search when you need to find something.
> 
> Works offline. With an account, your notes sync across your devices and are encrypted before they leave this one.

**Buttons:** `Try writing` · `Browse sample notes` (was "Explore sample notes")

**Small print:** `Free to use. No account needed to try.`

The hero leads with writing. One clause keeps encryption on the first screen, because private and calm together is what no competitor can claim (`PRODUCT.md` → Positioning). The detail (passphrase, recovery key, what stays visible to us) moves to the privacy section.
## Editor preview (hero note)
**Title:** `Opening draft`

> By nine, everyone in the building had received the same letter. Except Sam.
> 
> He checked the empty mailbox again, then knocked on his neighbour's door.
> 
> [Try starting with the knock. Explain the letter later.]

It shows writing and revision together, and gives the editor something to demonstrate.

**Demo disclosure beside the preview:**

> Demo notes are saved in this browser and are not encrypted.

Keep the "Create an account to keep and sync →" button.
## Proof line
Keep as is: _Encrypted before it syncs · Works offline · Free and open source · Export any time._
## Sample notes section
> **See what writing looks like in Yidhan.**
> 
> Browse the sample notes, edit them, or start your own.

Samples should look like work in progress. They can have personality without each ending in a lesson.

**Why I still buy used books** — tag: Ideas

> Start with the cookbook with handwritten substitutions.
> 
> Main point: someone else has already tested what's on the page.
> 
> Find another example. The ending repeats the introduction.

**Revision notes** — no tag

> The opening takes too long. Start at the station.
> 
> Cut the second explanation of why she left.
> 
> Read the dialogue aloud. Both characters sound the same.

**Tuesday** — tag: Journal

> Tried writing before checking email. Finished the opening section in about half an hour.
> 
> Still stuck on the ending. Tomorrow, read the whole draft before changing anything.

"Tuesday" keeps personal writing on the page without being wistful.
## Privacy section
> **Your writing is private.**
> 
> With an account, your note titles and content are encrypted on your device before they sync. We can't read them. Dates, note sizes, and tag names are not encrypted.
> 
> When you sign up, you choose a passphrase and get a recovery key. If you lose both, we can't get your notes back.
> 
> You can export your notes at any time.

**Link:** `How encryption works →`

The recovery-key paragraph is added. The hero text says passphrase and recovery key move here, so this section has to carry them. It is also the honest limit (`PRODUCT.md`: "Honest over smooth").
## Closing
Keep `Start with one note.` with the `Try writing` button.
## Practice Space welcome note (pinned, `/demo` only)
> **Welcome to Yidhan**
> 
> This is the Practice Space. Write, edit and tag notes to see how it works.
> 
> Notes here are saved in this browser and are not encrypted. Sign up to encrypt and sync them.
## Sign-up starter notes (new accounts)
`STARTER_NOTES` in `src/components/PassphraseSetup.tsx` writes four notes and a Recipes tag into each new account. A recipe, a book list and a weekend list don't fit a writing-first app. Suggest cutting to two notes and dropping the Recipes tag.

**Welcome to Yidhan** — pinned

> Your note titles and content are encrypted on this device before they sync. We can't read them.
> 
> Keep your recovery key somewhere safe. If you lose it and forget your passphrase, we can't get your notes back.
> 
> Edit or delete this note whenever you like.

**Things you can type**

> Type / in a note to format it:
> 
> - /h2 for a heading
>   
> - /quote for a block quote
>   
> - /todo for a checklist
>   
> 
> In search, try is:pinned, or put a phrase in quotes to match it exactly.

(Commands from `docs/ui-layout.md`. If they change, this note goes stale.)
## Also worth changing
- `PRODUCT.md` **→ Positioning** says the lead is "private and calm, together". This copy leads with writing. Update that section, or record the choice in `DECISIONS.md`.
  
- `DESIGN.md` **→ Voice** asks for "calm, intentional, warm" and "organic" language. Replace it with the copy rule above.
  
- **README tagline:** "where thoughts bloom with clarity".
  
- `index.html` **title and og/twitter titles** repeat "A quiet home for your personal notes". Change with the headline. The meta description leads with encryption; decide whether it should lead with writing too.
  
## Implementation notes
- `index.html` mirrors the hero copy and the hero note. Change both together (`CLAUDE.md` invariant).
  
- Strings are asserted in `LandingPage.test.tsx`, `publicPageDocument.test.tsx` and `demoStorage.test.ts`. `routes.ts` and `PassphraseSetup.tsx` also contain matching phrases.
  
- Demo starters live in `src/services/demoStarters.ts`. `demoStorage.ts` repairs legacy starter copy for returning visitors; check it with the new content. Demo notes a visitor edited, and the demo tags, migrate into the account at sign-up (`getDemoDataForMigration`).
  
- The Reading demo tag is unused after this change. Keep it or drop it.
  
- Add a `src/data/changelog.ts` entry.
  
- Roughdraft joins the two header lines into one when it saves. A blank line between them stops that. The pre-commit hook needs `Status:` on its own line.
