import { getDbPool } from "@/lib/db";
import { getStudentReviewHash } from "./reviewAuth";

export function normalizeFacultyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, "")
    .replace(/[^a-z0-9]/g, "");
}

export function parseFacultyDetails(details: string): {
  name: string;
  school: string | null;
  employeeId: string | null;
} {
  const parts = details.split("-").map((s) => s.trim());
  const name = parts[0] || details.trim();
  let school: string | null = null;
  let employeeId: string | null = null;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (/^\d{3,6}$/.test(part)) {
      employeeId = part;
    } else if (part) {
      school = part.toUpperCase();
    }
  }

  return { name, school, employeeId };
}

export interface TimetableCourseItem {
  courseCode?: string;
  code?: string;
  course?: string;
  facultyDetails?: string;
  faculty?: string;
  employeeId?: string;
  component?: string;
  semester?: string;
  semesterId?: string;
  category?: string;
}

export async function recordEnrollmentSnapshot(
  authorizedID: string,
  courses: TimetableCourseItem[],
  defaultSemester: string = "FALL2026-27"
): Promise<{ recordedCount: number; unmatchedCount: number }> {
  if (!authorizedID || !Array.isArray(courses) || courses.length === 0) {
    return { recordedCount: 0, unmatchedCount: 0 };
  }

  const studentHash = getStudentReviewHash(authorizedID);
  const pool = getDbPool();

  let recordedCount = 0;
  let unmatchedCount = 0;

  for (const item of courses) {
    let rawCourseCode = String(item.courseCode || item.code || "").trim().toUpperCase();
    // Normalize e.g. "BCSE101E(T)" -> "BCSE101E" or keep
    const cleanCourseCode = rawCourseCode.replace(/\([LTJ]\)$/i, "").trim() || rawCourseCode;
    const semester = String(item.semester || item.semesterId || defaultSemester).trim().toUpperCase();
    const rawFaculty = String(item.facultyDetails || item.faculty || "").trim();
    let employeeId = item.employeeId ? String(item.employeeId).trim() : null;

    let component = item.component ? String(item.component).trim() : "Theory";
    if (rawCourseCode.endsWith("(L)") || (item.category && item.category.toUpperCase().includes("ELA"))) {
      component = "Lab";
    }

    if (!cleanCourseCode || (!rawFaculty && !employeeId)) {
      continue;
    }

    const { name: parsedName, school: parsedSchool, employeeId: parsedEmployeeId } = parseFacultyDetails(rawFaculty);
    if (!employeeId && parsedEmployeeId) {
      employeeId = parsedEmployeeId;
    }
    const nameNorm = normalizeFacultyName(parsedName);

    // 1. Attempt to match with existing faculty record
    let facultyId: string | null = null;

    if (employeeId) {
      const empRes = await pool.query(
        "SELECT id FROM faculty WHERE employee_id = $1 LIMIT 1",
        [employeeId]
      );
      if (empRes.rows.length > 0) {
        facultyId = empRes.rows[0].id;
      }
    }

    if (!facultyId && nameNorm) {
      if (parsedSchool) {
        const nameSchoolRes = await pool.query(
          "SELECT id FROM faculty WHERE name_norm = $1 AND (school IS NULL OR school = $2) LIMIT 1",
          [nameNorm, parsedSchool]
        );
        if (nameSchoolRes.rows.length > 0) {
          facultyId = nameSchoolRes.rows[0].id;
        }
      }

      if (!facultyId) {
        const nameRes = await pool.query(
          "SELECT id FROM faculty WHERE name_norm = $1 LIMIT 1",
          [nameNorm]
        );
        if (nameRes.rows.length > 0) {
          facultyId = nameRes.rows[0].id;
        }
      }

      if (!facultyId && parsedName.length > 4) {
        const fuzzyRes = await pool.query(
          "SELECT id FROM faculty WHERE name ILIKE $1 LIMIT 1",
          [`%${parsedName}%`]
        );
        if (fuzzyRes.rows.length > 0) {
          facultyId = fuzzyRes.rows[0].id;
        }
      }

      // Initial token / expanded name matching (e.g. SANDOSH SAKKARAPANI -> Dr. Sandosh S)
      if (!facultyId && parsedName.length >= 3) {
        const firstToken = parsedName.trim().split(/\s+/)[0]?.toLowerCase();
        if (firstToken && firstToken.length >= 3) {
          const tokenRes = await pool.query(
            "SELECT id FROM faculty WHERE (name_norm LIKE $1 OR name ILIKE $2) AND (school IS NULL OR school ILIKE $3) LIMIT 1",
            [`${firstToken}%`, `%${firstToken}%`, `%${parsedSchool || ""}%`]
          );
          if (tokenRes.rows.length > 0) {
            facultyId = tokenRes.rows[0].id;
          }
        }
      }

      // Auto-provision unlisted official faculty from verified timetable so no student teacher is ever dropped
      if (!facultyId && parsedName.trim()) {
        const formattedName = parsedName
          .trim()
          .toLowerCase()
          .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
        const provRes = await pool.query(
          `INSERT INTO faculty (name, name_norm, school, designation, status)
           VALUES ($1, $2, $3, 'Faculty Member', 'official')
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [formattedName, nameNorm, parsedSchool || "Faculty"]
        );
        if (provRes.rows.length > 0) {
          facultyId = provRes.rows[0].id;
        } else {
          const existing = await pool.query(
            "SELECT id FROM faculty WHERE name_norm = $1 LIMIT 1",
            [nameNorm]
          );
          if (existing.rows.length > 0) facultyId = existing.rows[0].id;
        }
      }
    }

    // 2. If matched / provisioned: insert into enrollments
    if (facultyId) {
      const insertSql = `
        INSERT INTO enrollments (student_hash, semester, course_code, component, faculty_id, source)
        VALUES ($1, $2, $3, $4, $5, 'vtop_sync')
        ON CONFLICT (student_hash, semester, course_code, faculty_id) 
        DO UPDATE SET component = CASE 
          WHEN enrollments.component != EXCLUDED.component THEN 'Theory & Lab' 
          ELSE enrollments.component 
        END;
      `;
      await pool.query(insertSql, [studentHash, semester, cleanCourseCode, component, facultyId]);
      recordedCount++;
    } else {
      // 3. If unmatched: log to unmatched_faculty
      const unmatchedSql = `
        INSERT INTO unmatched_faculty (raw_name, raw_school, semester, seen_count, status)
        VALUES ($1, $2, $3, 1, 'open')
        ON CONFLICT DO NOTHING;
      `;
      await pool.query(unmatchedSql, [rawFaculty || parsedName, parsedSchool, semester]);
      unmatchedCount++;
    }
  }

  return { recordedCount, unmatchedCount };
}
