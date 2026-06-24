import * as cheerio from "cheerio";

export interface CertificateService {
  value: string;
  text: string;
  selected: boolean;
}

export interface BonafideData {
  title: string;
  certificateServices: CertificateService[];
}

export function parseBonafide(html: string): BonafideData {
  const $ = cheerio.load(html);
  const result: BonafideData = {
    title: $("h3.box-title").first().text().trim(),
    certificateServices: [],
  };

  $("#certificateCode option").each((_, opt) => {
    const value = $(opt).attr("value") || "";
    if (value) {
      result.certificateServices.push({
        value,
        text: $(opt).text().trim(),
        selected: $(opt).attr("selected") !== undefined,
      });
    }
  });

  return result;
}
