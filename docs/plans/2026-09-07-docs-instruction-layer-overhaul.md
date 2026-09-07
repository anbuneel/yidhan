# Docs & instruction-layer overhaul

Status: ACTIVE
Last verified: 2026-09-07

ACTIVE alongside `world-class-execution-plan-claude.md` by deliberate exception —
see `DECISIONS.md` (2026-09-07). The two cover orthogonal lanes: that plan owns
product work, this one owns the documentation and instruction layer. The
pre-commit cap is 2; a third ACTIVE plan still fails.

---

## Why

169 markdown files, 132 of them untouched since the first commit in visible history
while 99 code commits landed on top. 45 live-lane docs still named the pre-rebrand
product. Nine files claimed to own "what's true now". The instruction layer still
carried rituals — per-doc model attribution, `-claude` filename suffixes, a
409-line hand-maintained index, a context-exhaustion handoff prompt — built for
harness constraints that no longer bind.

Full audit numbers and the four findings are recorded in `DECISIONS.md`
(2026-09-07 entries).

## The governing rule

**One owner per fact.** Every other doc links to the owner instead of restating it.

## Four tests, applied before creating or keeping any doc

1. **Derivability** — if the code answers it cheaply and reliably, don't write it.
2. **Decay** — facts that change need exactly one owner.
3. **Always-loaded budget** — anything read every session competes for context.
4. **Update trigger** — every doc needs a natural event that *forces* its update.

Docs are conditional containers, not a taxonomy to fill. A doc exists only while it
has exclusive content and a live update trigger. Never create a canonical file "for
completeness" — an empty mandatory file accumulates derivable filler to justify
itself.

## The six docs

| # | Doc | Tier | Owns | Update trigger |
|---|-----|------|------|----------------|
| 1 | `CLAUDE.md` (+ generated `AGENTS.md`) | 0 — always loaded | Operating rules, routing, invariants, live gates | An invariant or rule changes |
| 2 | `PRODUCT.md` | 1 — durable | Why this exists; what's true in the current phase; permanent non-goals | Purpose or permanent scope changes |
| 3 | `DECISIONS.md` | 1 — history | Why it became that way | A consequential choice is made |
| 4 | `DESIGN.md` | 1 — durable | The visual system | A system rule changes |
| 5 | `docs/progress.md` | 2 — history | What shipped, append-only | A change merges |
| 6 | `docs/roadmap.md` | 2 — state | What's deferred, and what's refused | An outcome is deferred or refused |

Sidecars, kept because they hold detailed contracts that would bloat tier 0:
`docs/technical-spec.md` (schema), `docs/ui-layout.md` (layout diagrams),
`docs/reference/` (user-facing behaviour), `docs/setup/` (how-to).

## Cut deliberately

- `status.md` — no update trigger; the ACTIVE plan owns "now".
- `ARCHITECTURE.md` — its real content belongs always-loaded in `CLAUDE.md`.
- `docs/Index.md` — an index is a human affordance; agents glob and grep, and the
  routing table is already in context.
- `docs/backlog.md` — competed with the issue tracker and with `roadmap.md`.
- Handoff prompts — built for sessions that ran out of context.
- Agent-name suffixes — encode who typed it, not what it is.

## Execution

**PR 1 — install the system**

- [x] Commit `DECISIONS.md` and this plan.
- [x] Normalise the surviving live plan to the header contract.
- [x] Add `.githooks/pre-commit`; arm with `git config core.hooksPath .githooks`.
- [x] Add root `.ignore` for the retrieval lane.
- [x] Quarantine: 169 files to a flat `docs/archive/`, with all 122 resolvable
      relative links rewritten and verified.
- [x] Add `docs/archive/README.md`; delete `docs/Index.md`.
- [x] Sweep root scratch: prototypes, `logo-test.html`, conversation dumps,
      `.impeccable/` (now gitignored).
- [x] Operative `CLAUDE.md` update: routing table, retrieval-lane rule,
      plan-lifecycle rule, contested-only review audits.

**PR 2 — migrate current state into it**

- [x] Write `PRODUCT.md` and `DESIGN.md`.
- [x] Create `docs/progress.md` as history-only.
- [x] Reword `roadmap.md` to candidates-not-approvals; add Won't Do.
- [x] Re-audit `CLAUDE.md` against the actual code — delete stale enumerations
      rather than correcting them.

## Deliberately not doing

Deleting history; renaming existing files; rewriting `progress.md` entries;
restructuring `roadmap.md` beyond ownership clarifications.
