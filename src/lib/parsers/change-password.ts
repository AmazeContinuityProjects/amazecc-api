import * as cheerio from "cheerio";

export interface ChangePasswordData {
  title: string;
  fields: Record<string, { value: string; type: string; label: string }>;
}

export function parseChangePassword(html: string): ChangePasswordData {
  const $ = cheerio.load(html);
  const result: ChangePasswordData = {
    title: $("strong.fw-bold.h5.text-primary").first().text().trim(),
    fields: {},
  };

  $(".form-floating input").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    const label = $(el).closest(".form-floating").find("label").text().trim() || name;
    result.fields[name] = {
      type: $(el).attr("type") || "password",
      value: $(el).attr("value") || "",
      label,
    };
  });

  return result;
}
