---
title: "The social timetable crypto"
description: "ownerKeys, AMZ handles, mutual pairing grants, AES-256-GCM secrets and coarse-vs-full visibility: the friend-finder design."
---

# The social timetable crypto

> **In one line:** identity is HMAC'd away, secrets are hashed and encrypted for the *other* participant to fetch later, and visibility is a pair-wise toggle — nothing else about your timetable ever leaves this repo.

**Files:** `src/lib/socialCaller.ts` · `socialDb.ts` · `socialGrants.ts` · `socialGrantSecret.ts` · `socialGrantLogic.ts` · `socialVocabulary.ts`

## The layers

| Piece | What it is | What it is not |
|---|---|---|
| **`ownerKey`** | `HMAC-SHA256(ID_SALT, regNo)` hex[0:16] — the only identifier the social tables hold | Your register number |
| **`AMZ-XXXX-XXXX` handle** | Crockford base32 (no I/O/L/U) 48-bit random shared identifier you hand out | A secret — it names you, it does not prove you |
| **Grant secret** | 32 random bytes base64url, stored once (`secret_hash`) and encrypted (`secret_enc`) | A credential — you can *use* it but never re-derive, only the non-claiming participant can read it (decrypt-at-fetch) |
| **`secret_enc`** | AES-256-GCM, key = `HMAC(SOCIAL_GRANT_SECRET_KEY, 'social-grant-secret/aes-256-gcm/v1')`, 12-byte random IV, `iv:tag:ciphertext` base64url | A shared key with the friend — never shipped to anyone but the *other* participant |
| **`secret_hash`** | `HMAC-SHA256(SOCIAL_GRANT_SECRET_KEY, plaintextSecret)` — indexed, so lookups are cheap without touching crypto | A hash the client needs — server-only |
| **Visibility (`coarse` \| `full`)** | `coarse` = busy map only; `full` = timetable + courses | A global setting — per-grant, per-direction |
| **`SLOTMAP_VERSION`** | sha256[0:16] of `config.json`'s `slotMap` — rejects stale client vocabularies loudly | A cache-buster the client never sees unless too old |
| **RevokedAt semantics** | `revokeGrant` is idempotent; sets `revoked_at = COALESCE(revoked_at, NOW())` and blacklists the secret | A delete — data persists for audit |

## The mutual-pairing rule

Grants are written **once** — the pair is the row, not two rows. `createOrGetGrant()` upserts the single `(owner_a, owner_b)` row (keys sorted), recycles it on re-pair, and the *old* secret dies. There is no unpair-and-recant bookkeeping; the row *is* the pair. Revoke works from either side — both rows blacklist the secret.

## Who can fetch what

- `coarse` grant: busy-busy map back — no courses, no titles, no faculty.
- `full` grant: same browser-visible shape the owner sees (their course list + busy map).
- Revoked: nothing at all, for either side, forever, until someone re-pairs through the UI.

## The pairing flow

1. A shares `AMZ-…` to B.
2. B calls `POST /api/social/pair/claim` with `{handle, visibility, expiresInMinutes?}`.
3. Server: look up `social_people` by handle → propose grant (validates slotmap, semester, visibility) → create mutual row with fresh secret → hash it into `secret_hash` → encrypt into `secret_enc`.
4. A is notified in-app → can accept/reject. (Acceptance is a no-op — the row is already mutual at creation; UX is consent-by-UX.)

## The semester problem

VTOP can't tell you the current semester from its dropdown — it only says "— Choose Semester —". The server resolves the *current* semester via an external cache/table (`app_config`-backed), shared across all users, so 20,000 students don't scrape the same dropdown 20,000 times. `SOCIAL_SEM_SLOTMAP` + the `SLOTMAP_VERSION` fingerprint defend against drift when `config.json` is edited independently on client and server.

## Where to next

- **[Social reference](../03-api-reference/social/index.md)** — the seven routes.
- **[Sessions and cookies](../01-authentication/sessions-and-cookies.md)** — the raw credentials in that body.
