---
title: "Social (FFCS Partners)"
description: "Every Social (FFCS Partners) endpoint: method, path, auth and rate limits."
---

{/* generated: aapi2 */}

# Social (FFCS Partners)

> **In one line:** Timetable sharing and the friend finder. Identity is always verified against VTOP server-side (identifyCaller) - a reg number in a body is never trusted. Pairings are mutual, encrypted at rest and revocable.

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| get, post | `/api/social/ffcs-match` | Social identity (VTOP-verified) | 30/min/IP |
| post | `/api/social/identity/sync` | Social identity (VTOP-verified) | 20/min/IP |
| post | `/api/social/pair/claim` | Social identity (VTOP-verified) | 30/hour/IP |
| post | `/api/social/timetable` | Social identity (VTOP-verified) | 120/min/IP |
| post | `/api/social/people` | Social identity (VTOP-verified) | 20/min/IP |
| post | `/api/social/grant/visibility` | Social identity (VTOP-verified) | 60/min/IP |
| post | `/api/social/grant/revoke` | Social identity (VTOP-verified) | 60/min/IP |
| get | `/api/social/semester` | None | - |
