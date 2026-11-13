---
title: "Operations"
description: "Env vars, deployment, the CI loop, cron reminders and the footguns that have actually bitten us."
---

# Operations

> **In one line:** five pages for the day this service wakes you up at 3AM.

| Page | Read it when you… |
|---|---|
| [Env vars](./env-vars.md) | …are about to set up a fresh deploy (or debug a "works locally, 500s in prod") |
| [Deployment](./deployment.md) | …want to understand the Dockerfile, the Riven path, and why CI has no test step |
| [Cron and push](./cron-and-push.md) | …touch `/api/cron/reminders` or add a new push notification |
| [Security footguns](./security.md) | …inherit this repo — every public-write and TLS escape hatch, itemized |
