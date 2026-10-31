import {
  TEACHING_CONFIG,
  PROJECT_CONFIG,
  type ReviewTrack,
  type CourseComponent,
} from "../../config/reviewQuestions";

export interface ReviewSubmissionInput {
  authorizedID: string;
  faculty_id: string;
  track: ReviewTrack;
  course_code?: string;
  semester?: string;
  project_term?: string;
  answers: Record<string, number>;
  tags_green?: string[];
  tags_red?: string[];
  context?: Record<string, unknown>;
  grade_bucket?: "high" | "mid" | "low";
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: {
    faculty_id: string;
    track: ReviewTrack;
    course_code: string | null;
    semester: string | null;
    project_term: string | null;
    answers: Record<string, number>;
    tags_green: string[];
    tags_red: string[];
    context: Record<string, unknown>;
    grade_bucket: string | null;
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Identifier-shaped values only (codes, not prose).
const COURSE_CODE_REGEX = /^[A-Z0-9][A-Z0-9()\- ]{1,24}$/;
const SEMESTER_REGEX = /^[A-Z0-9][A-Z0-9\-]{2,24}$/;

/** The ONLY top-level keys a submission may contain. Anything else is rejected. */
const ALLOWED_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "authorizedID",
  "faculty_id",
  "track",
  "course_code",
  "semester",
  "project_term",
  "answers",
  "tags_green",
  "tags_red",
  "context",
  "grade_bucket",
]);
const ALLOWED_CONTEXT_KEYS: ReadonlySet<string> = new Set([
  "component",
  "project_type",
  "team_size",
  "how_assigned",
  "outcomes",
]);

