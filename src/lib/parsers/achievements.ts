import * as cheerio from "cheerio";

export interface ActivityYear {
  activityYear: string;
  activeFrom: string;
  activeTill: string;
}

export interface AchievementsData {
  title: string;
  activities: ActivityYear[];
  formFields: Record<string, { value: string; type: string; label: string }>;
}

export function parseAchievements(html: string): AchievementsData {
  const $ = cheerio.load(html);
  const result: AchievementsData = {
    title: $("h3.box-title").first().text().trim(),
    activities: [],
    formFields: {},
  };

  const fieldLabels: Record<string, string> = {};
  $(".form-group").each((_, group) => {
    const $group = $(group);
    const label = $group.find("label.control-label").first().text().trim().replace(/\s+/g, " ");
    const input = $group.find("input, select").first();
    const name = input.attr("name");
    if (name && label) fieldLabels[name] = label;
  });

  $("input, select").each((_, el) => {
    const name = $(el).attr("name");
    if (!name || name === "_csrf" || name === "authorizedID") return;
    const label = fieldLabels[name] || name;
    const tag = el.tagName.toLowerCase();
    if (tag === "select") {
      result.formFields[name] = {
        type: "select",
        value: $(el).val() as string || "",
        label,
      };
    } else {
      result.formFields[name] = {
        type: $(el).attr("type") || "text",
        value: $(el).attr("value") || "",
        label,
      };
    }
  });

  $("table.customTable").each((_, table) => {
    const headers: string[] = [];
    $(table).find("tr.tableHeader td").each((_, cell) => {
      headers.push($(cell).text().trim());
    });
    $(table).find("tr.tableContent").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 3) {
        result.activities.push({
          activityYear: $(cells[0]).text().trim(),
          activeFrom: $(cells[1]).text().trim(),
          activeTill: $(cells[2]).text().trim(),
        });
      }
    });
  });

  return result;
}
