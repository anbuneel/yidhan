# Supabase Free Tier vs. Pro — Launch Cost Analysis & Recommendation

> **Author:** Claude (Fable 5, Claude Code)
> **Date:** 2026-07-06
> **Prompt:** "I am still on free Supabase plan and no custom SMTP. Is there a cheaper option than Supabase for pro capabilities?"
> **Context:** Follow-up to [launch-readiness-review-claude.md](launch-readiness-review-claude.md), which flagged custom SMTP (blocker 3) and backups (open question 1).
> **Caveat:** Provider pricing and free-tier limits shift often — verify current numbers in provider dashboards before acting.

---

## Bottom line

**Supabase Pro is not needed to fix the launch blockers, and migrating off Supabase would cost far more in time than it saves in money.** Stay on the free tier through launch with three $0 hardening steps; upgrade to Pro ($25/mo) when real users arrive.

---

## What's actually needed, and what it costs

### Custom SMTP — free tier feature, $0

Custom SMTP is a **configuration setting, not a Pro feature**: Supabase Dashboard → Authentication → SMTP Settings. Pair with a free email provider:

| Provider | Free allowance | Notes |
|----------|---------------|-------|
| Resend | ~3,000/mo, 100/day | Easiest setup, best DX |
| Brevo | ~300/day | Higher daily ceiling |
| Amazon SES | ~$0.10 per 1,000 | Cheapest at scale, more setup friction |

Auth email volume at launch scale (confirmations + password resets) is dozens per day — Resend's free tier covers it indefinitely.

**Note:** a custom domain for the from-address is eventually wanted (mail from a generic provider domain looks off-brand and hurts deliverability). Connects to the open custom-domain question in the launch review.

### Backups — roll your own on free tier, $0

Free tier allows direct Postgres connections, so:

- GitHub Actions cron job runs `pg_dump` nightly
- Encrypt the dump
- Push to a private repo or Cloudflare R2 (free 10 GB)

Since note payloads are E2EE ciphertext, dumps are low-sensitivity to begin with. Pro's real advantage is point-in-time recovery and zero maintenance — worth $25/mo **once there are real users**, not before.

---

## Free-tier gotchas that matter more than backups

1. **Project pausing.** Supabase pauses free projects after ~1 week of no API activity — a paused project means the app is **down** until manually restored. Early on, with few users, a quiet week is plausible. **Fix:** scheduled ping (GitHub Actions or Vercel cron hitting a lightweight query endpoint) keeps the project warm. Arguably a bigger launch risk than backups.
2. **`pg_cron` and Edge Functions work on free tier** — so the offboarding deletion job (launch blocker 1) does not require Pro either.
3. Other free-tier limits (500 MB DB, ~200 concurrent realtime connections) are comfortable for launch scale.

---

## Why not migrate to something cheaper

There is no true "cheaper Supabase-Pro equivalent" — Pro buys managed backups and no pausing, and alternatives cost more in time than $25/mo:

- **Neon / PlanetScale / raw Postgres hosts:** Postgres-only. Auth, realtime subscriptions, and RLS-equivalent security would need rebuilding. The sync engine leans on Supabase realtime channels — weeks of migration risk.
- **Self-hosting Supabase on a VPS** (~$6/mo Hetzner): real ops burden — backups, upgrades, and auth security become your responsibility, for an E2EE product. Wrong trade for a solo founder at launch.
- **Firebase:** full rewrite (no Postgres, no RLS, different data model).

### Portability note

Yidhan's architecture is *more* portable than most Supabase apps: offline-first means IndexedDB is the source of truth and the server is a sync target; E2EE means the server never holds plaintext. That is leverage for a future migration if pricing ever becomes a problem — but the app is deeply wired into Supabase realtime + RLS today, so exercising that portability costs weeks. Portability not cashed in is an option, not a plan.

---

## Recommendation

Stay on Supabase free tier through launch with three $0 hardening steps:

1. **Resend + custom SMTP config this week** — unblocks launch (blocker 3).
2. **Nightly `pg_dump` backup** via GitHub Actions → encrypted → private repo or R2.
3. **Keep-alive ping** to prevent free-tier project pausing.

Upgrade to **Pro ($25/mo)** when there are engaged users, or at the first support incident where PITR would have helped — that is the signal the money buys something real.
