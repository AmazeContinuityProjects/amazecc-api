import * as cheerio from "cheerio";

export interface BankInfoData {
  title: string;
  fields: Record<string, {
    value: string;
    type: string;
    label: string;
    options?: { value: string; selected: boolean; text: string }[];
  }>;
  bankDetails: {
    bankName: string | null;
    branch: string | null;
    address: string | null;
  } | null;
}

export function parseBankInfo(html: string): BankInfoData {
  const $ = cheerio.load(html);
  const result: BankInfoData = {
    title: $("h3.box-title").first().text().trim(),
    fields: {},
    bankDetails: null,
  };

  const form = $("#bankInfoStudentForm");
  const fieldLabels: Record<string, string> = {};

  form.find("table tr").each((_, row) => {
    const labelCell = $(row).find("td").first();
    const label = labelCell.text().trim().replace(/\s+/g, " ") || "";
    const input = $(row).find("input, select").first();
    const name = input.attr("name");
    if (name) {
      fieldLabels[name] = label;
    }
  });

  form.find("input, select").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    const tag = el.tagName.toLowerCase();
    const label = fieldLabels[name] || name;
    if (tag === "select") {
      const options: { value: string; selected: boolean; text: string }[] = [];
      $(el).find("option").each((_, opt) => {
        options.push({
          value: $(opt).attr("value") || "",
          selected: $(opt).attr("selected") !== undefined,
          text: $(opt).text().trim(),
        });
      });
      result.fields[name] = { type: "select", value: $(el).val() as string || "", label, options };
    } else {
      result.fields[name] = {
        type: $(el).attr("type") || "text",
        value: $(el).attr("value") || "",
        label,
      };
    }
  });

  const bankDetailsDiv = $("#ifscCodeBkFrag");
  if (bankDetailsDiv.length) {
    const lines: string[] = [];
    bankDetailsDiv.find("b").each((_, el) => {
      lines.push($(el).text().trim());
    });
    if (lines.length > 0) {
      result.bankDetails = {
        bankName: lines[0] || null,
        branch: lines[1] || null,
        address: lines[2] || null,
      };
    }
  }

  return result;
}
