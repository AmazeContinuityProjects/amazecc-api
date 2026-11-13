---
title: "Social identity verification"
description: "How the social routes verify you server-side against VTOP — and why the body's reg number is never trusted."
---

# Social identity verification

> **In one line:** the social routes prove who you are by re-asking VTOP, not by trusting anything you send.

**Pattern:** `identifyCaller({cookies, authorizedID, csrf})`

## Why it works this way

A registration number can be guessed, scraped, or shoulder-surf-read — it is not a secret. If timetable sharing trusted a `regNo` field in a request body, anyone could view or impersonate any student's shared blocks. The fix is mechanical:

1. The client sends its **VTOP cookies** (from `POST /api/login`) + `csrf` + `authorizedID`.
2. `identifyCaller()` POSTs a `StudentProfileAllView` page to VTOP with those cookies.
3. The server parses the page, finds a registration number with the `isRegistrationNumber()` regex (uppercase alnum, plausible length), and derives `ownerKey = maskUserID(regNo)` — an HMAC-SHA256 fingerprint of your registration number with the server salt, truncated to 16 hex chars.
4. **Every subsequent identity decision is based on that ownerKey.** Your body is never consulted for who you are.

Success means VTOP told the server who you are right now. Failure modes map to precise codes:

| Code | Meaning | Then |
|---|---|---|
| `missing_credentials` | No cookies/csrf in body | Log in via `POST /api/login` |
| `vtop_unavailable` | VTOP unreachable or refused | Retry; VTOP flakes |
| `vtop_session_expired` | Cookies died | Re-login |
| `vtop_identity_unresolved` | Cookies alive but no reg number found on the page | Report; VTOP markup changed |

## What "verified" unlocks

Everything under `/api/social/*` — the timetable sharing feature: `identity/sync`, `pair/claim`, `timetable`, `grant/visibility`, `grant/revoke`, `people`, `ffcs-match`. Coarse vs full visibility toggles what a paired peer may see (busy slots vs courses+busy map); revoking a grant severs the pair in both directions and blacklists the secret.

## The one exception

`/api/social/ffcs-match` receives `classIds` as input — class IDs are not personal data on their own, and the route returns *your* match list only. It still verifies you via the same cookies, it just consumes a public-ish identifier as input.

## Where to next

- **[Internals: the social crypto](../02-internals/social-crypto.md)** — how ownerKey, grants, and secrets actually hash and encrypt.
- **[Social reference](../03-api-reference/social/index.md)** — the routes.
