import * as cheerio from "cheerio";

export interface LoginHistoryData {
  available: boolean;
  message: string;
}

export function parseLoginHistory(html: string): LoginHistoryData {
  const $ = cheerio.load(html);
  const msgEl = $("#msgBoxInfoText");
  return {
    available: msgEl.length === 0,
    message: msgEl.length ? msgEl.text().trim() : "Data available",
  };
}
