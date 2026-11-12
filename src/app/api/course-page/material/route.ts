import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import { publicErrorMessage } from "@/lib/publicError";

const REFERER = "https://vtopcc.vit.ac.in/vtop/processViewStudentCourseDetail";

type DownloadAction = "reference-material" | "syllabus" | "course-plan" | "all-materials" | "general-materials";

function cookieHeaderOf(cookies: unknown): string {
  return Array.isArray(cookies) ? cookies.join("; ") : String(cookies ?? "");
}

function actionConfig(action: DownloadAction | string): { url: string; body: Record<string, string> } {
  switch (action) {
    case "reference-material":
      return {
        url: "/vtop/downloadPdf",
        body: {
          semSubId: "",
          classId: "",
          materialId: "",
          materialDate: "",
        },
      };
    case "syllabus":
      return { url: "/vtop/courseSyllabusDownload", body: { courseID: "", courseTYPE: "" } };
    case "course-plan":
      return {
        url: "/vtop/academics/common/CoursePlanExcelDownload",
        body: { semesterId: "", classId: "" },
      };
    case "all-materials":
      return {
        url: "/vtop/academics/common/allCourseMeterialDownload",
        body: { materialMode: "2", uploadView: "1", semesterSubId: "", classId: "" },
      };
    case "general-materials":
      return {
        url: "/vtop/academics/common/allCourseMeterialDownload",
        body: { materialMode: "1", uploadView: "1", semesterSubId: "", classId: "" },
      };
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}

function sanitizeFilename(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\\/:*?"<>|\r\n]+/g, "_").trim();
  return cleaned ? cleaned : null;
}

function filenameFromContentDisposition(cd: string | undefined | null): string | null {
  if (!cd) return null;
  const utf8Match = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd);
  if (utf8Match) {
    try {
      return sanitizeFilename(decodeURIComponent(utf8Match[1]));
    } catch {
      return sanitizeFilename(utf8Match[1]);
    }
  }
  const match = /filename\s*=\s*"?([^";]+)"?/i.exec(cd);
  return match ? sanitizeFilename(match[1]) : null;
}

/**
 * VTOP course-material download proxy.
 * Same VTOP authenticated session is used to fetch the binary, then the file
 * is returned to the browser with its original content-type/filename headers.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { cookies, authorizedID, csrf, action, ...params } = body as {
      cookies?: string | string[];
      authorizedID?: string;
      csrf?: string;
      action?: string;
      [key: string]: unknown;
    };

    const cookieHeader = cookieHeaderOf(cookies);
    if (!csrf || !authorizedID) {
      return NextResponse.json({ success: false, error: "Missing csrf or authorizedID" }, { status: 400 });
    }
    if (!action || typeof action !== "string") {
      return NextResponse.json({ success: false, error: "Missing action" }, { status: 400 });
    }

    const cfg = actionConfig(action);
    const merged: Record<string, string> = { ...cfg.body };

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      merged[key] = String(value);
    }

    // Fill VTOP-specific field names that differ from the UI-facing aliases.
    merged._csrf = String(csrf);
    merged.authorizedID = String(authorizedID);
    merged.semSubId = String(params.semSubId ?? params.semesterSubId ?? params.semesterId ?? params.semSubId ?? "");
    if (params.courseID !== undefined) merged.courseID = String(params.courseID);
    if (params.courseTYPE !== undefined) merged.courseTYPE = String(params.courseTYPE);
    if (params.materialId !== undefined) merged.materialId = String(params.materialId);
    if (params.materialDate !== undefined) merged.materialDate = String(params.materialDate);
    if (params.classId !== undefined) merged.classId = String(params.classId);
    if (params.semesterId !== undefined) merged.semesterId = String(params.semesterId);
    if (params.semesterSubId !== undefined) merged.semesterSubId = String(params.semesterSubId);

    const client = VTOPClient();
    const vtopRes = await client.post(cfg.url, new URLSearchParams(merged).toString(), {
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: REFERER,
      },
      responseType: "arraybuffer",
      validateStatus: () => true,
    });

    if (vtopRes.status >= 400) {
      return NextResponse.json(
        { success: false, error: `VTOP download failed with status ${vtopRes.status}` },
        { status: vtopRes.status >= 500 ? 502 : vtopRes.status }
      );
    }

    const raw = vtopRes.data as Buffer | ArrayBuffer;
    const buffer = Buffer.isBuffer(raw)
      ? raw
      : Buffer.from(raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw);

    const safeFilename =
      sanitizeFilename(params.filename as string) ||
      filenameFromContentDisposition(String(vtopRes.headers?.["content-disposition"] ?? "")) ||
      `vtop-${action}`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": String(vtopRes.headers?.["content-type"] ?? "application/octet-stream"),
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: unknown) {
    console.error("course-page material download error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ success: false, error: publicErrorMessage(err) }, { status: 500 });
  }
}
