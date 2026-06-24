import * as cheerio from "cheerio";

export interface BiometricData {
  title: string;
  fields: Record<string, { value: string; type: string; label: string }>;
}

export function parseBiometric(html: string): BiometricData {
  const $ = cheerio.load(html);
  const result: BiometricData = {
    title: $("h3.box-title").first().text().trim(),
    fields: {},
  };

  const fieldLabels: Record<string, string> = {};
  $("label.control-label").each((_, el) => {
    const label = $(el).text().trim();
    const input = $(el).closest(".form-groups").find("input").first();
    const name = input.attr("name");
    if (name && label) fieldLabels[name] = label;
  });

  $("input").each((_, el) => {
    const name = $(el).attr("name");
    if (!name || name === "_csrf" || name === "authorizedID") return;
    result.fields[name] = {
      type: $(el).attr("type") || "text",
      value: $(el).attr("value") || "",
      label: fieldLabels[name] || name,
    };
  });

  return result;
}
