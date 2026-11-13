---
title: "Response shapes: QBank"
description: "Every response body the question-bank endpoints return, field by field."
---

# Response shapes: QBank

> **In one line:** papers, questions, uploads and the moderation pipeline - success-wrapped almost everywhere, raw stream for downloads.

<Note>Admin 401s from `requireAdminAuth` use **`message`**, not `error`: `{ success: false, message: "Unauthorized" }`. Only the wire-shapes below mention `error` keys.</Note>

## GET /api/qbank/courses

**Envelope:** success-wrapped (public) · 200 / 500 · reference: [courses](../../03-api-reference/qbank/courses.md)

`{ success: true, data }` - `SELECT DISTINCT course_code AS code, title FROM papers_archive WHERE approval_status='APPROVED'` → array of `{code: string, title: string}` - no dedupe on title; envelope `data`, not a bare array.
**Typed?** No.

## GET /api/qbank/papers

**Envelope:** success-wrapped (public) · 200 / 400 / 500 · reference: [papers](../../03-api-reference/qbank/papers.md)

Requires `?course=`: `{ success: true, data }` - rows of `papers_archive` where `course_code=$1 AND approval_status='APPROVED'` ordered `created_at DESC`. Columns (per migrate DDL + code usage): `source_id (uuid), course_code, title, source_type ('CAT 1' default, 'UPLOAD' set by import), exam_year (INT), exam_semester (TEXT - **not in DDL**), file_url, uploader_reg_no, approval_status, created_at, file_size, storage_provider`.
400 when `?course=` missing. **Typed?** No.

## GET /api/qbank/papers/download/[paperId]

**Envelope:** **binary** - raw PDF stream · 200 / 404 / 500 · reference: [papers/download/[paperId]](../../03-api-reference/qbank/papers-download-paperId.md)

Streams `papers/<paperId>.pdf` from the B2/R2 bucket. Headers: `Content-Type: application/pdf` · `Content-Disposition: inline; filename="<course>_<year>_<sem>.pdf"` (non-safe chars → `_`). Error bodies carry **no success flag**: 404 `{ error: "Paper not found" }` / `{ error: "File not found in storage" }`. **No approval_status check** - pending/rejected papers are downloadable if you know the id.
**Typed?** No.

## GET /api/qbank/questions

**Envelope:** success-wrapped (public) · 200 / 400 / 500 · reference: [questions](../../03-api-reference/qbank/questions.md)

Requires `?course=`: `{ success: true, data }` - `qbank_questions` joined with `papers_archive`: `question_id (uuid), source_id (uuid), question_number (string), question_text, image_url, question_type ('DESCRIPTIVE'|'NUMERICAL'|'MCQ'), options (JSONB→parsed object), correct_answer, marks (INT), topic_name (**not in DDL**), + source_type, exam_semester, exam_year (from paper)`.
**Typed?** No.

## POST /api/qbank/upload

**Envelope:** success-wrapped (public, anonymous) · 200 / 400 / 500 · reference: [upload](../../03-api-reference/qbank/upload.md)

Success: `{ success: true, sourceId }` - **not** under `data`; top-level `sourceId` (camelCase uuid). Body requires `courseCode, title, fileUrl` - everything else defaults (`paperType "CAT 1"`, `examYear = current year`, `examSemester "Fall"`, `uploaderRegNo "anonymous"`). Row always inserted as `PENDING`.
**Typed?** No.

## GET/POST/PATCH/DELETE /api/qbank/admin/questions

Reference: [admin/questions](../../03-api-reference/qbank/admin-questions.md) · admin

| Verb | Success | Notes |
|---|---|---|
| GET (`?paperId=`) | `{ success: true, data }` | `SELECT * ... WHERE source_id=$1 ORDER BY question_number` - full question rows |
| POST (`{paperId}`) | `{ success: true, data }` | inserts placeholder row: `question_number='New'`, text placeholder, `marks=0`, `question_type='DESCRIPTIVE'` |
| PATCH (`{questionId, ...fields}`) | **`{ success: true }`** | bare; updatable: questionText, questionNumber, marks, questionType, options (JSON.stringify/null), correctAnswer, imageUrl, topicName - unrecognized keys ignored |
| DELETE (`{questionId}`) | **`{ success: true }`** | bare |

