---
title: "Start Here"
description: "What AmazeCC-API is: the translator that turns VTOP/LMS/Koha HTML into JSON, and how to read these docs."
---

# AmazeCC-API, in one paragraph

> **In one line:** AmazeCC-API is a scraping backend with a JSON face: it logs into VIT's web portals on behalf of students and returns tidy structured data.

VTOP has no API. The portals were built as server-rendered HTML pages with forms and tables, meant for browsers. Every feature in the AmazeCC app - attendance percentages, marks, grades, timetables, leave history, club feeds, question papers - exists on a VTOP page as HTML you would have to *read*.

This service is the reader. It logs in with your VTOP credentials, GETs those pages, parses the HTML, and hands your frontend plain JSON. Sometimes it prefers to hit a small internal database too (bus routes, the question bank, clubs, the shop). That is the whole trick. There is no magic and no third-party VTOP API. Everything is "fetch page, parse page" or "read our own table".

## Why this mental model matters

Once you see "the API is a translator from HTML to JSON", everything else falls into place:

- **Every endpoint is fragile by design.** If VTOP changes its table markup, the parser drops a column and you get `null`s - not an error you can catch in most cases.
- **Sessions are short.** Your VTOP cookies die after about ten minutes of inactivity. The app treats every API call as disposable and re-logs-in when the cookies bounce.
- **Identity is never trusted from the body.** If you send a registration number in a request body, the API ignores it and re-derives who you are from your VTOP session. (One documented exception: FFCS match, which shares class IDs.)
- **One POST, many side effects.** `POST /api/ffcs` fans out to five VTOP endpoints and returns a bundle. `POST /api/attendance` fans out to per-course detail pages.

## Who this handbook is for

You: the junior engineer who will someday own this repo. You don't need to know VTOP,
Next.js, or scraping - every page here teaches the piece it covers from zero. Read
**Start here** top to bottom once, then bounce to whatever you're working on.

## How to read these docs

1. **Start here** - the mental model, the first request ever made to the API, and the response conventions.
2. **Authentication** - the four (really eight) credential families, and how to call a protected route.
3. **Internals** - how the money paths actually work: the login flow, the attendance fan-out, the parsers, the DB, the social crypto.
4. **API Reference** - every route: method, auth, body, response, and a live try-it button.
5. **Operations** - env vars, deployment, and the footguns that have bitten us.
6. **Reference** - type catalog, the VITianCC app reverse-engineering notes, and the machine-readable spec.

## The house rules of this service

- **Stateless at the edge.** The API remembers nothing per-user between calls. VTOP cookies travel in every body; the server holds no session.
- **Envelope when we designed it, raw when we inherited it.** `{ success: true, ... }` for new routes, bare payloads for legacy ones, and a handful of odd-ones carrying binary streams. The reference says which is which on every page.
- **Errors are predictable.** 401 = auth problem, 429 = slow down (retry-after), 5xx = us or VTOP flaked. `success:false` with HTTP 200 still means failure.
- **VTOP is the slow one, and it is rate limited.** Captcha-solving exists because VTOP refuses robots, and the login endpoint solves it offline. Every other failure mode is a page shape change upstream.
