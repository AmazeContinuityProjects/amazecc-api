import * as cheerio from "cheerio";

export interface DomainOption {
  value: string;
  text: string;
  selected: boolean;
}

export interface FaqData {
  title: string;
  domains: DomainOption[];
}

export function parseFaq(html: string): FaqData {
  const $ = cheerio.load(html);
  const result: FaqData = {
    title: $("h3.box-title").first().text().trim(),
    domains: [],
  };

  $("#domainName option").each((_, opt) => {
    const value = $(opt).attr("value") || "";
    if (value) {
      result.domains.push({
        value,
        text: $(opt).text().trim(),
        selected: $(opt).attr("selected") !== undefined,
      });
    }
  });

  return result;
}
