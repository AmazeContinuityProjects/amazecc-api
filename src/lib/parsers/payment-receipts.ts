import * as cheerio from "cheerio";

export interface Receipt {
  receiptNumber: string;
  date: string;
  amount: string;
  campusCode: string;
  viewKey: string | null;
  applno: string;
  regno: string;
}

export interface PaymentReceiptsData {
  title: string;
  receipts: Receipt[];
}

export function parsePaymentReceipts(html: string): PaymentReceiptsData {
  const $ = cheerio.load(html);
  const result: PaymentReceiptsData = {
    title: $("h3.box-title b").first().text().trim(),
    receipts: [],
  };

  const $table = $("table.table-bordered");
  const headers: string[] = [];
  $table.find("tr").first().find("td").each((_, cell) => {
    headers.push($(cell).text().trim());
  });

  $table.find("tr").slice(1).each((_, row) => {
    const cells = $(row).find("td");
    const onclick = $(cells[4]).find("button").attr("onclick") || "";
    const keyMatch = onclick.match(/doDuplicateReceipt\(['"]([^'"]+)['"]\)/);
    const applno = $(cells[4]).find("input[name='applno']").val() as string || "";
    const regno = $(cells[4]).find("input[name='regno']").val() as string || "";

    result.receipts.push({
      receiptNumber: $(cells[0]).text().trim(),
      date: $(cells[1]).text().trim(),
      amount: $(cells[2]).text().trim(),
      campusCode: $(cells[3]).text().trim(),
      viewKey: keyMatch ? keyMatch[1] : null,
      applno,
      regno,
    });
  });

  return result;
}
