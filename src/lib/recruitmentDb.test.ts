/**
 * Integration tests for recruitment storage. Skipped unless
 * RECRUITMENT_IT_DATABASE_URL points at a disposable Postgres, e.g.
 *
 *   podman run -d --rm -p 127.0.0.1:55432:5432 -e POSTGRES_PASSWORD=test postgres:17-alpine
 *   RECRUITMENT_IT_DATABASE_URL=postgres://postgres:test@localhost:55432/postgres pnpm test
 *
 * It creates and drops its own table, so never point it at a real database.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Application } from "./recruitment";

const url = process.env.RECRUITMENT_IT_DATABASE_URL;

describe.skipIf(!url)("recruitmentDb (Postgres)", async () => {
  if (url) process.env.DATABASE_URL = url;
  const { getDbPool } = await import("./db");
  const db = await import("./recruitmentDb");
  const CYCLE = "test-cycle";

  const app = (email: string, extra: Partial<Application> = {}): Application => ({
    name: "Asha",
    email,
    regNo: "25BCE1234",
    year: 1,
    roles: ["developer"],
    otherRole: null,
    why: "x".repeat(60),
    experience: null,
    links: [],
    hoursPerWeek: 5,
    ...extra,
  });

  beforeAll(async () => {
    await getDbPool().query(`DROP TABLE IF EXISTS ${db.RECRUITMENT_TABLE}`);
    await db.ensureRecruitmentSchema();
  });
  afterAll(async () => {
    await getDbPool().query(`DROP TABLE IF EXISTS ${db.RECRUITMENT_TABLE}`);
    await getDbPool().end();
  });

  it("creates, then updates in place on resubmission", async () => {
    const first = await db.submitApplication(CYCLE, app("a@vitstudent.ac.in"), "ip1");
    expect(first.kind).toBe("created");
    const second = await db.submitApplication(CYCLE, app("a@vitstudent.ac.in", { hoursPerWeek: 9 }), "ip1");
    expect(second).toEqual({ kind: "updated", id: (first as { id: number }).id });
    const { applications, total } = await db.listApplications({ cycle: CYCLE });
    expect(total).toBe(1);
    expect(applications[0]).toMatchObject({ hoursPerWeek: 9, editCount: 1, status: "new" });
    expect(applications[0]).not.toHaveProperty("ipHash");
  });

  it("caps edits", async () => {
    for (let i = 0; i < db.MAX_EDITS - 1; i++) {
      expect((await db.submitApplication(CYCLE, app("a@vitstudent.ac.in"), "ip1")).kind).toBe("updated");
    }
    expect((await db.submitApplication(CYCLE, app("a@vitstudent.ac.in"), "ip1")).kind).toBe("too_many_edits");
  });

  it("freezes an application once reviewed", async () => {
    const created = await db.submitApplication(CYCLE, app("b@vitstudent.ac.in"), "ip2");
    const id = (created as { id: number }).id;
    const reviewed = await db.setApplicationStatus(id, "shortlisted", "sugeeth", "Strong portfolio");
    expect(reviewed).toMatchObject({ status: "shortlisted", reviewedBy: "sugeeth", reviewNote: "Strong portfolio" });
    expect((await db.submitApplication(CYCLE, app("b@vitstudent.ac.in"), "ip2")).kind).toBe("locked");
    // A later status change keeps the earlier note when no new one is given.
    expect(await db.setApplicationStatus(id, "accepted", "sugeeth", null)).toMatchObject({ reviewNote: "Strong portfolio" });
    expect(await db.setApplicationStatus(999999, "accepted", "x", null)).toBeNull();
  });

  it("filters by role and status, and pages", async () => {
    await db.submitApplication(CYCLE, app("c@vitstudent.ac.in", { roles: ["design", "other"], otherRole: "Security" }), "ip3");
    expect((await db.listApplications({ cycle: CYCLE, role: "design" })).total).toBe(1);
    expect((await db.listApplications({ cycle: CYCLE, status: "accepted" })).total).toBe(1);
    expect((await db.listApplications({ cycle: CYCLE, limit: 1 })).applications).toHaveLength(1);
    expect((await db.listApplications({ cycle: "other-cycle" })).total).toBe(0);
  });

  it("keeps the same email separate across cycles", async () => {
    expect((await db.submitApplication("next-cycle", app("b@vitstudent.ac.in"), "ip2")).kind).toBe("created");
  });

  it("stops one network after the daily cap", async () => {
    await getDbPool().query(
      `INSERT INTO ${db.RECRUITMENT_TABLE} (cycle, name, email, reg_no, year, roles, why, hours_per_week, ip_hash)
       SELECT $1, 'Bot', 'bot' || g || '@vitstudent.ac.in', '25BCE0001', 1, '{developer}', 'x', 1, 'busy-ip'
         FROM generate_series(1, $2) g`,
      [CYCLE, db.MAX_SUBMISSIONS_PER_IP_PER_DAY],
    );
    expect((await db.submitApplication(CYCLE, app("d@vitstudent.ac.in"), "busy-ip")).kind).toBe("ip_limit");
    expect((await db.submitApplication(CYCLE, app("d@vitstudent.ac.in"), "quiet-ip")).kind).toBe("created");
  });

  it("does not let concurrent resubmissions exceed the edit cap", async () => {
    await db.submitApplication(CYCLE, app("e@vitstudent.ac.in"), "ip5");
    const results = await Promise.all(
      Array.from({ length: db.MAX_EDITS + 5 }, () => db.submitApplication(CYCLE, app("e@vitstudent.ac.in"), "ip5")),
    );
    expect(results.filter((r) => r.kind === "updated")).toHaveLength(db.MAX_EDITS);
  });
});
