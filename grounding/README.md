# AmazeCC-API — Docs Grounding

Everything under `grounding/` is the working brain of the handbook in `docs/`:
the route inventory, the writing standard, the regeneration scripts, and the
verification checklists. If you change the API, read this first — then keep
these files truthful.

## What these docs are

A junior developer's complete manual for `AmazeCC-API` — the Next.js backend
that scrapes VTOP/LMS/Koha/EventHub and serves it as JSON. The tone is
"spoonfed": nobody is assumed to know Next.js, scraping, or even what a cookie
is. Every page answers the same three questions: *what is this*, *why is it
shaped like this*, *how do I use it*.

The handbook moves to public docs via `AmazeContinuityProjects/docs` (the
Mintlify site at https://docs.amazecc.com). The multirepo sync copies `docs/`
into `amazecc-api/` and merges the navigation here (`docs.json`) into the
site's `AmazeCC-API` tab. Do not hand-edit the synced copies there — edit here.

## Layout

| File | Purpose |
|---|---|
| `route-inventory.json` | Source of truth for every route: method, auth kind, body keys, return envelope, rate limit, notes. Feeds `gen-reference-pages.mjs`. |
| `gen-reference-pages.mjs` | Regenerates the `03-api-reference/**` pages from `route-inventory.json`. Idempotent. |
| `gen-child-docs.mjs` | Regenerates `docs/docs.json` (the child navigation manifest) from the folder layout. |
| `verification.md` | How we prove these docs tell the truth (deploy, llms.txt, live curls). |
| `writing-standard.md` | The house style — audience, tone, per-page checklist. |

## The sync loop

1. You edit files under `docs/` on this repo's `main`.
2. The `Notify docs repo` workflow dispatches `docs-updated` to
   `AmazeContinuityProjects/docs` (needs `DOCS_DISPATCH_TOKEN`).
3. That repo's `Aggregate docs` workflow re-syncs and Mintlify redeploys.
4. `docs.amazecc.com` reflects it. If anything fails mid-loop, the previous
   deployment stays live — the sync never mutates the site before a new build
   passes validation.
