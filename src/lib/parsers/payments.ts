import * as cheerio from "cheerio";

export interface StudentInfo {
  registerNumber: string;
  studentName: string;
  programme: string;
  campus: string;
}

export interface PaymentsData {
  title: string;
  studentInfo: StudentInfo | null;
  message: string;
  hasDues: boolean;
}

export function parsePayments(html: string): PaymentsData {
  const $ = cheerio.load(html);
  const result: PaymentsData = {
    title: $("h3.box-title").first().text().trim(),
    studentInfo: null,
    message: "",
    hasDues: false,
  };

  const regNo = $("div.container .row").first().find(".text-primary b").first().text().trim().replace(/^:\s*/, "");
  const name = $("div.container .row").first().find(".text-primary b").last().text().trim().replace(/^:\s*/, "");
  if (regNo || name) {
    const allPrimary = $("div.container .row .text-primary b");
    const programme = $(allPrimary[2]).text().trim().replace(/^:\s*/, "");
    const campus = $(allPrimary[3]).text().trim().replace(/^:\s*/, "");
    result.studentInfo = {
      registerNumber: regNo,
      studentName: name,
      programme,
      campus,
    };
  }

  const msgEl = $("font[color='green']");
  if (msgEl.length) {
    msgEl.find("script, style").remove();
    result.message = msgEl.text().trim().replace(/\s+/g, " ");
    result.hasDues = false;
  }

  const hasTable = $("table").length > 0;
  if (!result.message && hasTable) {
    result.hasDues = true;
  }

  return result;
}
