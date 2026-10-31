import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateReviewSubmission } from "../../../../lib/reviews/validation";
import { isReviewsEnabled } from "../../../../lib/reviews/featureFlag";
import {
  MAX_SNAPSHOT_COURSES,
  sanitizeSemester,
  sanitizeTimetableCourses,
} from "../../../../lib/reviews/enrollmentInput";
import { PROJECT_CONFIG } from "../../../../config/reviewQuestions";

const queryMock = vi.fn();
vi.mock("@/lib/db", () => ({ getDbPool: () => ({ query: queryMock }) }));

const FACULTY = "11111111-1111-4111-a111-111111111111";

function projectAnswers(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const q of PROJECT_CONFIG.qualityQuestions) if (!q.conditional) out[q.id] = 4;
  for (const s of PROJECT_CONFIG.styleQuestions) out[s.id] = 3;
  return out;
}

function projectReview(overrides: Record<string, unknown> = {}) {
  return {
    authorizedID: "25TEST0001",
    faculty_id: FACULTY,
    track: "project",
    project_term: "FALL2026-27 Capstone",
    answers: projectAnswers(),
    tags_green: [],
    tags_red: [],
    context: { project_type: "Capstone", team_size: "Solo", how_assigned: "I chose them", outcomes: ["None"] },
    ...overrides,
  };
}

