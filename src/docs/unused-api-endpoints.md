# API Housekeeping

Cross-repo audit of `AmazeCC-API` endpoints against every consumer in
`AmazeContinuityProjects`: `AmazeCC` (web), `AmazeCC-Dashboard`,
`AmazeCC-Club-Hub`, `AmazeCC-Kotlin`, `GoRobo`, `Cashew`, `FFCS`, `fkvit`, `UniCC`.

Last updated: 2026-10-21

---

## Summary

- **48 unused endpoints removed** — routes with zero code references across all
  consumer repos (scanned `.ts`/`.tsx`/`.kt`/`.js`/`.jsx`/`.sql`).
- **VTOP proxy sweep batched** — 12 near-identical proxy endpoints now share one
  implementation (`src/lib/vtop-proxy.ts`) and can run inside a **single**
  function invocation via `POST /api/bulk`.
- Every remaining endpoint has **at least one real consumer**.

---

## Batching: `src/lib/vtop-proxy.ts` + `POST /api/bulk`

The VTOP sync sweep used to fire one HTTP request (one serverless function
invocation) per module. Most of those endpoints were the same shape: one POST to
a VTOP page, then a parser turning the HTML into JSON.

`src/lib/vtop-proxy.ts` is now the single source of truth for those proxies.
Two consumers:

1. The individual routes (`/api/bank-info`, `/api/credentials`, …) are thin
   wrappers around `runVtopProxy(name, body)` — unchanged URLs, so the Kotlin app
   and any other consumer keep working.
2. `POST /api/bulk` accepts `{ endpoints: [...] }`, runs each against the
   caller's VTOP session **concurrently**, and returns `{ results: { name: data } }`.
   Unknown names are dropped (whitelisted), and a single failing endpoint is
   reported in its own result object without failing the batch.

The batched names (mirrored by `BATCHABLE_BULK_ENDPOINTS` in
`AmazeCC/src/lib/sync-engine/operations.ts`):

```
bank-info  dayboarder  wallet  credentials  payments  payment-receipts
library-due  hostel-counselling  registration-schedule  ept-schedule
acknowledgement  exc-registration  course-completion
```

`minor-honour` is **not** batched — it cascades over nested `<select>`s with a
different flow — so it is still fetched on its own.

**Effect:** the `bulk` + `fresher` sync ops go from **13 requests → 2**
(one `/api/bulk` + one `minor-honour`). The frontend falls back to per-endpoint
fetches if `/api/bulk` ever fails.

---

## Removed endpoints (2026-10-21)

48 routes deleted — zero references in any consumer repo. All were either
auto-generated stubs or VTOP scrapers for features never wired into a UI.

```
achievements            admin/audit-logs      caterer-change
class-messages          convocation           course-withdraw-view
facility-reg            faq                   fdp-certificate
fdp-registration        fees-intimation       fine-upload
graduated-info          hod-dean              ir-outbound
library-keys            library-scanning      login-history
mdp                     mess-feedback         mess-selection
monthly-report          mooc-registration     mooc-upload
online-exam-attempt     outgoing-report       pat-reg
proctor-messages        question-preview      receipt-download
registration-status     research-attendance   research-award
research-docs           research-letters      research-profile
research-templates      sap-info              sap-project
scholar-leave           scholar-verification  swf-attendance
swf-registration        swf-requisition       thesis-status
thesis-submission       transcript            wishlist-registration
```

> Need one back? It was removed only because nothing referenced it — restore the
> `route.ts` from git history and wire it up.

---

## Endpoint inventory by consumer

Every one of the 178 remaining routes is referenced by at least one consumer.
Breakdown (a route may serve several):

| Consumer | Routes referenced |
|---|---|
| `AmazeCC` (web) | 144 |
| `AmazeCC-Kotlin` | 120 |
| `AmazeCC-Dashboard` | 91 |
| `UniCC` | 64 |
| `FFCS` | 52 |
| `GoRobo` | 32 |
| `AmazeCC-Club-Hub` | 25 |
| `fkvit` | 12 |
| `Cashew` | 11 |

Endpoints used **only** by the AmazeCC web frontend (not by any other app):

```
/api/cabshare/waitlist   /api/club-enrollment   /api/faculty-info
/api/hostel-attendance   /api/hostel-leave      /api/koha/patron
/api/qcm-view
```

> Note: `/api/admin/*` serves `AmazeCC-Dashboard`, `/api/club-admin/*` serves
> `AmazeCC-Club-Hub`, and the Kotlin app uses a broad subset (`/api/me`,
> `koha/*`, `qbank/*`, `faculty/*`, …). Do not prune those based on the web
> frontend alone.

---

## How this was audited

A cross-repo reference scan walks every sibling project's source files
(excluding `node_modules`, `.next`, `build`, `dist`, `target`, the API's own
route files, and docs) and matches each route by its full path and its
leaf segment. A route with **zero** matches across all consumers is dead.

Re-run it after adding or removing routes to keep this doc honest.
