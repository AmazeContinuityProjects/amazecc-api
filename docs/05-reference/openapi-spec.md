---
title: "Machine-readable spec (OpenAPI)"
description: "/api/docs exposes a swagger-jsdoc generated spec — what it contains, how thin it is, and how to use it anyway."
---

# Machine-readable spec (OpenAPI)

> **In one line:** `GET /api/docs` returns an OpenAPI 3.0 document assembled from the `@openapi` JSDoc blocks scattered through the route files — useful as a route list, useless as a schema source.

## What you get

- **Every route** in the app, with method, path, tags, and a generic response description (`"Successful response"`).
- **Almost no request schemas** — the JSDoc annotations were largely auto-generated; `requestBody` fields in most routes are missing or `properties: {}`.
- **No error shapes, no enum values, no auth security definitions.**

It is, in effect, a **live route index** — a machine-readable confirmation that the route handler files and this handbook agree. Nothing more.

## What it is good for

- Postman/Insomnia import to bootstrap clicks (you still have to fill the auth dialogs by hand).
- Sanity-checking route existence before you write a client.
- A quick `curl https://api.amazecc.com/api/docs | jq '.paths | keys'` when you forget whether `/api/x/y` exists.

## What it is bad at

- Types. Every `response.schema` is `type: object`. Skip it for shape-checking; trust the [reference pages](../03-api-reference/index.md) instead.
- Auth. No security scheme is declared — the Bearer/body carriage is undocumented. This handbook documents it.
- Drift. It is generated on-demand from the source by `swagger-jsdoc`. It cannot be stale — but it can never be smart, because nobody hand-wrote the schemas.

## Regenerating locally

`pnpm dev`, then `curl http://localhost:3000/api/docs | jq '.' > openapi.json`. Commit it if you want a pinned spec.

## The honest path forward

If you ever want a real spec: annotate `login`, `attendance`, `ffcs` and `whoami` by hand in their JSDoc with real request/response schemas; the rest can stay placeholders. The generator only respects what's actually there.

## Where to next

- **[The reference pages](../03-api-reference/index.md)** — the human spec.
- **[Types](./types.md)** — the shapes you actually need.
