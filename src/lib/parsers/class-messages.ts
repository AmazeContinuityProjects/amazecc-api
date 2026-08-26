import * as cheerio from "cheerio";

export interface ClassMessagesData {
  title: string;
  messages: unknown[];
  note: string;
}

export function parseClassMessages(html: string): ClassMessagesData {
  const $ = cheerio.load(html);
  return {
    title: $("h3.box-title").first().text().trim(),
    messages: [],
    note: $("h4[style]").first().text().trim(),
  };
}
