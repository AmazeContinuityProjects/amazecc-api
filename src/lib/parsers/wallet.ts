import * as cheerio from "cheerio";

export interface LedgerEntry {
  transactionDate: string;
  receiptNumber: string;
  transactionType: string;
  amount: string;
  refundAmount: string;
  bookBalanceAmount: string;
  refundDate: string;
}

export interface WalletData {
  title: string;
  addMoneyField: { name: string; value: string } | null;
  ledgerINR: LedgerEntry[];
  ledgerUSD: LedgerEntry[];
}

export function parseWallet(html: string): WalletData {
  const $ = cheerio.load(html);
  const result: WalletData = {
    title: $("h3.box-title").first().text().trim(),
    addMoneyField: null,
    ledgerINR: [],
    ledgerUSD: [],
  };

  const moneyInput = $("#money");
  if (moneyInput.length) {
    result.addMoneyField = {
      name: moneyInput.attr("name") || "money",
      value: moneyInput.attr("value") || "",
    };
  }

  const tables = $("table.table-bordered");
  const parseTable = (tableIdx: number): LedgerEntry[] => {
    const entries: LedgerEntry[] = [];
    const $table = $(tables[tableIdx]);
    if (!$table.length) return entries;
    $table.find("tr").slice(1).each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 7) {
        entries.push({
          transactionDate: $(cells[0]).text().trim(),
          receiptNumber: $(cells[1]).text().trim(),
          transactionType: $(cells[2]).text().trim(),
          amount: $(cells[3]).text().trim(),
          refundAmount: $(cells[4]).text().trim(),
          bookBalanceAmount: $(cells[5]).text().trim(),
          refundDate: $(cells[6]).text().trim(),
        });
      }
    });
    return entries;
  };

  if (tables.length >= 1) result.ledgerINR = parseTable(0);
  if (tables.length >= 2) result.ledgerUSD = parseTable(1);

  return result;
}
