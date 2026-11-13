---
title: "Cron and push"
description: "The /api/cron/reminders scheduler, VAPID web-push, and how subscription management works."
---

# Cron and push

> **In one line:** a bearer-protected cron fans out Vitol reminders to every subscriber, and web-push carries them to devices that may be offline.

**Route:** `POST (or GET) /api/cron/reminders` — Bearer `CRON_SECRET`

## What the cron does

On a schedule (hourly-ish outside app runtime — see ops for the host) it:

1. Reads `push_subscriptions` from the DB: every endpoint + the Vitol pref fields.
2. Filters on `vitol_enabled=true` and `vitol_reminder_day` matching today.
3. Fires `web-push` with the `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` pair.
4. Reports counts (`{success, message}`; errors map to a plain `{error}` — no logger dependency).

The client controls which reminders arrive from `/api/notifications/subscribe` (body: `UserID`, `subscription`, `vitol_enabled`, `vitol_reminder_day`, `vitol_reminder_time`). Notification preferences are readable via `/api/notifications/status` (unauthenticated, keyed by endpoint string). Unsubscribing is `POST /api/notifications/unsubscribe`.

## The VAPID pair

| Var | Who | Purpose |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | server + browser | Public key — sent to push services |
| `VAPID_PRIVATE_KEY` | server only | Signs push payloads |

If either is missing, `/api/admin/push` and the cron both no-op with console errors. There is no opt-out master switch — unsubscribing per endpoint is the intended path.

## Triggering the cron manually

```bash
curl -X POST https://api.amazecc.com/api/cron/reminders \
  -H "Authorization: Bearer $CRON_SECRET"
```

- `timingSafeEqual` is used — dumb-string compare does not protect this.
- Called from outside the VPC with the secret — do not publish the secret anywhere.

## Where to next

- **[Deployment](./deployment.md)** — where the scheduler lives once Riven/Vercel replaces cron.
- **[Reference → Notifications](../03-api-reference/auth-system/index.md)** — the subscribe routes.
