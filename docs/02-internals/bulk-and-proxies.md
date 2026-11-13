---
title: "Bulk and the proxy registry"
description: "How /api/bulk fans out to multiple VTOP endpoints — and how vtop-proxy.ts keeps the registry sane."
---

# Bulk and the proxy registry

> **In one line:** `/api/bulk` runs N VTOP scrapes in one call — whitelisted by `VTOP_PROXIES`, never throws, partial success inside the results object.

**Files:** `src/lib/vtop-proxy.ts` · `src/app/api/bulk/route.ts`

## The shape of a bulk call

```json
{
  "endpoints": ["hostel-counselling", "registration-schedule"],
  "cookies": "…",
  "authorizedID": "21BCE0000",
  "csrf": "…"
}
```

One HTTP round trip → several VTOP pages scraped → one JSON with `results` keyed by endpoint name. The frontend uses this to cut the N round trips on every cold start down to one.

## The registry (`VTOP_PROXIES`)

Every bulk-able VTOP page is registered in `vtop-proxy.ts` with three things:

1. **ProxyCreds** — how to read `{cookies, authorizedID, csrf}` off the body.
2. **`post()`** — builds and fires the actual VTOP POST (url-encoded, `verifyMenu`, `Referer`).
3. **`runSemesterProxy()`** — for pages with a `<select>` for semester, it auto-discovers the semester dropdown's field name by scanning its options for `(sem|fall|winter|summer)`, then re-POSTs once **per semester option** and returns a map of semester → parsed rows.

Scoring is uniform: every proxy is also a **`runVtopProxy()`** — never throws, always converts upstream failure into `{ success: false, error }` so `bulk` can aggregate a partial success.

```json
{
  "success": true,
  "results": {
    "hostel-counselling": { "success": true, "...": "..." },
    "registration-schedule": { "success": false, "error": "..." }
  }
}
```

"success": true at the top is **the batch itself**, not every item — always drill into `results`.

## Adding a new proxy

1. Find the VTOP URL (usually `vtopcc.vit.ac.in/vtop/academics/...` or `/vtop/proctor/...`).
2. Scrape it once in a scratch script to see the actual markup.
3. Add a new `VTOP_PROXY_NAMES` key in `vtop-proxy.ts` with a `post()` and an optional `runSemesterProxy()`.
4. Add a dedicated parser entry in `src/lib/parsers/` (or piggy-back on `auto-parse`).
5. Add it to the `VTOP_PROXY_NAMES` allowlist — or `/api/bulk` starts silently rejecting it with "unknown endpoint".
6. Update this page, the [route inventory](../../grounding/route-inventory.json), and the reference page generated for it.

## Where to next

- **[The VTOP client](./vtop-client.md)** — the `post()` these proxies fill in.
- **[How a request flows](../00-start-here/how-a-request-flows.md)** — the single-request version of the same pipeline.
