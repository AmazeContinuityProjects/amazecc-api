import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import { parseCoursePage } from "@/lib/parsers/course-page";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf, formData } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });
    }

    const client = VTOPClient();
    const baseHeaders = {
      Cookie: cookieHeader,
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://vtopcc.vit.ac.in/vtop/academics/common/StudentCoursePage",
    };

    const pageResp = await client.post(
      "/vtop/academics/common/StudentCoursePage",
      new URLSearchParams({
        verifyMenu: "true",
        authorizedID,
        _csrf: csrf,
        nocache: Date.now().toString(),
      }).toString(),
      { headers: baseHeaders }
    );

    if (formData) {
      const { semesterSubId, courseCode, slotId, faculty } = formData;
      const ts = Date.now().toString();

      let ajaxUrl: string;
      let ajaxParams: Record<string, string>;

      if (formData.viewDetail) {
        ajaxUrl = "/vtop/processViewStudentCourseDetail";
        ajaxParams = {
          _csrf: csrf,
          semSubId: formData.semSubId,
          erpId: formData.erpId,
          classId: formData.classId,
          authorizedID,
          x: ts,
        };
      } else if (semesterSubId && !courseCode) {
        ajaxUrl = "/vtop/getCourseForCoursePage";
        ajaxParams = {
          _csrf: csrf,
          paramReturnId: "getCourseForCoursePage",
          semSubId: semesterSubId,
          authorizedID,
          x: ts,
        };
      } else if (courseCode && !slotId) {
        ajaxUrl = "/vtop/getSlotIdForCoursePage";
        ajaxParams = {
          _csrf: csrf,
          classId: courseCode,
          praType: "source",
          paramReturnId: "getSlotIdForCoursePage",
          semSubId: semesterSubId,
          authorizedID,
          x: ts,
        };
      } else if (slotId && !faculty) {
        ajaxUrl = "/vtop/getFacultyForCoursePage";
        ajaxParams = {
          _csrf: csrf,
          classId: courseCode,
          slotId,
          praType: "source",
          paramReturnId: "getFacultyForCoursePage",
          semSubId: semesterSubId,
          authorizedID,
          x: ts,
        };
      } else if (faculty) {
        ajaxUrl = "/vtop/getCourseDetailsForCoursePage";
        ajaxParams = {
          _csrf: csrf,
          classId: courseCode,
          slotId,
          faculty,
          praType: "source",
          paramReturnId: "getCourseDetailsForCoursePage",
          semSubId: semesterSubId,
          authorizedID,
          x: ts,
        };
      } else {
        return NextResponse.json({ error: "Invalid formData" }, { status: 400 });
      }

      const dataResp = await client.post(
        ajaxUrl,
        new URLSearchParams(ajaxParams).toString(),
        { headers: baseHeaders }
      );

      const parsed = parseVtopHtml(dataResp.data);
      return NextResponse.json({ success: true, results: parsed });
    }

    const data = parseCoursePage(pageResp.data);
    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    console.error("course-page error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
