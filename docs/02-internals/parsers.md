---
title: "The parsers"
description: "cheerio vs htmlparser2 twins, auto-parse fallback, and how to fix a page when VTOP ships a new layout."
---

# The parsers

> **In one line:** every VTOP page is turned into typed JSON here — usually cheerio, sometimes htmlparser2, always by name-matching table columns, never by column index.

**Directories:** `src/lib/parsers/` (dedicated) · inline in most `route.ts` handlers

## The two engines

| Engine | Import | Selector | Use |
|---|---|---|---|
| **cheerio** | `cheerio.load(html)` | jQuery-like CSS `$('table.table tbody tr')` | The default path — ~80% of routes |
| **htmlparser2** | `parseDocument(html)` + `cssSelect` | `selectAll(query, dom)` | Performance twins (`*.htmlparser2.ts`) for hot paths (attendance, marks, timetable) |

`htmlparser2` is not different *in philosophy* — the parsers are the twins you duplicate by hand. They exist because cheerio 1.x is itself backed by htmlparser2, and using cssSelect directly avoids the cheerio wrapper allocation. Care with duplication: when VTOP ships a markup change, **both** siblings need the fix or you have a silent partial-parity bug.

## What the parsers actually do

Every parser is a pure function with this signature:

```ts
const parseSomething = (html: string) => SomethingSchema[];
```

Inside: load HTML, find rows, split cells, map cell indices → typed fields. Key strategies:

- **Header-name lookup** — match the `<th>` text (`"Slot / Venue"`, `"% Minimum (Average)"`) and use its index. Never hardcode column indices — VTOP swaps columns.
- **Cell-class fallback** — when there's no table head, find rows by class (`tr.tableContent`, `tr.tableHeader`).
- **Form inspection** — extract `select`/`input` elements and their options for AJAX-ish endpoints (curriculum page CSRFF, semester dropdown).
- **Regex hotregexes** — `onclick="processViewAttendanceDetail('x','y')"` is how you get per-course attendance detail params.

## The auto-parse fallback (`auto-parse.ts`)

For routes that were not worth a dedicated parser on day one, `parseVtopHtml(html)` is the generic soup-to-JSON: tables → arrays, selects/inputs → key-value maps, and page messages (`alert`, `failed`, `success`) → snackbar strings. It is what keeps the long tail of the file working.

## When VTOP breaks

Procedural: route splits, `null` body check, search the parser name in this folder, fix the selector, then **sync both twins**. Tests: none for parsers, by the way — that is an honest hole. The guard metric is `pnpm build` (type errors) plus spot-checks in a dev console.

## Where to next

- **[The attendance endpoint anatomy](./attendance-endpoint.md)** — parser-permutation walkthrough.
- **[Internals index](./index.md)** — the other walkthroughs.