export function validateReviewSubmission(input: unknown): ValidationResult {
  if (!input || typeof input !== "object") {
    return { valid: false, error: "Invalid payload: must be a JSON object" };
  }

  const data = input as Record<string, unknown>;

  // 1. HARD RULE: Check for any illegal free-text fields
  const forbiddenFields = [
    "comment",
    "comments",
    "review",
    "review_text",
    "text",
    "feedback",
    "notes",
    "note",
    "lore_text",
    "other",
    "message",
    "desc",
    "description",
  ];

  for (const field of forbiddenFields) {
    if (field in data && data[field] !== undefined && data[field] !== null) {
      return {
        valid: false,
        error: `Free-text fields are strictly forbidden. Found illegal field: '${field}'`,
      };
    }
  }

  // 1b. Unknown fields are rejected outright (nothing unvalidated reaches storage)
  for (const key of Object.keys(data)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      return { valid: false, error: `Unknown field '${key}'` };
    }
  }
  if (data.context !== undefined && data.context !== null) {
    if (typeof data.context !== "object" || Array.isArray(data.context)) {
      return { valid: false, error: "context must be an object" };
    }
    for (const key of Object.keys(data.context as Record<string, unknown>)) {
      if (!ALLOWED_CONTEXT_KEYS.has(key)) {
        return { valid: false, error: `Unknown context field '${key}'` };
      }
    }
  }

  // 2. Validate track
  if (data.track !== "teaching" && data.track !== "project") {
    return {
      valid: false,
      error: "Invalid track: must be either 'teaching' or 'project'",
    };
  }
  const track = data.track as ReviewTrack;
  const config = track === "teaching" ? TEACHING_CONFIG : PROJECT_CONFIG;

  // 3. Validate faculty_id
  if (typeof data.faculty_id !== "string" || !UUID_REGEX.test(data.faculty_id)) {
    return {
      valid: false,
      error: "Invalid faculty_id: must be a valid UUID",
    };
  }
  const faculty_id = data.faculty_id;

  // 4. Validate context fields based on track
  let course_code: string | null = null;
  let semester: string | null = null;
  let project_term: string | null = null;

  if (track === "teaching") {
    if (typeof data.course_code !== "string" || !data.course_code.trim()) {
      return { valid: false, error: "course_code is required for teaching reviews" };
    }
    if (typeof data.semester !== "string" || !data.semester.trim()) {
      return { valid: false, error: "semester is required for teaching reviews" };
    }
    course_code = data.course_code.trim().toUpperCase();
    semester = data.semester.trim().toUpperCase();
    if (!COURSE_CODE_REGEX.test(course_code)) {
      return { valid: false, error: "Invalid course_code format" };
    }
    if (!SEMESTER_REGEX.test(semester)) {
      return { valid: false, error: "Invalid semester format" };
    }
  } else {
    if (data.project_term !== undefined && data.project_term !== null && data.project_term !== "") {
      // Shape is "<SEMESTER> <approved project type>" and nothing else, so it
      // cannot carry free text.
      const rawTerm = typeof data.project_term === "string" ? data.project_term.trim() : "";
      const projectTypes = PROJECT_CONFIG.contextFields.projectTypes ?? [];
      const matchedType = projectTypes.find((t) => rawTerm.endsWith(` ${t}`));
      const prefix = matchedType ? rawTerm.slice(0, rawTerm.length - matchedType.length - 1).trim() : "";
      if (!matchedType || !SEMESTER_REGEX.test(prefix.toUpperCase())) {
        return {
          valid: false,
          error: "Invalid project_term: must be '<semester> <approved project type>'",
        };
      }
      project_term = `${prefix.toUpperCase()} ${matchedType}`;
    }
  }

  // 5. Validate answers
  if (!data.answers || typeof data.answers !== "object" || Array.isArray(data.answers)) {
    return { valid: false, error: "answers must be an object of question ratings" };
  }

  const rawAnswers = data.answers as Record<string, unknown>;
  const sanitizedAnswers: Record<string, number> = {};

  const qualityMap = new Map(config.qualityQuestions.map((q) => [q.id, q]));
  const styleMap = new Map(config.styleQuestions.map((s) => [s.id, s]));

  const component = (data.context && typeof data.context === "object" && (data.context as Record<string, unknown>).component) as CourseComponent | undefined;

  for (const [key, value] of Object.entries(rawAnswers)) {
    // Check if key is a known question
    const qConfig = qualityMap.get(key);
    const sConfig = styleMap.get(key);

    if (!qConfig && !sConfig) {
      return {
        valid: false,
        error: `Unrecognized question id '${key}' for track '${track}'`,
      };
    }

    // Check if conditional question is allowed
    if (qConfig?.conditional) {
      if (qConfig.conditional.field === "component") {
        if (!component || !qConfig.conditional.matches.includes(component)) {
          return {
            valid: false,
            error: `Question '${key}' is only applicable for components: ${qConfig.conditional.matches.join(", ")}`,
          };
        }
      }
    }

    // Validate 1 to 5 integer
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
      return {
        valid: false,
        error: `Invalid rating for '${key}': must be an integer between 1 and 5`,
      };
    }

    sanitizedAnswers[key] = value;
  }

  // Ensure all required quality questions are answered
  for (const q of config.qualityQuestions) {
    if (q.allowNA && sanitizedAnswers[q.id] === undefined) {
      // Optional N/A allowed
      continue;
    }
    if (q.conditional) {
      if (component && q.conditional.matches.includes(component)) {
        if (sanitizedAnswers[q.id] === undefined) {
          return { valid: false, error: `Missing required conditional question '${q.id}'` };
        }
      }
    } else if (sanitizedAnswers[q.id] === undefined) {
      return { valid: false, error: `Missing required question '${q.id}'` };
    }
  }

  // 6. Validate tags (maximum of 3 green or 3 red tags, and all tags must be pre-approved)
  const tags_green: string[] = [];
  if (Array.isArray(data.tags_green)) {
    if (data.tags_green.length > 3) {
      return {
        valid: false,
        error: "Too many green tags: maximum allowed is 3",
      };
    }
    for (const tag of data.tags_green) {
      if (typeof tag !== "string" || !config.tags.green.includes(tag)) {
        return {
          valid: false,
          error: `Invalid green tag '${tag}'. Must be selected from pre-approved options.`,
        };
      }
      tags_green.push(tag);
    }
  }

  const tags_red: string[] = [];
  if (Array.isArray(data.tags_red)) {
    if (data.tags_red.length > 3) {
      return {
        valid: false,
        error: "Too many red tags: maximum allowed is 3",
      };
    }
    for (const tag of data.tags_red) {
      if (typeof tag !== "string" || !config.tags.red.includes(tag)) {
        return {
          valid: false,
          error: `Invalid red tag '${tag}'. Must be selected from pre-approved options.`,
        };
      }
      tags_red.push(tag);
    }
  }

  // 7. Validate context and grade_bucket
  let grade_bucket: string | null = null;
  if (data.grade_bucket === "high" || data.grade_bucket === "mid" || data.grade_bucket === "low") {
    grade_bucket = data.grade_bucket;
  }

  const sanitizedContext: Record<string, unknown> = {};
  if (data.context && typeof data.context === "object" && !Array.isArray(data.context)) {
    const rawContext = data.context as Record<string, unknown>;
    // Allow only pre-defined context keys
    if (rawContext.component && ["Theory", "Lab", "Embedded"].includes(String(rawContext.component))) {
      sanitizedContext.component = rawContext.component;
    }
    // Project context values must come from the approved option lists; a
    // value outside them is an error, never stored.
    const ctxConfig = PROJECT_CONFIG.contextFields;
    const checkOption = (
      key: "project_type" | "team_size" | "how_assigned",
      allowed: readonly string[] | undefined
    ): string | null => {
      const v = rawContext[key];
      if (v === undefined || v === null || v === "") return null;
      if (typeof v !== "string" || !(allowed ?? []).includes(v)) {
        return `Invalid context.${key}: must be one of the approved options`;
      }
      sanitizedContext[key] = v;
      return null;
    };
    const ctxError =
      checkOption("project_type", ctxConfig.projectTypes) ||
      checkOption("team_size", ctxConfig.teamSizes) ||
      checkOption("how_assigned", ctxConfig.howAssigned);
    if (ctxError) return { valid: false, error: ctxError };

    if (rawContext.outcomes !== undefined && rawContext.outcomes !== null) {
      const allowedOutcomes = ctxConfig.outcomes ?? [];
      if (
        !Array.isArray(rawContext.outcomes) ||
        rawContext.outcomes.length > allowedOutcomes.length ||
        rawContext.outcomes.some((o) => typeof o !== "string" || !allowedOutcomes.includes(o))
      ) {
        return { valid: false, error: "Invalid context.outcomes: must be approved options" };
      }
      sanitizedContext.outcomes = Array.from(new Set(rawContext.outcomes as string[]));
    }
  }

  return {
    valid: true,
    sanitized: {
      faculty_id,
      track,
      course_code,
      semester,
      project_term,
      answers: sanitizedAnswers,
      tags_green,
      tags_red,
      context: sanitizedContext,
      grade_bucket,
    },
  };
}
