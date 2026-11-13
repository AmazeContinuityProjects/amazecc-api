<!-- generated: aapi1 -->
---
title: "QBank"
description: "Every QBank endpoint: method, path, auth and rate limits."
---

# QBank

> **In one line:** Question banks and previous papers: public read, public pending-upload, admin-moderated approval pipeline (OCR -> questions -> publish). Files live on Backblaze B2.

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| get | `/api/qbank/courses` | None | - |
| get | `/api/qbank/papers` | None | - |
| get | `/api/qbank/papers/download/[paperId]` | None | - |
| get | `/api/qbank/questions` | None | - |
| post | `/api/qbank/upload` | None | - |
| get, post, patch, delete | `/api/qbank/admin/questions` | Admin bearer token | - |
| post | `/api/qbank/admin/questions/bulk` | Admin bearer token | - |
| get, patch | `/api/qbank/admin/queue` | Admin bearer token | - |
| post | `/api/qbank/admin/ocr` | Admin bearer token | - |
| post | `/api/qbank/admin/import-to-storage` | Admin bearer token | - |
| post | `/api/qbank/admin/publish` | Admin bearer token | - |
| post | `/api/qbank/admin/reject` | Admin bearer token | - |
