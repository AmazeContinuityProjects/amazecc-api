import type { TimetableCourseItem } from "./recordEnrollments";

/** Upper bound on courses accepted in a single enrollment snapshot. */
export const MAX_SNAPSHOT_COURSES = 60;

const COURSE_CODE = /^[A-Z0-9][A-Z0-9()\- ]{1,24}$/i;
const SEMESTER = /^[A-Z0-9][A-Z0-9\- ]{2,24}$/i;
// Letters (any script), digits and a small set of punctuation used in "NAME - SCHOOL - ID".
const FACULTY_TEXT = /^[\p{L}\p{N} .,'()\-_/&]{2,160}$/u;
const EMPLOYEE_ID = /^\d{3,8}$/;
const COMPONENT = /^[A-Za-z &]{1,24}$/;

function str(v: unknown): string | null {
  return typeof v === "string" ? v.trim() : null;
}

/**
 * Whitelists the client-supplied timetable before it can touch the database
 * (faculty auto-provisioning writes client text into the public catalog).
 * Invalid items are dropped; the list is capped at MAX_SNAPSHOT_COURSES.
 */
export function sanitizeTimetableCourses(input: unknown): TimetableCourseItem[] {
  if (!Array.isArray(input)) return [];
  const out: TimetableCourseItem[] = [];

  for (const raw of input.slice(0, MAX_SNAPSHOT_COURSES)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;

    const code = str(item.courseCode) ?? str(item.code);
    const facultyText = str(item.facultyDetails) ?? str(item.faculty);
    const employeeId = item.employeeId === undefined || item.employeeId === null ? null : String(item.employeeId).trim();
    const semester = str(item.semester) ?? str(item.semesterId);
    const component = str(item.component);
    const category = str(item.category);

    if (!code || !COURSE_CODE.test(code)) continue;
    if (facultyText !== null && facultyText !== "" && !FACULTY_TEXT.test(facultyText)) continue;
    if (employeeId !== null && !EMPLOYEE_ID.test(employeeId)) continue;
    if (!facultyText && !employeeId) continue;

    // Non-critical descriptors degrade to "unset" instead of dropping the course.
    out.push({
      courseCode: code,
      facultyDetails: facultyText || undefined,
      employeeId: employeeId || undefined,
      semester: semester && SEMESTER.test(semester) ? semester : undefined,
      component: component && COMPONENT.test(component) ? component : undefined,
      category: category && COMPONENT.test(category) ? category : undefined,
    });
  }
  return out;
}

export function sanitizeSemester(input: unknown, fallback: string): string {
  const s = str(input);
  return s && SEMESTER.test(s) ? s.toUpperCase() : fallback;
}
