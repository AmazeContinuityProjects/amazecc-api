import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import { parseCurriculum, parseCurriculumCategoryView, extractPageCsrf } from "@/lib/parsers/curriculum";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });
    }

    const client = VTOPClient();
    const baseHeaders = {
      Cookie: cookieHeader,
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://vtopcc.vit.ac.in/vtop/academics/common/Curriculum",
    };

    const resp = await client.post(
      "/vtop/academics/common/Curriculum",
      new URLSearchParams({
        verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
      }).toString(),
      { headers: baseHeaders }
    );

    const data = parseCurriculum(resp.data);

    const pageCsrf = extractPageCsrf(resp.data) || csrf;

    const detailPromises = data.categories.map(async (cat) => {
      try {
        const params = new URLSearchParams({
          _csrf: pageCsrf,
          categoryId: cat.code,
          authorizedID,
          x: new Date().toUTCString(),
        }).toString();

        const detailResp = await client.post(
          "/vtop/academics/common/curriculumCategoryView",
          params,
          { headers: baseHeaders }
        );

        const baskets = parseCurriculumCategoryView(detailResp.data);
        return { code: cat.code, baskets };
      } catch {
        return { code: cat.code, baskets: [] };
      }
    });

    const detailResults = await Promise.all(detailPromises);

    for (const detail of detailResults) {
      const entry = data.details.find(d => d.code === detail.code);
      if (entry) entry.baskets = detail.baskets;
    }

    return NextResponse.json({ success: true, pageCsrf, ...data });
  } catch (err: any) {
    console.error("curriculum error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
