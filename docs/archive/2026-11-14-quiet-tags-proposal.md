Status: COMPLETE
Last verified: 2026-11-14

# Quiet tags
Tags look like a stock UI kit: a coloured dot inside a rounded pill with a hairline border. This proposal makes them plain text, so they match the rest of the app. It does not add folders.
## Problem
- **Eight colours.** `DESIGN.md` says green is the one working colour and there is no bold colour. Tags carry eight (`TAG_COLORS` in `src/types.ts`), and an active filter fills its pill, border and text with the tag's colour. The filter row turns into a rainbow.
  
- **Glass left over.** `TagPill` and `AllNotesPill` use `backdropFilter: blur(...)`. The design moved to solid sheets. The blur does nothing on a solid page.
  
- **Boxes everywhere.** Hierarchy should come from size, weight and italic. Tags are the one place where everything sits in a bordered container.
  
- **Template details.** Title-case "All Notes", "+2 more", the placeholder "e.g., Work, Personal, Ideas", `transition-all duration-300`, and two focus styles (`focus-ring` in `TagPill`, `ring-2 ring-offset-1` in `TagFilterPills`).
  
- **Card badge is near-invisible.** `TagBadge` uses a `0A` alpha suffix, commented as 10%. `0A` is about 4%, so only the dot reads.
  
## Proposal
### Library filter row (`TagFilterBar`, `TagPill`, `TagFilterPills`)
- Tags render as lowercase words in `--font-body`, separated by spacing. No border, fill, blur or dot.
  
- Inactive: `--color-text-secondary`. Hover: `--color-text-primary`.
  
- Active: `--color-accent-text` with a 1px underline offset below the baseline. One active style for every tag.
  
- "All Notes" becomes "all", styled like the tags. It stays first.
  
- The add button becomes a text "+ tag" link at the end of the row, not a round button.
  
- Edit and remove keep their current hover/focus reveal, as small text-coloured icons.
  
- One focus style: the shared `focus-ring` class.
  
- Transitions name the property they animate (`color`, `opacity`), 150–200ms.
  
### Note cards (`TagBadge`, `TagBadgeList`)
- Tags render as small italic text in `--color-text-tertiary`, joined with `·`: _journal · ideas_.
  
- Show up to two names, then `+N`. Drop the word "more".
  
### Editor tag control (`TagSelector`)
- Selected tags use the same italic text as the cards, not tinted chips.
  
- The dropdown lists tags as plain rows: name, then a check mark in `--color-accent-text` when selected. No dots.
  
### Tag modal (`TagModal`)
- Remove the colour picker and the coloured preview.
  
- Placeholder becomes "Tag name".
  
### Colour data
- Keep the `color` field on `Tag`, in Dexie, in Supabase, in exports and in imports. Removing it would need a migration and would break older backups.
  
- New tags keep getting the current default (`stone`).
  
- The UI stops reading `TAG_COLORS`. If no code reads it after this change, leave the constant in place with a comment saying it holds stored keys only.
  
## Not in scope
- **Folders, notebooks and nested tags.** Refused in `PRODUCT.md` ("tags and pinning, not folders or structure") and `docs/roadmap.md` (contradicts temporal chapters). Nested tags such as `writing/novel` are folders under another name.
  
- **Pinned tags or a per-tag library view.** These are the way to answer a "group by project" need without folders. Separate proposal if users ask for it.
  
- Search operators. `tag:` syntax in `src/utils/searchQuery.ts` is unchanged.
  
## Risks
- **Tap targets.** Text tags on mobile still need a 44px hit area. Keep the padding on the button, not on visible chrome.
  
- **Losing colour as a scan aid.** Some users may sort by colour. Yidhan's notes are sorted by time, and tag names are short, so names should be enough. Watch feedback after release.
  
- **Contrast.** Tertiary italic text on cards must pass `src/themes/contrast.test.ts` thresholds in both themes. Check before choosing tertiary over secondary.
  
## Done when
- No tag surface renders a border, fill, blur or coloured dot.
  
- The only colour on any tag surface is the active filter's `--color-accent-text`.
  
- `TagModal` has no colour picker; creating and editing a tag still works.
  
- Existing tags with any stored colour still load, sync, export and import.
  
- Tests cover where the change should not fire:
  
  - a tag with a non-default colour renders the same as one with `stone`;
    
  - an import file with tag colours still imports and keeps them;
    
  - the active style shows on exactly one tag, and clears when "all" is chosen;
    
  - edit and remove controls stay reachable by keyboard after the visual change.
    
## Docs to update when it ships
- `DESIGN.md`: a short rule that tags are text, not chips, and carry no colour.
  
- `DECISIONS.md`: dropping tag colours from the UI while keeping the stored field.
  
- `src/data/changelog.ts`: one entry.


## As built

- Tag names keep the case the user typed. The mockup showed lowercase; forcing it
  would rewrite the user's own words.
- "All notes" stays as two words in sentence case, and the add control reads "+ Tag".
- Shared letters were also chips and now use the same italic words.
