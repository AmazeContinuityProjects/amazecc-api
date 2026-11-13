---
title: "Sessions and cookies"
description: "What the cookies, csrf and authorizedID actually mean, and why they die in ten minutes."
---

# Sessions and cookies

> **In one line:** three artifacts grant line of sight into VTOP — cookies are the badge, `csrf` the proof you meant it, `authorizedID` the account tag.

## The three things `/api/login` returns

### `cookies` — the session badge

A `;`-joined string (or an array with the same content) carrying VTOP's session cookies — primarily `JSESSIONID`. The server has **already** set these for you in the response, and you can use them for about ten minutes of inactivity before VTOP evicts them. Treat them as single-user, unshareable, short-lived.

Cookies can arrive as a JSON array from older clients; the API joins arrays with `"; "` internally. Either way is fine.

### `csrf` — the proof you meant it

`_csrf` is VTOP's anti-forgery token. Every POST form VTOP renders embeds one. The API includes it as `authorizedID` + `_csrf` + `verifyMenu=true` on every VTOP form submission. If you hand-craft a VTOP POST without it, VTOP 302s you back to the login page — and from your code's seat it looks like "the cookie died early" which is usually what you'll conclude, correctly, from the outside.

### `authorizedID` — the account tag

Your VTOP client code will normally see this as e.g. `21BCE0000` — the identity VTOP stamps on everything you own, from attendance to your faculty proctor to your honors dashboard. It is not a secret; it is an identifier. The value is scraped from the dashboard HTML on login.

## What you can do with them

- **Read almost everything about yourself** — attendance, marks, grades, timetable, hostel, fees, circulars, leave.
- **Write some things** — OD requests (on-duty), feedback, some FFCS interactions — but *not* every VTOP write is implemented. The API exposes only what the app needs.
- **Do nothing permanent.** If you delete the cookies, you're a logged-out visitor again. If you share them, anyone holding them is you, until VTOP expires them — treat them like a password.

## The ten-minute wall

VTOP expires sessions roughly ten minutes after your last VTOP interaction. The cookies in your hand are a snapshot of a session, not a permanent token. The behaviors:

| Symptom | Meaning | Fix |
|---|---|---|
| `invalid csrf` | Cookie died or the csrf went stale | Re-POST to `/api/login` |
| `invalid session` | Cookies dead | Re-login |
| Blank/partial dashboard parsed as `null` | Session partly alive | Re-login |
| `/api/login` works fine, other routes 4xx | It was not the login that broke | Inspect the specific route |

**The frontend's trick:** it never trusts a cold start. On boot, the app proactively re-logs-in in the background, and it swaps credentials the moment any VTOP call comes back auth-shaped. Your scripts should do the same: on any `success:false` from a VTOP route, re-login once and retry.

## Cookies in repositories and heads

Never paste these into a commit, an issue, a screenshot, or a shared channel. If one leaks, VTOP does not know you leaked it — it still expires it, but a leaked cookie doubles the surface for someone else using your account until then. The API itself never stores your cookies; it throws them away when the request completes.

## Where to next

- **[VTOP login, from scratch](./vtop-login.md)** — making the session that produces these.
- **[Social identity](./social-identity.md)** — identity verified server-side with these same cookies.
- **[Reference → Error conventions](../03-api-reference/auth-system/index.md)** — where this table shows up as status codes.
