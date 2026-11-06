# Student lookup: classmates by VTOP class ID

This is the student/classmate lookup feature plan to ship alongside the API
runtime migration. It is designed to reuse AmazeCC's existing social timetable
pipeline and to avoid building an unrestricted student directory.

## Product boundary

There are two distinct features:

1. **Friends in my classes:** show which people the student has already paired
   with who share an exact VTOP class ID, plus the number of paired friends in
   each class.
2. **Discover classmates:** find other AmazeCC users in those classes even
   before pairing. This requires a separate, explicit discoverability opt-in.

Ship item 1 first. Do not infer consent to be listed from merely logging into
VTOP or using AmazeCC. Do not scrape an entire VTOP roster on behalf of one
user.

## Existing implementation to reuse

The API already has:

- `POST /api/social/identity/sync`: derives the caller's profile and timetable
  from the caller's VTOP session.
- `social_people`: stores a pseudonymous owner key, random public handle and
  display name.
- `social_timetables`: stores the caller's derived schedule and `courses`,
  including `classId`, for a semester.
- Mutual/revocable `social_grants` and `POST /api/social/timetable`, which
  authorizes shared timetable reads.

AmazeCC already has the Social tab, paired people, cached peer timetables,
groups, and class-time comparison. `SocialCourse.classId` is already available
to the client. The current model does not have classmate discovery or
favorites.

## Recommended MVP: exact-class overlap among paired friends

Build a derived index in the client from the current student's courses and
already loaded peer courses:

```text
classId -> {
  myCourse,
  peers: [peer handles],
  peerCount
}
```

Use the exact `classId`, not course code. A course code may appear across
multiple sections or components; a VTOP class ID identifies the precise
offering/component that should match.

For each course, show the user's paired friends with the same `classId` and a
count. Missing, stale, unshared, or not-yet-loaded peer timetables are not a
match and must not be presented as confirmed absences. Use the existing
published/stale indicators.

This MVP needs no new VTOP scraping and no new per-class server reads. It uses
data already returned through the social sharing flow. It also avoids adding
database work to a screen that can be calculated from small course arrays.

## Favorites

Persist favorites as a user-private set of peer handles in the existing
account-namespaced local storage. Use the same handle identity as the Social
feature, not array positions or names. Favorites should:

- Sort or filter the People list without changing pairing or sharing.
- Be cleared/ignored when a handle is no longer an active peer.
- Never grant access to a timetable; the grant remains the authorization
  source.

If cross-device favorites become a requirement, add a small authenticated
`social_favorites(owner_key, peer_owner_key)` table later. Do not put
registration numbers in the favorites API.

## Discover classmates beyond existing friends

Only add this after the opt-in and abuse model is agreed. The API should list
only students who actively enabled class discovery.

### Data model

Continue using `owner_key` as the internal pseudonymous identifier; never add a
plain registration number to a class bucket.

Preferred index for opted-in users:

```sql
CREATE TABLE social_class_members (
  semester_id TEXT NOT NULL,
  class_id    TEXT NOT NULL,
  owner_key   TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (semester_id, class_id, owner_key)
);

CREATE INDEX idx_social_class_members_owner
  ON social_class_members (owner_key, semester_id);
```

Maintain a discoverability flag per person (or per semester if product policy
requires it). Populate `social_class_members` from the timetable the server
has just derived from the caller's own authenticated VTOP response:

- When discoverability is enabled, replace that owner's membership rows for
  the resolved semester in the same transaction as the timetable upsert.
- When disabled, delete the owner's discovery rows immediately.
- When a timetable changes, removed class IDs disappear on the next sync.
- Retire old-semester rows by an explicit retention policy.
- Build and validate an index before serving discovery traffic; do not make a
  campus-wide scan of the JSONB `courses` array on every request.

### API contract

Proposed route: `POST /api/social/classmates`.

- Authenticate the caller with a live VTOP session and derive their owner key
  from VTOP, as the existing `socialCaller` does.
- Derive the caller's class IDs from the server-stored timetable. Do not accept
  arbitrary `registerNo`, `owner_key`, or `classId[]` values as the search
  authority.
- Return only active, discoverable matches for the caller's own semester and
  own exact class IDs.
- Return public handle and consented display name, shared class identifiers,
  and freshness metadata. Do not return registration number, VTOP cookies,
  course venue, or any unrelated profile fields.
- Apply per-authenticated-user and per-IP limits, pagination/result caps, and
  block/report handling. Avoid an endpoint that accepts an arbitrary class ID
  and returns a whole roster.
- Keep class discovery separate from timetable sharing. A match does not
  automatically create a pair or grant.

### Server-load strategy

Use one bounded endpoint that authenticates once and performs one indexed
query for all of the caller's classes. Do not call `identifyCaller` once per
friend/class or scrape VTOP while rendering the discovery screen.

The existing peer timetable client intentionally reads peers sequentially,
and each `/api/social/timetable` read validates the caller session. That is
safe for the existing flow but is not the right batch shape for class
discovery. The new route should authenticate once, scope its query using the
derived caller identity and opt-in index, and return a bounded result set.

VTOP derivation remains user-triggered/normal-sync work. Coalesce duplicate
syncs, enforce a per-user refresh cooldown, and never run a background crawl
over guessed registration numbers.

## Privacy and abuse requirements

- Discoverability must be a clear, revocable opt-in with a preview of what
  classmates can see.
- Do not store or expose raw register numbers in class membership, response
  bodies, caches, analytics, URLs, or logs.
- Use only data derived from the authenticated user's VTOP session; never
  accept client-supplied identity as proof of ownership.
- Do not reveal non-users or students who opted out.
- Support immediate opt-out, stale-data disclosure, blocking/reporting, and
  retention/deletion.
- Default all classmate responses to `Cache-Control: private, no-store`.
- Keep access logs and telemetry free of class IDs joined to student identity.
- Review university/VTOP terms and applicable privacy rules before enabling
  campus-wide discovery. The reference FFCS Finder page describes user-entered
  data; it is not evidence that automated VTOP roster harvesting is permitted.

## Rollout

1. Ship the paired-friends class view and local favorites using existing
   cached data.
2. Measure the number of active paired users, data freshness, peer-read calls,
   and query latency.
3. Add the opt-in flag and membership index behind a feature flag; backfill
   only from future authenticated timetable syncs.
4. Add the batched lookup endpoint and Worker route after the API gateway and
   origin-protection phases are proven.
5. Pilot with a small opted-in cohort. Verify opt-out/deletion and rate limits
   before widening access.

## Tests and acceptance

- Exact `classId` matches; same course code but different class IDs do not
  match.
- Theory/lab or other distinct components remain distinct where their class
  IDs differ.
- Paired-friend count is correct with duplicate courses and multiple friends.
- Coarse/revoked grants, stale schedules, deleted peers, and missing peer data
  never appear as confirmed matches.
- Discovery returns only opted-in users in the caller's server-derived class
  set and semester.
- Caller-supplied registration numbers/class IDs cannot broaden results.
- Opt-out removes membership immediately; response and logs contain no
  registration number.
- One request performs one identity validation and a bounded indexed query;
  no per-class/per-peer VTOP amplification.
