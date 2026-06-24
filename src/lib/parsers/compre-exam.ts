import * as cheerio from "cheerio";

export interface CompreExamData {
  title: string;
  status: string;
  message: string | null;
}

export function parseCompreExam(html: string): CompreExamData {
  const $ = cheerio.load(html);
  const messageEl = $("h3.text-danger").first();
  return {
    title: $("h3").filter((_, el) => $(el).text().trim() === "Comprehensive Examination").first().text().trim(),
    status: messageEl.length ? messageEl.text().trim() : "registration_open",
    message: messageEl.length ? messageEl.text().trim() : null,
  };
}
