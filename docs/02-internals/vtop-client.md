---
title: "The VTOP client"
description: "src/lib/clients/VTOPClient.ts and vitTls.ts: the axios singleton, header contracts, TLS injection, and what you should never cache."
---

# The VTOP client

> **In one line:** one thin axios wrapper — `verifyMenu=true`, url-encoded body, Cookie + Referer headers — hitting `https://vtopcc.vit.ac.in` with an injected TLS intermediate.

**File:** `src/lib/clients/VTOPClient.ts` · **TLS helper:** `src/lib/vitTls.ts`

## What it is and what it is not

It is **not** a session client. It holds no state, no cookies, no refresh logic. It is an axios instance with three defaults and one job:

```ts
const client = axios.create({
  baseURL: (process.env.VTOP_BASE_URL ?? 'https://vtopcc.vit.ac.in'),
  withCredentials: true,
  timeout: 20_000,
  headers: { 'User-Agent': browseryUA },
  httpsAgent: viteHttpsAgent(),   // inject Sectigo intermediate
});
```

Anything you see beyond this — retries, semester sweeps, captcha, course material — lives inside route handlers or `src/lib/` callers, never inside `VTOPClient()`.

## URL shapes VTOP expects

VTOP is a single page app with form-posted menus. The paths look like:

- `/vtop/prelogin/setup` — captcha + CSRF bootstrap for login
- `/vtop/login` — the login POST itself
- `/vtop/open/page` — the dashboard after login
- `/vtop/academics/common/...` — most academic pages
- `/vtop/proctor/...` — OD, proctor pages
- `/vtop/academics/commonAllCourseMaterialDownload` — course material

Every POST shares the same body contract: `verifyMenu=true&authorizedID=<id>&_csrf=<token>&<params>=...` from the client call site. The client adds the latter two. You send the former.

## The two HTTP boundaries you must not confuse

| Boundary | Serialization | Auth carrier |
|---|---|---|
| Browser/curl ↔ this API | JSON | JSON body field |
| This API ↔ VTOP | `application/x-www-form-urlencoded` | `Cookie:` header + body fields |

`VTOPClient.post()` expects **already-string-encoded** bodies (URLSearchParams). If you pass raw JSON, VTOP answers with its login page and your parser shreds — the world's most confusing debugging session.

## The TLS agent (`viteHttpsAgent`)

VIT serves only the leaf certificate; the intermediate (Sectigo DV R36) is missing from their chain. Node's default trust store rejects the connection. `viteHttpsAgent()` injects the intermediate into `tls.rootCertificates`. Escape hatch: `VIT_TLS_INSECURE=1` disables verification entirely (flagged, logged, never default).

## What you should never do

- **Cache cookies across users.** There is one axios instance. Cookies are per-request body fields, not client-level state. If you cache anything, it's one request's worth.
- **"Optimize" the timeout upward.** 20s is deliberately tight. A hung VTOP is a dead connection; the health endpoint is for liveness, not slow measurements.
- **Bake `vtopcc5.vit.ac.in` in.** That's the *official Android app* reverse-engineering chain (encrypted payloads, session path segments). The web scrape path uses fixed paths with cookie+CSRF. They are different universes — do not cross them.

## Where to next

- **[The parsers](./parsers.md)** — what comes back when this answers.
- **[Internals: The login endpoint](./login-endpoint.md)** — the heaviest caller of this client.
