import * as cheerio from "cheerio";

export interface SemesterOption {
  value: string;
  text: string;
  selected: boolean;
}

export interface ExtraCurricularData {
  title: string;
  semesters: SemesterOption[];
}

export function parseExtraCurricular(html: string): ExtraCurricularData {
  const $ = cheerio.load(html);
  const result: ExtraCurricularData = {
    title: $("h3.box-title").first().text().trim(),
    semesters: [],
  };

  $("#semesterSubId option").each((_, opt) => {
    const value = $(opt).attr("value") || "";
    if (value) {
      result.semesters.push({
        value,
        text: $(opt).text().trim(),
        selected: $(opt).attr("selected") !== undefined,
      });
    }
  });

  return result;
}
