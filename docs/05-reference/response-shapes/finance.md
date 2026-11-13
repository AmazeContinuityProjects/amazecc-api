---
title: "Response shapes: Finance"
description: "Every response body the finance route returns, field by field - per-section keys, partial failures and all."
---

# Response shapes: Finance

> **In one line:** one route, five VTOP pages, a per-section payload map - and failures that never become HTTP errors.

## POST /api/finance

**Envelope:** success-wrapped with **dynamic per-section keys** · 200 / 400 / 500 · reference: [finance](../../03-api-reference/finance/finance.md)

Body: `{cookies, authorizedID, csrf, section?: "all"|"dues"|"receipts"|"receipt"|"wallet"|"bank"|"library", applNo?}` (`section` defaults to `"all"`).

**`section: "receipt"`** (or whenever `applNo` is given):
`{ success: true, tables }` - `tables: {caption?, headers?, rows: Record<string,string>[]}[]` (from `parseVtopHtml` + clean).

**Everything else** - allSettled over the VTOP pages; **top-level `success` is false if any one section failed**, even if the other five succeeded:

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `false` if any section failed; **HTTP 200 either way** |
| `dues` | object | `{studentInfo?: {registerNumber?, studentName?, programme?, campus?}, hasDues: boolean, message?}` |
| `receipts` | object | `{receipts: {receiptNumber, date?, amount?, campusCode?, applNo?}[]}` |
| `receiptDetail` | object | `{tables: [...]}` - only when `applNo` given and receipts requested |
| `wallet` | object | `{ledgerINR: WalletEntry[], ledgerUSD: WalletEntry[]}` - `WalletEntry = {transactionDate?, receiptNumber?, transactionType?, amount?, refundAmount?, bookBalanceAmount?, refundDate?, particulars?}` (all strings) |
| `bank` | object | `{accountNumber?, confirmAccountNumber?, ifscCode?, beneficiaryName?, relationshipWithStudent?, accountType?, bankName?, branch?, address?, other?: Record<string,string>}` (all optional) |
| `library` | object | `{books?: {title?, author?, isbn?, dueAmount?, daysOverdue?}[], tables?, keyValuePairs?, messages?: {warning?, error?, success?}}` |
| `errors` | `Record<section,string>` | present **only when ≥1 section failed** - values are raw `err.message` (NOT masked by `publicErrorMessage`) |

Errors: 400 `{ error: "Missing csrf or authorizedID" }` (**no success field**) · 500 `{ success: false, error: <err.message> }`.
**Typed?** No - all section parsers return inline literals, cheerio sweeps loosely typed. No `src/types` entries.

<Warning>The single biggest gotcha in the API: **a 200 with `success: false` and a populated `errors` map is the finance route working as designed.** Per-section rendering is mandatory.</Warning>