describe("feature flag (default OFF)", () => {
  const original = process.env.ENABLE_AMAZE_REVIEWS;
  afterEach(() => {
    if (original === undefined) delete process.env.ENABLE_AMAZE_REVIEWS;
    else process.env.ENABLE_AMAZE_REVIEWS = original;
  });

  it("is OFF when unset and for anything other than the literal 'true'", () => {
    delete process.env.ENABLE_AMAZE_REVIEWS;
    expect(isReviewsEnabled()).toBe(false);
    for (const v of ["false", "1", "TRUE", "yes", ""]) {
      process.env.ENABLE_AMAZE_REVIEWS = v;
      expect(isReviewsEnabled()).toBe(false);
    }
    process.env.ENABLE_AMAZE_REVIEWS = "true";
    expect(isReviewsEnabled()).toBe(true);
  });

  it("returns 503 from every public reviews route when OFF, without touching the database", async () => {
    delete process.env.ENABLE_AMAZE_REVIEWS;
    queryMock.mockClear();

    const submit = await import("../submit/route");
    const eligibility = await import("../eligibility/route");
    const snapshot = await import("../enrollment-snapshot/route");
    const catalog = await import("../catalog/route");
    const profile = await import("../faculty/[id]/route");

    const post = (url: string) =>
      new Request(url, { method: "POST", headers: { "x-authorized-id": "25TEST0001" }, body: "{}" });

    expect((await submit.POST(post("http://t/api/reviews/submit"))).status).toBe(503);
    expect((await eligibility.GET(new Request("http://t/e", { headers: { "x-authorized-id": "25TEST0001" } }))).status).toBe(503);
    expect((await snapshot.POST(post("http://t/s"))).status).toBe(503);
    expect((await catalog.GET(new Request("http://t/c"))).status).toBe(503);
    expect((await profile.GET(new Request("http://t/f"), { params: Promise.resolve({ id: FACULTY }) })).status).toBe(503);
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe("validation: unknown fields and free text", () => {
  it("accepts a well-formed project review", () => {
    const res = validateReviewSubmission(projectReview());
    expect(res.valid).toBe(true);
    expect(res.sanitized?.project_term).toBe("FALL2026-27 Capstone");
  });

  it("rejects unknown top-level fields (not only a deny-list of known names)", () => {
    for (const extra of [{ verified: true }, { bio: "hello" }, { anything: 1 }]) {
      const res = validateReviewSubmission(projectReview(extra));
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Unknown field/);
    }
  });

  it("rejects unknown context keys, including client-asserted verification", () => {
    const res = validateReviewSubmission(projectReview({ context: { verified_context: true } }));
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Unknown context field/);
  });

  it("rejects free text smuggled into context option fields", () => {
    for (const context of [
      { project_type: "My guide was rude and unfair" },
      { team_size: "<script>alert(1)</script>" },
      { how_assigned: "free text" },
      { outcomes: ["Paper published", "free text"] },
    ]) {
      const res = validateReviewSubmission(projectReview({ context }));
      expect(res.valid).toBe(false);
    }
  });

  it("rejects free text in project_term, course_code and semester", () => {
    expect(validateReviewSubmission(projectReview({ project_term: "FALL2026-27 my guide is bad" })).valid).toBe(false);
    expect(validateReviewSubmission(projectReview({ project_term: "just words" })).valid).toBe(false);

    const teaching = {
      authorizedID: "25TEST0001",
      faculty_id: FACULTY,
      track: "teaching",
      answers: {},
      context: { component: "Theory" },
    };
    expect(validateReviewSubmission({ ...teaching, course_code: "great teacher, would take again!!", semester: "CH20262701" }).valid).toBe(false);
    expect(validateReviewSubmission({ ...teaching, course_code: "BCSE101E", semester: "a long sentence of words here" }).valid).toBe(false);
  });
});

describe("enrollment snapshot input whitelist", () => {
  it("caps the number of courses", () => {
    const many = Array.from({ length: 500 }, (_, i) => ({
      courseCode: `BCSE${100 + i}E`,
      facultyDetails: "DR TEST PERSON - SCOPE - 12345",
    }));
    expect(sanitizeTimetableCourses(many).length).toBe(MAX_SNAPSHOT_COURSES);
  });

  it("drops entries with non-identifier course codes, markup, or oversized faculty text", () => {
    const out = sanitizeTimetableCourses([
      { courseCode: "BCSE101E", facultyDetails: "DR TEST PERSON - SCOPE - 12345" },
      { courseCode: "BCSE102E", facultyDetails: "<img src=x onerror=alert(1)>" },
      { courseCode: "free text course code here that is long", facultyDetails: "DR X" },
      { courseCode: "BCSE103E", facultyDetails: "A".repeat(500) },
      { courseCode: "BCSE104E", employeeId: "12; DROP TABLE faculty" },
      "not-an-object",
    ]);
    expect(out.map((c) => c.courseCode)).toEqual(["BCSE101E"]);
  });

  it("returns [] for non-array input and falls back for a bad semester", () => {
    expect(sanitizeTimetableCourses({ evil: true })).toEqual([]);
    expect(sanitizeSemester("<b>x</b>", "FALL2026-27")).toBe("FALL2026-27");
    expect(sanitizeSemester("ch20262701", "FALL2026-27")).toBe("CH20262701");
  });

  it("keeps a course whose optional descriptors are odd instead of dropping it", () => {
    const out = sanitizeTimetableCourses([
      { courseCode: "BCSE101E", facultyDetails: "DR TEST PERSON", component: "Embedded Theory and Lab Combined Course", semester: "??" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].component).toBeUndefined();
    expect(out[0].semester).toBeUndefined();
  });
});

describe("submit route: project reviews are never verified and never trigger recompute", () => {
  const saved = { ...process.env };
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.ENABLE_AMAZE_REVIEWS = "true";
    process.env.REVIEW_HASH_SECRET = "unit-test-hash-secret";
    process.env.REVIEWS_INGEST_SECRET = "unit-test-ingest-secret";
    process.env.REVIEWS_WORKER_URL = "http://worker.test";
    queryMock.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("{}", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...saved };
  });

  it("stores verified=false for the project track and calls only /internal/ingest", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (/FROM faculty WHERE id/.test(sql)) return { rows: [{ id: FACULTY, status: "official" }] };
      if (/COUNT\(\*\)/.test(sql)) return { rows: [{ count: "0" }] };
      return { rows: [] };
    });

    const { POST } = await import("../submit/route");
    const res = await POST(
      new Request("http://t/api/reviews/submit", {
        method: "POST",
        headers: { "x-authorized-id": "25TEST0002", "content-type": "application/json" },
        body: JSON.stringify(projectReview()),
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).verified).toBe(false);

    const insert = queryMock.mock.calls.find(([sql]) => /INSERT INTO reviews/.test(sql));
    expect(insert).toBeTruthy();
    // $7 = verified
    expect(insert![1][6]).toBe(false);

    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls).toEqual(["http://worker.test/internal/ingest"]);
    expect(urls.some((u) => u.includes("recompute"))).toBe(false);
  });
});
