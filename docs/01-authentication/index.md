---
title: "Authentication overview"
description: "The credential families the API understands: VTOP sessions, admin bearer, club tokens, CabShare, EventHub, Moodle, and social identity verification."
---

# Authentication overview

> **In one line:** Eight ways in, and exactly one rule: you prove who you are per-request, and the server decides what you may do.

AmazeCC-API is stateless at the edge. Every credential family works the same way: the client holds a secret (or a session) and presents it on every call; the server verifies it and derives identity. No cookies are ever set by the server for your browser. You can mix and match — the API does not know what "logged in" means outside a request body.

## The families

| Family | Who uses it | What you present | Where to learn |
|---|---|---|---|
| **VTOP session** | The AmazeCC app for all academic data | `{cookies, authorizedID, csrf}` in the body | [vtop-login](./vtop-login.md) |
| **Admin bearer** | The operator (you) | `Authorization: Bearer <token>` | [admin-auth](./admin-auth.md) |
| **Club bearer** | Club representatives | `Authorization: Bearer <club token>` | [club-auth](./club-auth.md) |
| **CabShare token** | CabShare users | `Authorization: Bearer <token>` (30-day) | [cabshare-auth](./cabshare-auth.md) |
| **EventHub session** | Event registration | `{username, password, jsessionid}` in the body | [eventhub-auth](./eventhub-auth.md) |
| **Moodle credentials** | LMS/Vitol data | `{username, pass}` in the body | [lms-auth](./lms-auth.md) |
| **Social identity** | Timetable sharing | VTOP cookies verified server-side | [social-identity](./social-identity.md) |
| **CRON_SECRET** | The scheduler itself | `Authorization: Bearer <CRON_SECRET>` | [cron](../04-operations/cron-and-push.md) |

## The 10-minute elephant

VTOP's own session cookies die after about ten minutes. That is not the API's doing — VTOP enforces it. Everything else is downstream of this:

- `POST /api/login` solved your captcha and got you cookies — they are alive **now**, not forever.
- When any VTOP route returns `invalid csrf`, `invalid session` or similar, your cookies died. Re-login. There is no refresh endpoint.
- The frontend hides this entirely by treating every cold start as unauthenticated and re-logging-in in the background.

## Which credentials go in which bucket?

- **Body (JSON):** VTOP session, Moodle, EventHub, social identity. Always in `Content-Type: application/json` bodies, never in the URL.
- **Authorization header:** admin, club, cabshare, cron. One header, standard semantics.
- **Server-to-server:** `CRON_SECRET` is never presented by an end user.

## The never-rule

> **A registration number in the body proves nothing.** VTOP cookies do. Any route that claims to know you from a `regNo` field and *doesn't* ALSO verify your VTOP session (like the social routes) is a bug waiting to be filed.

## Where to next

- **[VTOP login, from scratch](./vtop-login.md)** — the actual door in.
- **[Sessions & cookies](./sessions-and-cookies.md)** — what the cookies are and what can be done with them.
- **[Admin auth](./admin-auth.md)** — become the operator.
