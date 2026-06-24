import * as cheerio from "cheerio";

export interface CompreExamEntry {
  examDate: string;
  examTime: string;
  venue: string;
  mark: string;
  grade: string;
}

export interface CompreInfoData {
  title: string;
  entries: CompreExamEntry[];
  instructions: string;
}

export function parseCompreInfo(html: string): CompreInfoData {
  const $ = cheerio.load(html);
  const result: CompreInfoData = {
    title: $("h3").filter((_, el) => $(el).text().trim() === "Comprehensive Exam Information").first().text().trim(),
    entries: [],
    instructions: "",
  };

  $("table.table tr").each((idx, row) => {
    if (idx === 0) return;
    const cells = $(row).find("td");
    if (cells.length >= 5) {
      result.entries.push({
        examDate: $(cells[0]).text().trim(),
        examTime: $(cells[1]).text().trim(),
        venue: $(cells[2]).text().trim(),
        mark: $(cells[3]).text().trim(),
        grade: $(cells[4]).text().trim(),
      });
    }
  });

  const instructionsEl = $("p").filter((_, el) => $(el).text().trim().startsWith("1)"));
  if (instructionsEl.length) {
    result.instructions = instructionsEl.first().closest("div").find("p").map((_, p) => $(p).text().trim()).get().join("\n");
  }

  return result;
}
