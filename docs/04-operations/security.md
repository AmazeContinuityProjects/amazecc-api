---
title: "Security footguns"
description: "Every public-write, TLS escape hatch and credential-carrying pattern in the repo — with why each exists."
---

# Security footguns

> **In one line:** this API is unusually wide open in a few deliberate places — know them before you open another door.

## The public-write surface

| Endpoint | Why it's open | Why that's arguably OK |
|---|---|---|
| `POST /api/qbank/upload` | Upload failures in Google-Forms were already public; the approval queue absorbs abuse | `PENDING` always — never served until admin approval |
| `POST /api/club-admin/feed/promote` | Upvoting a club post shouldn't need an account | Logged, 30/min, no PII |
| `POST /api/notifications/subscribe|unsubscribe` | Pre-registration for push — anonymous by definition freedom | No personal data beyond endpoint hash |
| `GET /api/faculty/scrape` | Scraping the VIT faculty directory is public HTML | Cached rows in our DB, rate-limited |
| `GET/POST /api/gorobo/items|orders|version` | The GoRobo shop is a public ordering service | `POST /api/gorobo/orders` 5/min |

## Public-read surface

- **B2 exam papers** — anonymous download by design. Papers are meant to be free.
- **`/api/status`, `/api/health`** — always open. Trivial body. No data.
- **`/api/events` scrape** — unauthenticated, with TLS verification disabled.
- **`/api/settings/global`** — the maintenance banner config. Public read is the point.

## Credential-carrying patterns (sensitive!)

| Pattern | Notes | What to do |
|---|---|---|
| VTOP cookies in JSON bodies | Every VTOP route | Never log bodies; they grant your account. Error paths should scrub them (`publicErrorMessage`). |
| Koha cards/pins | `/api/koha/patron` | One-shot; stored nowhere — but the response is your library record, treat it like it |
| Moodle user/pass | `/api/lms-data`, `/api/vitol-data` | Per-request; not persisted — but a leaked Moodle pass goes further than a VTOP cookie |
| EventHub `jsessionid` | events routes | Cached on the client; treat as a password until expiry |
| `SOCIAL_GRANT_SECRET_KEY` / `ADMIN_SECRET` / `ID_SALT` | The three HMAC roots | Rotate → everyone's tokens die. The rotation is a code deploy + restart, not a "config change" |

## TLS escape hatches

- `NODE_TLS_REJECT_UNAUTHORIZED=0` on `/api/events` — EventHub's upstream cert chain is broken; contained to that code path.
- `VIT_TLS_INSECURE=1` — whole-process verification disabled (never set in prod).
- pg pool **without `PG_CA_CERT`** — pg connects without verifying the Postgres chain (libpq tolerates; Supabase's CA is public anyway — still: set `PG_CA_CERT`).

## Rate limiting honesty

In-memory Map, **per process, non-distributed**. On Vercel/Riven with multiple instances, limits multiply by replica count and reset on cold starts. If you need a real cap (login brute force), put Cloudflare/WAF rules in front — don't try to "fix" this in `rateLimit.ts`.

## The one mental model

> If an attacker can read the body of any request you send to this API, they can do whatever your account could do *at that moment* — until VTOP or EventHub expires the session. None of this service tries to stop that; it tries to never be the place the secret got lost.

## Where to next

- **[Sessions and cookies](../01-authentication/sessions-and-cookies.md)** — why cookies are the crown jewels.
- **[Cron and push](./cron-and-push.md)** — the one endpoint that never holds VTOP crypto at all.
