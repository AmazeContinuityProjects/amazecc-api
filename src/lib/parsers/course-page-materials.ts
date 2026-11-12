import * as cheerio from "cheerio";

export interface CoursePageMaterialRef {
  /** Button label, e.g. "Reference Material I" / "Reference Material II". */
  label: string;
  materialId: string;
  /** VTOP's dd-mm-yyyy date string, passed back verbatim to /vtop/downloadPdf. */
  materialDate: string;
  classId: string;
  semSubId: string;
}

export interface CoursePagePlanRow {
  slNo: string;
  date: string;
  slot: string;
  topic: string;
  materials: CoursePageMaterialRef[];
}

export interface ParsedCoursePageMaterials {
  semesterSubId: string;
  classId: string;
  courseId: string;
  courseType: string;
  /** Params for the courseSyllabusDownload endpoint, from the syllabus button's data attributes. */
  syllabus: { courseId: string; courseType: string } | null;
  /** Lecture-plan rows; only rows carrying at least one material are interesting to callers. */
  rows: CoursePagePlanRow[];
  /** Total number of downloadable files across all rows. */
  uploadedCount: number;
}

const collapse = (s?: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

/**
 * Extracts the teacher-uploaded reference material from the
 * `processViewStudentCourseDetail` ("Course Page View" detail) fragment.
 *
 * The detail page renders the lecture plan as a table with
 * Sl.No. / Date / Day Order-Slot / Topic / Reference Material columns. Each
 * material is a `getDownloadSemPdf` button whose data attributes carry the
 * exact payload `/vtop/downloadPdf` needs (semSubId, classId, materialId,
 * materialDate) — the generic table parser drops those, so a dedicated
 * parser is required.
 */
export function parseCoursePageMaterials(html: string): ParsedCoursePageMaterials {
  const empty: ParsedCoursePageMaterials = {
    semesterSubId: "",
    classId: "",
    courseId: "",
    courseType: "",
    syllabus: null,
    rows: [],
    uploadedCount: 0,
  };
  if (!html || typeof html !== "string") return empty;

  const $ = cheerio.load(html);
  const hidden = (name: string) => collapse($(`input[type=hidden][name="${name}"]`).first().attr("value"));

  const semesterSubId = hidden("semesterSubId") || hidden("semSubId");
  const classId = hidden("classId");
  const courseId = hidden("courseId");
  const courseType = hidden("courseType");

  const syllabusBtn = $("button#courseSyllabusDownload, button[name=courseSyllabusDownload]").first();
  const syllabus =
    syllabusBtn.length > 0
      ? {
          courseId: collapse(syllabusBtn.attr("data-courseid")) || courseId,
          courseType: collapse(syllabusBtn.attr("data-coursetype")) || courseType,
        }
      : null;

  const rows: CoursePagePlanRow[] = [];

  $("table").each((_, table) => {
    const $table = $(table);
    // The lecture-plan table is the one whose header mentions both Sl.No. and Reference Material.
    const headerText = collapse($table.find("thead tr").first().text()) || collapse($table.find("tr").first().text());
    if (!/sl\.?\s*no/i.test(headerText) || !/reference material/i.test(headerText)) return;

    $table.find("tbody tr").each((_, row) => {
      const $row = $(row);
      const cells = $row.find("td").toArray();
      if (cells.length < 4) return;

      const materials: CoursePageMaterialRef[] = [];
      $row.find('button[name="getDownloadSemPdf"]').each((_, btn) => {
        const $btn = $(btn);
        const materialId = collapse($btn.attr("data-matid"));
        const materialDate = collapse($btn.attr("data-mdate"));
        if (!materialId || !materialDate) return;
        materials.push({
          label: collapse($btn.text()) || "Reference Material",
          materialId,
          materialDate,
          classId: collapse($btn.attr("data-clsid")) || classId,
          semSubId: collapse($btn.attr("data-semid")) || semesterSubId,
        });
      });

      rows.push({
        slNo: collapse($(cells[0]).text()),
        date: collapse($(cells[1]).text()),
        slot: collapse($(cells[2]).text()),
        topic: collapse($(cells[3]).text()),
        materials,
      });
    });
  });

  const uploadedCount = rows.reduce((n, r) => n + r.materials.length, 0);
  return { semesterSubId, classId, courseId, courseType, syllabus, rows, uploadedCount };
}
