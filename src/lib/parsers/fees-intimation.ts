import * as cheerio from "cheerio";

export interface FeesIntimationData {
  name: string;
  registerNumber: string;
  course: string;
  year: string;
  branch: string;
  tuitionFee: string;
  dueDateWithoutLateFee: string | null;
  dueDateWithLateFee: string | null;
  lateFeePerDay: string | null;
}

export function parseFeesIntimation(html: string): FeesIntimationData {
  const $ = cheerio.load(html);
  const result: FeesIntimationData = {
    name: "",
    registerNumber: "",
    course: "",
    year: "",
    branch: "",
    tuitionFee: "",
    dueDateWithoutLateFee: null,
    dueDateWithLateFee: null,
    lateFeePerDay: null,
  };

  $("table.info-table tr").each((_, row) => {
    const ths = $(row).find("th");
    const tds = $(row).find("td");
    ths.each((i, el) => {
      const key = $(el).text().trim();
      const val = $(tds[i]).text().trim();
      if (key === "NAME") result.name = val;
      else if (key === "REGISTER NUMBER") result.registerNumber = val;
      else if (key === "COURSE") result.course = val;
      else if (key === "YEAR") result.year = val;
      else if (key === "BRANCH") result.branch = val;
      else if (key === "TUITION FEE") result.tuitionFee = val;
    });
  });

  // Extract due dates from instruction text
  const text = $("ol.instructions").text();
  const withoutLate = text.match(/Without late fee[:\s]*([\d]+\w+\s+\w+\s+[\d]+)/i);
  const withLate = text.match(/With late fee[:\s]*([\d]+\w+\s+\w+\s+[\d]+)/i);
  const lateFee = text.match(/Late fee @ Rs\.?([\d]+)/i);

  if (withoutLate) result.dueDateWithoutLateFee = withoutLate[1].trim();
  if (withLate) result.dueDateWithLateFee = withLate[1].trim();
  if (lateFee) result.lateFeePerDay = lateFee[1];

  return result;
}