**Typed?** No.

## POST /api/qbank/admin/questions/bulk

**Envelope:** success-wrapped · 200 / 400 / 401 / 500 · reference: [admin/questions/bulk](../../03-api-reference/qbank/admin-questions-bulk.md)

Body `{ paperId, questions: [] }`: `{ success: true, count: questions.length }`. **Deletes all existing questions for the paper before re-inserting** (transactional). Question keys are snake_case: `question_number (toString), question_type (default MCQ-if-options-else-DESCRIPTIVE), topic_name, marks (parseInt), question_text, options (JSON.stringify/null), correct_answer, image_url`.
**Typed?** No.

## GET/PATCH /api/qbank/admin/queue

Reference: [admin/queue](../../03-api-reference/qbank/admin-queue.md)

GET (`?status=`, `'ALL'` or omit = no filter): `{ success: true, data }` - rows of `papers_archive` ordered `created_at DESC`.
PATCH (`{paperId, ...updates}`): `{ success: true, data }` - `... RETURNING *` (full updated row). Whitelisted update keys: `title, course_code, source_type, exam_year, exam_semester, file_url, approval_status, uploader_reg_no` - others silently dropped → 400 `No valid fields to update` when none match. 404 when zero rows returned.
**Typed?** No.

## POST /api/qbank/admin/ocr

**Envelope:** mixed - success wrapped, **errors raw** · 200 / 400 / 401 / 500 · reference: [admin/ocr](../../03-api-reference/qbank/admin-ocr.md)

Success (always): `{ success: true, count }` - count of **3 hardcoded mock questions** the route inserts after OCR-simulation (\~3s artificial delay). Reality: **simulated OCR** - the comment in code says "replace with GPT-4o Vision / Mathpix in production". Side effects: `papers_archive.approval_status` `OCR_PROCESSING` → `PENDING_Q_APPROVAL`; deletes no existing questions.
Errors carry **no success flag**: 400 `{ error: "Paper ID is required" }`, 500 `{ error: "Internal server error" }`. No paper-existence check (FK would reject bogus id).
**Typed?** No.

## POST /api/qbank/admin/import-to-storage

**Envelope:** success-wrapped · 200 / 400 / 401 / 404 / 500 / 502 · reference: [admin/import-to-storage](../../03-api-reference/qbank/admin-import-to-storage.md)

Success: `{ success: true, fileUrl, fileSize }` - `fileUrl` points **back at this API** (`/api/qbank/papers/download/<paperId>`), not at R2 directly; `fileSize` = bytes. Side effects: downloads remote `file_url` (Google Drive URLs rewritten to `uc?export=download&id=`), uploads to B2/R2 as `papers/<paperId>.pdf`, then `UPDATE papers_archive SET file_url, file_size, storage_provider='R2', source_type='UPLOAD'`.
Errors: 502 `{ success: false, error: "Failed to download file from remote host: ..." }` (axios) · 500 storage/DB failures (masked through `publicErrorMessage`).
**Typed?** No.

## POST /api/qbank/admin/publish

**Envelope:** success-wrapped (bare) · 200 / 400 / 401 / 500 · reference: [admin/publish](../../03-api-reference/qbank/admin-publish.md)

Success: `{ success: true }` - sets `approval_status='APPROVED'`. No row-existence check (0 rows updated still 200).
**Typed?** No.

## POST /api/qbank/admin/reject

**Envelope:** success-wrapped (bare) · 200 / 400 / 401 / 500 · reference: [admin/reject](../../03-api-reference/qbank/admin-reject.md)

Success: `{ success: true }` - sets `approval_status='REJECTED'`. Identical shape to publish.
**Typed?** No.
