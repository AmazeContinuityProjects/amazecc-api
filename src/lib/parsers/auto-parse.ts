import * as cheerio from "cheerio";

export interface ParsedVtopPage {
  title: string;
  selectOptions: Record<string, { value: string; text: string; selected: boolean }[]>;
  tables: { caption?: string; headers: string[]; rows: Record<string, string>[] }[];
  keyValuePairs: Record<string, string>;
  formFields: Record<string, string>;
  hiddenFields: Record<string, string>;
  messages: { warning?: string; error?: string; success?: string };
}

export function parseVtopHtml(html: string): ParsedVtopPage {
  const $ = cheerio.load(html);
  const result: ParsedVtopPage = {
    title: "",
    selectOptions: {},
    tables: [],
    keyValuePairs: {},
    formFields: {},
    hiddenFields: {},
    messages: {},
  };

  result.title = $("h3.box-title").first().text().trim() || $("title").first().text().trim();

  $("input[type=hidden]").each((_, el) => {
    const name = $(el).attr("name") || $(el).attr("id") || "";
    const val = $(el).attr("value") || "";
    if (name) result.hiddenFields[name] = val;
  });

  $("select").each((_, el) => {
    const name = $(el).attr("name") || $(el).attr("id") || "select";
    const options: { value: string; text: string; selected: boolean }[] = [];
    $(el).find("option").each((_, opt) => {
      options.push({
        value: $(opt).attr("value") || "",
        text: $(opt).text().trim(),
        selected: $(opt).attr("selected") !== undefined,
      });
    });
    if (options.length > 0) result.selectOptions[name] = options;
  });

  $("input:not([type=hidden]), textarea").each((_, el) => {
    const name = $(el).attr("name") || $(el).attr("id") || "";
    const val = $(el).attr("value") || $(el).text().trim() || "";
    if (name) result.formFields[name] = val;
  });

  $("table").each((ti, table) => {
    const $table = $(table);
    const caption = $table.find("caption").first().text().trim() || undefined;
    const headers: string[] = [];
    const rows: Record<string, string>[] = [];

    const $headerRow = $table.find("tr").first();
    $headerRow.find("th").each((_, cell) => {
      const text = $(cell).text().trim();
      if (text) headers.push(text);
    });

    if (headers.length === 0) {
      $headerRow.find("td").each((_, cell) => {
        const text = $(cell).text().trim();
        if (text && $(cell).attr("colspan") !== "13") headers.push(text);
      });
    }

    $table.find("tr").slice(1).each((_, row) => {
      const rowData: Record<string, string> = {};
      $(row).find("td").each((i, cell) => {
        const text = $(cell).text().trim();
        if (text) rowData[headers[i] || `col${i}`] = text;
      });
      if (Object.keys(rowData).length > 0) rows.push(rowData);
    });

    if (headers.length > 0 && rows.length > 0) {
      result.tables.push({ caption, headers, rows });
    }
  });

  $("table").first().find("tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length === 2) {
      const label = $(cells[0]).text().trim().replace(/\s+/g, " ");
      const value = $(cells[1]).text().trim();
      if (label && value && label !== value && !label.startsWith("<")) {
        result.keyValuePairs[camelCase(label)] = value;
      }
    }
  });

  const warning = $("input#warning, input[name=warning]").val() as string;
  const error = $("input#error, input[name=error]").val() as string;
  const success = $("input#success, input[name=success]").val() as string;
  if (warning) result.messages.warning = warning;
  if (error) result.messages.error = error;
  if (success) result.messages.success = success;

  return result;
}

function camelCase(str: string): string {
  return str.replace(/(?:^\w|[A-Z]|[-\s]\w)/g, (match, idx) =>
    idx === 0 ? match.toLowerCase() : match.toUpperCase()
  ).replace(/[-\s]/g, "");
}
