/**
 * AmazeCC community recruitment: configuration and validation.
 *
 * The roles live here, on the server, and the join page reads them from
 * `GET /api/recruitment`. Changing what we recruit for is an edit to
 * `RECRUITMENT` below; the website needs no redeploy.
 *
 * Everything an applicant sends is validated here before it reaches the
 * database. Pure functions only, so the rules are unit-tested.
 */

export type RecruitmentRole = {
  id: string;
  label: string;
  description: string;
};

export const RECRUITMENT = {
  /** Applications are accepted only while this is true. */
  open: true,
  /** Groups applications; one application per email per cycle. */
  cycle: "2026-27",
  /** Shown on the page. ISO date, or null for "rolling". */
  deadline: null as string | null,
  roles: [
    {
      id: "developer",
      label: "Developer",
      description: "Web (Next.js, TypeScript), backend and scraping, Android (Kotlin), tooling.",
    },
    {
      id: "design",
      label: "Design / UI-UX",
      description: "Product and interface design, the AmazeUI design system, Figma.",
    },
    {
      id: "non-technical",
      label: "Non-technical",
      description: "Marketing, content, social media, events and outreach.",
    },
    {
      id: "other",
      label: "Other",
      description: "Something else you'd bring, like cybersecurity. Tell us what.",
    },
  ] satisfies RecruitmentRole[],
  /** Only VIT student addresses: applicants are VIT students. */
  emailDomains: ["vitstudent.ac.in"],
};

export const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  maxRoles: 3,
  otherRoleMax: 80,
  whyMin: 50,
  whyMax: 2000,
  experienceMax: 2000,
  maxLinks: 5,
  linkMax: 200,
  hoursMin: 1,
  hoursMax: 40,
};

export const APPLICATION_STATUSES = ["new", "shortlisted", "accepted", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type Application = {
  name: string;
  email: string;
  regNo: string;
  year: number;
  roles: string[];
  otherRole: string | null;
  why: string;
  experience: string | null;
  links: string[];
  hoursPerWeek: number;
};

export type ValidationResult =
  | { ok: true; value: Application }
  | { ok: false; errors: Record<string, string> };

/** Trim and collapse runs of spaces and tabs (line breaks are kept for long answers). */
function clean(value: unknown, keepNewlines = false): string {
  if (typeof value !== "string") return "";
  const s = value.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ");
  return (keepNewlines ? s.replace(/\n{3,}/g, "\n\n") : s.replace(/\n+/g, " ")).trim();
}

const REG_NO_RE = /^\d{2}[A-Z]{2,5}\d{3,5}$/;
const EMAIL_RE = /^[^\s@]+@([^\s@]+)$/;

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === "https:" || u.protocol === "http:") && Boolean(u.hostname.includes("."));
  } catch {
    return false;
  }
}

/**
 * True when the hidden "website" field was filled in. People never see it;
 * form-filling bots do. Such submissions are accepted silently and discarded.
 */
export function isSpamTrap(body: Record<string, unknown>): boolean {
  return typeof body.website === "string" && body.website.trim() !== "";
}

export function validateApplication(body: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};
  const roleIds = new Set(RECRUITMENT.roles.map((r) => r.id));

  const name = clean(body.name);
  if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) {
    errors.name = `Enter your name (${LIMITS.nameMin}-${LIMITS.nameMax} characters).`;
  }

  const email = clean(body.email).toLowerCase();
  const domain = EMAIL_RE.exec(email)?.[1];
  if (!domain || !RECRUITMENT.emailDomains.includes(domain)) {
    errors.email = `Use your VIT student email (@${RECRUITMENT.emailDomains[0]}).`;
  }

  const regNo = clean(body.regNo).toUpperCase().replace(/\s+/g, "");
  if (!REG_NO_RE.test(regNo)) {
    errors.regNo = "Enter your registration number, e.g. 25BCE1234.";
  }

  const year = Number(body.year);
  if (!Number.isInteger(year) || year < 1 || year > 5) {
    errors.year = "Pick your year of study.";
  }

  const rawRoles = Array.isArray(body.roles) ? body.roles : [];
  const roles = [...new Set(rawRoles.filter((r): r is string => typeof r === "string"))];
  if (!roles.length) errors.roles = "Pick at least one role.";
  else if (roles.length > LIMITS.maxRoles) errors.roles = `Pick up to ${LIMITS.maxRoles} roles.`;
  else if (roles.some((r) => !roleIds.has(r))) errors.roles = "Pick roles from the list.";

  let otherRole: string | null = null;
  if (roles.includes("other")) {
    otherRole = clean(body.otherRole);
    if (!otherRole) errors.otherRole = "Tell us what you'd like to do.";
    else if (otherRole.length > LIMITS.otherRoleMax) errors.otherRole = `Keep it under ${LIMITS.otherRoleMax} characters.`;
  }

  const why = clean(body.why, true);
  if (why.length < LIMITS.whyMin) errors.why = `Tell us a bit more (at least ${LIMITS.whyMin} characters).`;
  else if (why.length > LIMITS.whyMax) errors.why = `Keep it under ${LIMITS.whyMax} characters.`;

  const experienceText = clean(body.experience, true);
  if (experienceText.length > LIMITS.experienceMax) {
    errors.experience = `Keep it under ${LIMITS.experienceMax} characters.`;
  }

  const rawLinks = Array.isArray(body.links) ? body.links : [];
  const links = [...new Set(rawLinks.map((l) => clean(l)).filter(Boolean))];
  if (links.length > LIMITS.maxLinks) errors.links = `Add up to ${LIMITS.maxLinks} links.`;
  else if (links.some((l) => l.length > LIMITS.linkMax || !isHttpUrl(l))) {
    errors.links = "Links must be full web addresses, starting with https://.";
  }

  const hoursPerWeek = Number(body.hoursPerWeek);
  if (!Number.isInteger(hoursPerWeek) || hoursPerWeek < LIMITS.hoursMin || hoursPerWeek > LIMITS.hoursMax) {
    errors.hoursPerWeek = `Hours per week must be between ${LIMITS.hoursMin} and ${LIMITS.hoursMax}.`;
  }

  if (body.consent !== true) {
    errors.consent = "Please agree so we can store and review your application.";
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      email,
      regNo,
      year,
      roles,
      otherRole,
      why,
      experience: experienceText || null,
      links,
      hoursPerWeek,
    },
  };
}

/** What the join page needs to render the form. Nothing sensitive. */
export function publicConfig() {
  return {
    open: RECRUITMENT.open,
    cycle: RECRUITMENT.cycle,
    deadline: RECRUITMENT.deadline,
    roles: RECRUITMENT.roles,
    emailDomains: RECRUITMENT.emailDomains,
    limits: LIMITS,
  };
}
