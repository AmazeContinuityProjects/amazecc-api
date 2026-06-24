import * as cheerio from "cheerio";

export interface AcknowledgementData {
  applicationNo: string;
  registerNo: string;
  name: string;
  programme: string;
  campus: string;
  branch: string;
  documents: { serialNo: string; documentName: string; status: string }[];
}

export function parseAcknowledgement(html: string): AcknowledgementData {
  const $ = cheerio.load(html);
  const result: AcknowledgementData = {
    applicationNo: "",
    registerNo: "",
    name: "",
    programme: "",
    campus: "",
    branch: "",
    documents: [],
  };

  $("table").first().find("tr").each((_, row) => {
    const cells = $(row).find("td");
    const text = (i: number) => cells.eq(i).text().trim();
    if (cells.length < 2) return;
    const key = text(0).replace(/\s+/g, " ");
    const val = text(1);
    if (key.includes("Application No")) result.applicationNo = val;
    else if (key.includes("Register No")) result.registerNo = val;
    else if (key.includes("Name")) result.name = val;
    else if (key.includes("Programme")) result.programme = val;
    else if (key.includes("Campus")) result.campus = val;
    else if (key.includes("Branch")) result.branch = val;
  });

  $("table").eq(1).find("tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return;
    const serialNo = cells.eq(0).text().trim().replace(".", "");
    const documentName = cells.eq(1).text().trim();
    const status = cells.eq(2).text().trim();
    if (serialNo && documentName) {
      result.documents.push({ serialNo, documentName, status });
    }
  });

  return result;
}
