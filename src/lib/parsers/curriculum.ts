import * as cheerio from "cheerio";

export interface CurriculumCategory {
  code: string;
  name: string;
  credits: number;
  maxCredits: number;
}

export interface CurriculumData {
  title: string;
  totalCredits: number;
  categories: CurriculumCategory[];
}

export function parseCurriculum(html: string): CurriculumData {
  const $ = cheerio.load(html);
  const result: CurriculumData = {
    title: $("h3").first().text().trim(),
    totalCredits: 0,
    categories: [],
  };

  const totalText = $("span:contains('Total Credits:')").text().trim();
  const totalMatch = totalText.match(/Total Credits:\s*(\d+)/);
  if (totalMatch) result.totalCredits = parseInt(totalMatch[1]);

  $(".categoty-card").each((_, card) => {
    const $card = $(card);
    const code = $card.find(".symbol-label").first().text().trim().split("\n")[0].trim();
    const name = $card.find(".text-sm").text().trim();
    const creditText = $card.find("small:contains('Credit:')").parent().text();
    const maxCreditText = $card.find("small:contains('Max. Credit:')").parent().text();
    const credits = parseInt(creditText.match(/Credit:\s*(\d+)/)?.[1] || "0");
    const maxCredits = parseInt(maxCreditText.match(/Max.\s*Credit:\s*(\d+)/)?.[1] || "0");

    result.categories.push({ code, name, credits, maxCredits });
  });

  return result;
}
