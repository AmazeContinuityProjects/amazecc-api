import * as cheerio from "cheerio";

export interface CircularItem {
  id?: string | null;
  title?: string;
  name?: string;
  children?: CircularItem[];
}

export interface CircularsData {
  title: string;
  circulars: CircularItem[];
}

export function parseCirculars(html: string): CircularsData {
  const $ = cheerio.load(html);
  const result: CircularsData = {
    title: $("h3").first().text().trim(),
    circulars: [],
  };

  function parseUl(ul: cheerio.Cheerio<any>): CircularItem[] {
    const items: CircularItem[] = [];
    ul.children("li").each((_i: number, li: any) => {
      const $li = $(li);
      const span = $li.children("span").first();
      const link = $li.find("a").first();
      const childUl = $li.children("ul");

      if (link.length) {
        const onclick = link.attr("onclick") || "";
        const idMatch = onclick.match(/viewCertificate\(['"]?([^'")\s]+)['"]?\)/);
        items.push({
          id: idMatch ? idMatch[1] : null,
          title: link.text().trim(),
        });
      } else if (span.length) {
        items.push({
          name: span.text().trim(),
          children: childUl.length ? parseUl(childUl) : [],
        });
      }
    });
    return items;
  }

  const tree = $("#tree1");
  if (tree.length) {
    result.circulars = parseUl(tree);
  }

  return result;
}
