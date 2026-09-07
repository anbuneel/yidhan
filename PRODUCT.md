# Product

What is true about Yidhan now, and what will never be true. For *why* things
became this way see `DECISIONS.md`; for what shipped see `docs/progress.md`; for
what is deferred see `docs/roadmap.md`.

## What this is

A calm, distraction-free note-taking app. Named from Tamil origins meaning
"Bright Spring". Thoughts are encrypted end-to-end, stored offline-first, and
synced across devices. Live at https://yidhan.vercel.app.

## Who it is for

Reflective writers and minimalist professionals, roughly 25–50, who value
aesthetics as much as function. They write for personal reflection, not
productivity optimisation. They are overwhelmed by feature-rich tools (Notion,
Obsidian) and are looking for a calm, intentional space. They capture quickly,
organise loosely, and read from any device.

They are **not** teams, not knowledge-base builders, and not people who want to
configure things.

## Current phase

Pre-launch, single developer, public web app plus an Android build via Capacitor.
The encryption posture is already load-bearing: server rows are encrypted-only and
the database fails closed on plaintext. That constrains every feature — anything
that needs the server to read note content is off the table by construction, not
by preference.

## Success criteria

1. Opening the app lowers the user's heart rate. Relief, then curiosity, then
   trust — in that order.
2. A thought can be captured before the impulse passes, offline, without setup.
3. The user believes their notes are private, and is right to.
4. Nothing in the interface asks for attention it has not earned.

## Hard constraints

- **Zero-knowledge.** The server must never be able to read note title or content.
  Tags and timestamps are the accepted metadata leak; that trade is recorded in
  `DECISIONS.md` and is not to be widened casually.
- **Offline-first.** Every write must land locally and survive with no network.
- **Solo maintenance.** Anything that needs a team to operate is out of scope,
  including infrastructure that cannot be run by one person from a laptop.
- **WCAG AA across all themes**, with `prefers-reduced-motion` honoured globally.

## Permanent non-goals

These are refused on principle, not deferred. Proposals to add them should be
declined with a pointer here rather than re-litigated.

- **Engagement mechanics.** No streaks, no gamification, no notifications, no
  badges, no "you haven't written in 3 days".
- **Feature parity with Notion/Obsidian.** The product competes on restraint.
  Databases, backlink graphs, plugin systems and nested workspaces are all no.
- **Real-time multi-user collaboration.** It is incompatible with the encryption
  model and with the product's reason to exist. Sharing is one-way, by capability
  link, and that is the whole of it.
- **Server-side content intelligence.** Any feature requiring the server to read
  note content — search indexing, AI summarisation, recommendations — is refused.
  Client-side equivalents are open.
- **Ads, tracking, or selling behavioural data.** Ever.

## Judgment calls

When the code does not settle a question, decide in favour of: fewer elements over
more; the calmer of two animations; the honest empty state over the hidden one;
and the option that keeps the server ignorant.
