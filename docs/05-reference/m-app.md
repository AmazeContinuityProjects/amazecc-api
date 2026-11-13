---
title: "The VITianCC app notes"
description: "What the m-app folder is — the reverse-engineered official Android app — and why it is not the web-scrape path."
---

# The VITianCC app notes

> **In one line:** `docs/m-app/` documents VIT's **official** Android app reverse-engineered — reference material, not the code that serves this API.

**Folder:** `docs/m-app/` (six files, ~30 KB)

## What it covers

Static analysis of the shipped Android app (`edu.vit.vitiancc`): its login, its networking stack, its endpoint names, its session management, its crypto, its sandboxing, and its feature biz logic. Written so you can understand **how VIT's own app talks to VTOP** without touching the app.

## How it differs from this API

| VITianCC app | AmazeCC-API |
|---|---|
| `vtopcc5.vit.ac.in` | `vtopcc.vit.ac.in` (current default; `VTOP_BASE_URL` override) |
| Encrypted payloads + `S-API-KEY`/`S-KEY-USER` headers | Plain form params: `verifyMenu`, `authorizedID`, `_csrf`, cookies |
| Dynamic per-session URL path segments | Fixed paths — there is no session path segment |
| Ships as a compiled Flutter APK | Next.js Route Handlers running server-side |
| Authenticates against the hardened "new" login | Authenticates against the public HTML login |

Both speak VTOP. They are simply **two different families of client** for the same upstream. Do not mix them.

## Why it matters for this repo

- When VTOP ships a new flow, the app reverse-engineering shows the shape of the new API before the web portal catches up.
- If the web scrape path breaks, the m-app notes tell you whether the break is upstream (the VTOP instance changed) or in our parser.
- When VIT retires the old `vtopcc.vit.ac.in` in favor of `vtopcc5`, this is the map of where to look next. It *will* happen eventually.

## Reading order

1. `login-and-auth.md` → how the app logs in
2. `api-client-and-networking.md` → how requests are shaped
3. `endpoints.md` → the action names the app calls
4. `business-logic.md` → how the app fits together
5. `native-and-security.md` → cert pinning, local storage, Paytm

## Disclaimer, honestly stated

Reverse-engineering for interoperability analysis. Do not distribute the APK, use this for tasks VIT didn't authorize you for, or point this knowledge at accounts that aren't yours. It is reference material, period.
