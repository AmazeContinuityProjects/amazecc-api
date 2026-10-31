# Changelog

## Unreleased (feature/faculty-reviews)

### Added
- Faculty Reviews API: `/api/reviews/{eligibility,submit,enrollment-snapshot,catalog,faculty/[id]}`,
  admin routes under `/api/admin/reviews/*`, and `migrate_reviews.sql`
  (idempotent; safe to re-run on a database where the tables already exist).
- All review routes are gated by `ENABLE_AMAZE_REVIEWS` (**default off**, strict
  opt-in: only the text `true` enables them).
- Strict validation against the single question config: unknown top-level and
  context fields are rejected, context values and `project_term` must come from
  the approved lists. There is no free-text field.

### Security
- Identity is read from the `x-authorized-id` header or the JSON body only,
  never the URL. Person-specific id mappings were removed.
- Project-guide reviews are never stored as verified (the flag was
  client-supplied).
- `submit` no longer triggers a full Worker recompute per request.
- `sync-catalog` requires admin authentication (it was anonymous).
- Enrollment snapshots are capped, rate limited and shape-checked.

### Notes
- `lint` has two pre-existing problems outside this feature in
  `src/lib/marksStats.test.ts` (see docs/CODE_REVIEW.md).
