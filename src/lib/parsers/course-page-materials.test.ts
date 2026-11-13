import { describe, expect, it } from "vitest";
import { parseCoursePageMaterials } from "./course-page-materials";

const DETAIL_HTML = `
<div id="main-section">
  <form name="CoursePageLectureDetail" id="CoursePageLectureDetail">
    <input type="hidden" name="_csrf" value="test-csrf" />
    <input type="hidden" name="authorizedID" id="authorizedID" value="TESTUSER" />
    <input type="hidden" name="classId" id="classId" value="CH2026270100036" />
    <input type="hidden" name="semesterSubId" id="semesterSubId" value="CH20262701" />
    <input type="hidden" name="courseId" id="courseId" value="CH_TEST101_00100" />
    <input type="hidden" name="courseType" id="courseType" value="SS" />
    <table class="table">
      <tr><td><b>Class Group</b></td><td><b>Course Code</b></td></tr>
      <tr><td>General (Semester)</td><td>TEST101</td></tr>
    </table>
    <table class="table">
      <thead>
        <tr><td><b>Sl.No.</b></td><td><b>Date</b></td><td><b>Day Order/ Slot</b></td><td colspan="1"><b>Topic</b></td><td><b>Reference Material</b></td></tr>
      </thead>
      <tbody>
        <tr>
          <td><span>1</span></td>
          <td><span>06-07-2026</span></td>
          <td><span>MON / TB1</span></td>
          <td><span>Square roots &amp; cube roots</span></td>
          <td>
            <p><button type="button" name="getDownloadSemPdf" class="btn"
              data-semid="CH20262701" data-clsid="CH2026270100036" data-matid="19" data-mdate="06-07-2026">
              <span>Reference Material I</span>&nbsp;</button></p>
          </td>
        </tr>
        <tr>
          <td><span>2</span></td>
          <td><span>07-07-2026</span></td>
          <td><span>TUE / B1</span></td>
          <td><span>Mixtures and Alligations</span></td>
          <td>
            <p><button type="button" name="getDownloadSemPdf" class="btn"
              data-semid="CH20262701" data-clsid="CH2026270100036" data-matid="19" data-mdate="07-07-2026">
              <span>Reference Material I</span>&nbsp;</button></p>
            <p><button type="button" name="getDownloadSemPdf" class="btn"
              data-semid="CH20262701" data-clsid="CH2026270100036" data-matid="20" data-mdate="07-07-2026">
              <span>Reference Material II</span>&nbsp;</button></p>
          </td>
        </tr>
        <tr>
          <td><span>3</span></td>
          <td><span>09-07-2026</span></td>
          <td><span>THU / B1</span></td>
          <td><span>No files uploaded for this session</span></td>
          <td></td>
        </tr>
      </tbody>
    </table>
    <button type="button" id="courseSyllabusDownload" name="courseSyllabusDownload"
      data-courseid="CH_TEST101_00100" data-coursetype="SS"><span>Download</span></button>
  </form>
</div>`;

describe("parseCoursePageMaterials", () => {
  it("extracts hidden fields, syllabus params and material rows", () => {
    const out = parseCoursePageMaterials(DETAIL_HTML);
    expect(out.semesterSubId).toBe("CH20262701");
    expect(out.classId).toBe("CH2026270100036");
    expect(out.courseId).toBe("CH_TEST101_00100");
    expect(out.courseType).toBe("SS");
    expect(out.syllabus).toEqual({ courseId: "CH_TEST101_00100", courseType: "SS" });
    expect(out.rows).toHaveLength(3);
    expect(out.rows[0]).toMatchObject({
      slNo: "1",
      date: "06-07-2026",
      slot: "MON / TB1",
      topic: "Square roots & cube roots",
    });
    expect(out.rows[0].materials).toEqual([
      {
        label: "Reference Material I",
        materialId: "19",
        materialDate: "06-07-2026",
        classId: "CH2026270100036",
        semSubId: "CH20262701",
      },
    ]);
    expect(out.rows[1].materials).toHaveLength(2);
    expect(out.rows[1].materials[1].label).toBe("Reference Material II");
    expect(out.rows[2].materials).toHaveLength(0);
    expect(out.uploadedCount).toBe(3);
  });

  it("returns an empty structure for non-detail HTML", () => {
    const out = parseCoursePageMaterials("<html><body>session expired</body></html>");
    expect(out.rows).toEqual([]);
    expect(out.uploadedCount).toBe(0);
    expect(out.syllabus).toBeNull();
  });

  it("handles garbage input without throwing", () => {
    expect(parseCoursePageMaterials("").rows).toEqual([]);
    // @ts-expect-error runtime robustness for non-string input
    expect(parseCoursePageMaterials(undefined).rows).toEqual([]);
  });
});
