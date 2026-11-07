import { describe, expect, it } from "vitest";
import { isSpamTrap, LIMITS, publicConfig, RECRUITMENT, validateApplication } from "./recruitment";

const valid = () => ({
  name: "  Asha   Ramesh ",
  email: "Asha.Ramesh2025@VITSTUDENT.AC.IN",
  regNo: "25bce 1234",
  year: 1,
  roles: ["developer", "design"],
  why: "I want to build tools students actually use, and AmazeCC is where that happens on campus.",
  experience: "Built a timetable app\n\n\n\nfor my hostel.",
  links: ["https://github.com/asha", "https://github.com/asha"],
  hoursPerWeek: 6,
  consent: true,
});

describe("validateApplication", () => {
  it("accepts a good application and normalises it", () => {
    const v = validateApplication(valid());
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value).toMatchObject({
      name: "Asha Ramesh",
      email: "asha.ramesh2025@vitstudent.ac.in",
      regNo: "25BCE1234",
      roles: ["developer", "design"],
      otherRole: null,
      links: ["https://github.com/asha"],
      hoursPerWeek: 6,
    });
    expect(v.value.experience).toBe("Built a timetable app\n\nfor my hostel.");
  });

  it("only takes VIT student emails", () => {
    for (const email of ["a@gmail.com", "a@vit.ac.in", "not-an-email", "a@vitstudent.ac.in.evil.com"]) {
      const v = validateApplication({ ...valid(), email });
      expect(v.ok, email).toBe(false);
      if (!v.ok) expect(v.errors.email).toMatch(/vitstudent/);
    }
  });

  it("checks the registration number shape", () => {
    expect(validateApplication({ ...valid(), regNo: "12345" }).ok).toBe(false);
    expect(validateApplication({ ...valid(), regNo: "21BLC1081" }).ok).toBe(true);
  });

  it("requires 1 to 3 known roles, and a description for Other", () => {
    expect(validateApplication({ ...valid(), roles: [] })).toMatchObject({ ok: false, errors: { roles: expect.any(String) } });
    expect(validateApplication({ ...valid(), roles: ["hacker"] })).toMatchObject({ ok: false });
    expect(
      validateApplication({ ...valid(), roles: ["developer", "design", "non-technical", "other"], otherRole: "x" }),
    ).toMatchObject({ ok: false, errors: { roles: expect.stringMatching(/up to 3/) } });
    expect(validateApplication({ ...valid(), roles: ["other"] })).toMatchObject({
      ok: false,
      errors: { otherRole: expect.any(String) },
    });
    const v = validateApplication({ ...valid(), roles: ["other"], otherRole: " Cybersecurity " });
    expect(v.ok && v.value.otherRole).toBe("Cybersecurity");
  });

  it("drops otherRole when Other is not picked", () => {
    const v = validateApplication({ ...valid(), otherRole: "ignored" });
    expect(v.ok && v.value.otherRole).toBeNull();
  });

  it("bounds the free text", () => {
    expect(validateApplication({ ...valid(), why: "too short" })).toMatchObject({ ok: false, errors: { why: expect.any(String) } });
    expect(validateApplication({ ...valid(), why: "x".repeat(LIMITS.whyMax + 1) }).ok).toBe(false);
    expect(validateApplication({ ...valid(), experience: "x".repeat(LIMITS.experienceMax + 1) }).ok).toBe(false);
    expect(validateApplication({ ...valid(), name: "A" }).ok).toBe(false);
  });

  it("only accepts real web links", () => {
    for (const links of [["javascript:alert(1)"], ["github.com/asha"], ["https://localhost"], new Array(6).fill(0).map((_, i) => `https://e${i}.com`)]) {
      expect(validateApplication({ ...valid(), links }).ok, JSON.stringify(links)).toBe(false);
    }
    expect(validateApplication({ ...valid(), links: [] }).ok).toBe(true);
  });

  it("checks year, hours and consent", () => {
    expect(validateApplication({ ...valid(), year: 0 }).ok).toBe(false);
    expect(validateApplication({ ...valid(), year: "2" }).ok).toBe(true);
    expect(validateApplication({ ...valid(), hoursPerWeek: 41 }).ok).toBe(false);
    expect(validateApplication({ ...valid(), hoursPerWeek: 2.5 }).ok).toBe(false);
    expect(validateApplication({ ...valid(), consent: "true" }).ok).toBe(false);
  });

  it("reports every problem at once, by field", () => {
    const v = validateApplication({});
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(Object.keys(v.errors).sort()).toEqual(
        ["consent", "email", "hoursPerWeek", "name", "regNo", "roles", "why", "year"].sort(),
      );
    }
  });

  it("ignores non-string junk without throwing", () => {
    expect(() => validateApplication({ name: 42, roles: [1, null], links: [{}], why: ["a"] })).not.toThrow();
  });
});

describe("spam trap and public config", () => {
  it("flags a filled hidden field", () => {
    expect(isSpamTrap({ website: "http://spam" })).toBe(true);
    expect(isSpamTrap({ website: "  " })).toBe(false);
    expect(isSpamTrap({})).toBe(false);
  });

  it("exposes the roles and limits, nothing else", () => {
    const c = publicConfig();
    expect(c.roles.map((r) => r.id)).toEqual(RECRUITMENT.roles.map((r) => r.id));
    expect(Object.keys(c).sort()).toEqual(["cycle", "deadline", "emailDomains", "limits", "open", "roles"]);
  });
});
