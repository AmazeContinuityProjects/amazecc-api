---
title: "Internals"
description: "How the hard parts actually work: the login tour, the attendance fan-out, the VTOP client, parsers, the DB, the social crypto and the B2 pipeline."
---

# Internals

> **In one line:** eight walkthroughs of the code paths that decide whether this repo compiles or cries — read the one for what you're touching, then go touch it.

| Page | Read it when you… |
|---|---|
| [The login endpoint, line by line](./login-endpoint.md) | …need to know why login takes 3–8 seconds |
| [Attendance endpoint anatomy](./attendance-endpoint.md) | …are touching attendance, marks or timetable merges |
| [The VTOP client](./vtop-client.md) | …call VTOP from anywhere in this repo |
| [The parsers](./parsers.md) | …write or fix a page parse |
| [The database layer](./db-layer.md) | …add a table or a `getDbPool()` call |
| [The social timetable crypto](./social-crypto.md) | …touch pairing, visibility, or grants |
| [Backblaze B2 & the paper OCR pipeline](./b2-and-ocr.md) | …touch qbank/papers or the OCR queue |
| [Bulk & the proxy registry](./bulk-and-proxies.md) | …fan out to VTOP via /api/bulk |

Every walkthrough references exact files and line-ish locations. When VTOP changes markup, the parser pages will rot first — check `ROUTE_TRACKER.md` before you trust anything here.
