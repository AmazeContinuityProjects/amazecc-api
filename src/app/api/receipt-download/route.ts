import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import * as cheerio from "cheerio";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf, applno } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID || !applno) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }
    const client = VTOPClient();
    const resp = await client.post(
      "/vtop/p2p/getReceiptsApplno",
      new URLSearchParams({
        verifyMenu: "true", authorizedID, _csrf: csrf, applNo: applno, nocache: Date.now().toString(),
      }).toString(),
      {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
        },
        responseType: "arraybuffer",
      }
    );
    const html = Buffer.from(resp.data).toString("utf-8");
    const $ = cheerio.load(html);

    const receiptHtml = $("#receiptPrint").length
      ? $("#receiptPrint").html() || ""
      : $("section.content").html() || html;

    const styled = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${applno}</title>
  <style>
    body { font-family: 'Times New Roman', Times, serif; padding: 40px; max-width: 900px; margin: auto; color: #222; }
    table { border-collapse: collapse; margin: 20px 0; width: 100%; }
    td, th { padding: 6px 10px; border: 1px solid #ddd; text-align: left; font-size: 12px; font-family: 'Times New Roman', Times, serif; }
    .table { width: 100%; }
    .noborder td, .noborder th { border: none; }
    .box-title { font-size: 15px; font-weight: bold; text-decoration: underline; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-primary { color: #337ab7; }
    .col-md-1, .col-md-2, .col-md-4, .col-md-5, .col-md-8, .col-md-10, .col-md-offset-2 { width: 100%; }
    hr { border: none; border-top: 1px solid #ddd; margin: 15px 0; }
    .btn, button, script, iframe, .no-print, #btnFamilly, .navbar, .offcanvas, #sidePanel, #vtopHeader,
    .headerBackgroundColor, .btnBarColor, #b3endmarker, #b5wrapper, #b5endmarker, #expandedSideBar,
    .modal, #confirmBox, #popup, #messageBox, #myModalFooter, #accessDeniedModal, #chatbot-button, #chatbot-chat,
    [id*="chatbot"], script, noscript { display: none !important; }
    .box { background: white; border: 1px solid #ddd; border-radius: 4px; padding: 20px; }
    .box-body { padding: 10px; }
    .box-header { text-align: center; margin-bottom: 15px; }
    img { max-width: 100%; height: auto; }
    #receiptPrint { display: block !important; }
    @media print { body { padding: 20px; } @page { margin: 15mm; } }
  </style>
</head>
<body>
  <div id="receiptPrint">${receiptHtml}</div>
</body>
</html>`;

    return new NextResponse(styled, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err: any) {
    console.error("receipt-download error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
