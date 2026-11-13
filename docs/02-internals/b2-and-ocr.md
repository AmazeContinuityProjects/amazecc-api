---
title: "Backblaze B2 and the paper OCR pipeline"
description: "How qbank stores and serves papers from B2 — and how the moderation pipeline (upload → OCR → approve) works."
---

# Backblaze B2 & the paper pipeline

> **In one line:** papers live in a Backblaze B2 bucket, streams out through this API, and pass a human moderation gate before any student can read them.

**Files:** `src/lib/clients/s3.ts` · `src/app/api/qbank/upload/route.ts` · `src/app/api/qbank/admin/import-to-storage/route.ts` · `papers_archive` table

## The bucket

`@aws-sdk/client-s3` with **forcePathStyle** (`B2_REGION`, `B2_ENDPOINT`, `B2_ACCESS_KEY_ID`, `B2_SECRET_ACCESS_KEY`, `B2_BUCKET_NAME`). Keys look like `papers/<source_id>.pdf`. Two storage paths feed the same bucket:

- **User uploads** — `POST /api/qbank/upload` (public!) records `file_url` pointing at a Google Drive or similar link with `approval_status = 'PENDING'`. No file is moved. Nothing is served until approval.
- **Admin import** — `POST /api/admin/import-to-storage` resolves a Drive link via `uc?export=download&id=`, downloads the PDF, and re-uploads it into B2 as `papers/<id>.pdf`. `file_url` is rewritten to the public download endpoint.

## The moderation lifecycle

```
PENDING  ──(admin OCR queue)──>  OCR_PROCESSING  ──(worker picks it up)──>  PENDING_Q_APPROVAL
                                       │
                                       └──(reset)──>  PENDING

PENDING_Q_APPROVAL  ──(admin publishes)──>  APPROVED  ──(anyone)──>  download
PENDING_Q_APPROVAL  ──(admin rejects)───>  REJECTED
```

- **OCR trigger**: `POST /api/admin/ocr` is the *external* queue — an outside worker (not in this repo) watches for `OCR_QUEUED` and runs the OCR, then calls back to stamp `PENDING_Q_APPROVAL`. `POST /api/qbank/admin/ocr` is the **stub** — it just waits 3 seconds and inserts 3 canned questions (the comment says replace with GPT-4o Vision/Mathpix in production).
- **Import path** bypasses Drive links only for admin-imported papers. User-uploaded papers remain Drive-linked until an admin uses `/api/admin/import-to-storage` to own them.
- **Anonymous downloads** — `GET /api/qbank/papers/download/[paperId]` is public. Papers in the bucket are test papers, not secret, but they are also the app's whole question-bank value. The public URL is fine because the upload flow requires moderation.

## The gotcha nobody believes

The upload route is **public** — no auth, no CAPTCHA, no rate limit beyond platform defaults. It writes rows with `approval_status = 'PENDING'`, so nothing user-facing leaks, but spam rows fill the admin queue. The only mitigation in-code: `audit_logs` is untouched, `uploader_reg_no` defaults to `'anonymous'`, and qbank has no reputation system. If spam becomes real, the first lever is a shared-secret form token — do not add VTOP-login requirements without asking why.

## Where to next

- **[The database layer](./db-layer.md)** — where `papers_archive` lives.
- **[The qbank reference](../03-api-reference/qbank/index.md)** — the moderation endpoints.
