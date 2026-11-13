---
title: "LMS and Koha auth"
description: "Moodle (LMS/Vitol) login credentials passed per-request, and the public Koha OPAC proxies."
---

# LMS and Koha auth

> **In one line:** LMS calls take your Moodle username/password per request and never store them; Koha is fully public — your card/password buys a patron scrape, nothing else.

## Moodle LMS — `/api/lms-data` and `/api/vitol-data`

These scrape the Moodle instances behind **lms.vit.ac.in** (LMS) and **online.vit.ac.in** (Vitol). They want:

```json
{ "username": "21BCE0000", "pass": "your-password" }
```

What happens server-side:

1. POST to `<moodle>/login/index.php` with your creds.
2. Scrape the `sesskey` from the dashboard HTML.
3. Fire authenticated AJAX calls to pull courses, assignments, and notifications.

The credentials are **never stored** — request-scoped, discarded when the response goes out. They are also never re-sent from the frontend afterwards; the frontend holds them in memory only for the duration of the sync.

Vitol additionally accepts a `vitolSite` for campuses with multiple Vitol instances (rare; defaults handle VIT Chennai).

## Koha library — `/api/koha/*`

Koha endpoints are **public read-only proxies** of `webopaccc.vit.ac.in`: search, availability, detail, OPAC RSS. No credentials needed. They exist so the app can show availability without CORS issues and without teaching the browser Koha's URL scheme.

`/api/koha/patron` is the one exception — it's a patron account scrape and needs your library card number + catalogue pin:

```json
{ "card": "<card>", "password": "<pin>", "page": 1 }
```

The response is a page of your loans/holds — a snapshot, not persisted, not reused. Your pin rides in the request body; the API stores nothing.

## Where to next

- **[LMS & Koha reference](../03-api-reference/lms-koha/index.md)** — every route, tried live.
- **[Sessions and cookies](./sessions-and-cookies.md)** — compare with the VTOP model.
