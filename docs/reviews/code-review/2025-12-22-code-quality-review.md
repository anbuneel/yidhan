# Code Review - Code Quality and Maintainability

Date: 2025-12-22
By: Codex CLI
Scope: src/ (App, components, services, utils)

## Findings (ordered by severity)
1) Medium: App.tsx is a large, multi-responsibility component that mixes routing, data fetching, subscriptions, and UI rendering. This inflates cognitive load and makes changes risky.
   - Examples: src/App.tsx:102-205, src/App.tsx:656-915
   - Suggestion: extract feature hooks (useNotes, useTags, useFadedNotes, useSearch) and render views in dedicated components.

2) Medium: Inline hover styling via onMouseEnter/onMouseLeave is widespread and duplicates logic, making JSX noisy and hard to scan (reads as style "slop" and is harder to maintain).
   - Examples: src/components/LandingPage.tsx:114-133, src/components/Auth.tsx:421-427, src/components/NoteCard.tsx:201-296
   - Suggestion: move hover styles to CSS/Tailwind classes or a shared Button component.

3) Medium: Auth modal is rendered in three view branches with nearly identical markup.
   - Examples: src/App.tsx:656-737
   - Suggestion: extract a shared AuthModal component and drive it with state.

4) Low: Duplicate tag color sources. LandingPage defines TAG_COLORS locally instead of using the shared palette.
   - Examples: src/components/LandingPage.tsx:33-37, src/types.ts:33-41
   - Suggestion: import TAG_COLORS from src/types.ts to avoid drift.

5) Low: Note-tag mapping logic is repeated across multiple fetch functions.
   - Examples: src/services/notes.ts:51-58, src/services/notes.ts:213-219, src/services/notes.ts:241-247
   - Suggestion: extract a mapNoteRow helper for the join mapping.

6) Low: Sorting/filtering is recomputed on every render in App.tsx without memoization.
   - Examples: src/App.tsx:221-228, src/App.tsx:754-767
   - Suggestion: memoize sortedNotes, filteredNotes, and displayNotes to reduce churn on large datasets.

## Suggestions and improvements
- Create a small UI kit (PrimaryButton, GhostButton, Card, TextInput) to cut inline style duplication.
- Consolidate view switch logic into a router-like component to keep App.tsx focused.
- Add a hooks layer for data subscriptions and cache updates (notes/tags).
- Add a lint rule to discourage inline style + hover event handlers except where needed.
