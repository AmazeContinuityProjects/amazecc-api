import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import { extractKeyValueTable, parseSimpleTable } from "./common";
import { parseWallet } from "./wallet";
import { parseProctor } from "./proctor";
import { parsePayments } from "./payments";
import { parseAcknowledgement } from "./acknowledgement";

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");

describe("common helpers", () => {
  it("extractKeyValueTable camel-cases labels, collapses spaces and skips empty values", () => {
    const $ = cheerio.load(fixture("key-value.html"));
    expect(extractKeyValueTable($)).toEqual({
      bankName: "Example Bank",
      accountNumber: "000011112222",
      iFSCCode: "EXMP0000001",
    });
  });

  it("parseSimpleTable keys rows by the header row", () => {
    const { headers, rows } = parseSimpleTable(fixture("acknowledgement.html"));
    expect(headers).toEqual(["Application No", "APP2026001"]);
    expect(rows[0]).toEqual({ "Application No": "Register No", APP2026001: "26BCE0000" });
  });
});

describe("parseWallet", () => {
  it("reads the INR ledger, the empty USD ledger and the add-money field", () => {
    const w = parseWallet(fixture("wallet.html"));
    expect(w.title).toBe("VIT Wallet");
    expect(w.addMoneyField).toEqual({ name: "amount", value: "" });
    expect(w.ledgerINR).toHaveLength(2);
    expect(w.ledgerINR[1]).toEqual({
      transactionDate: "15-Aug-2026",
      receiptNumber: "WR000456",
      transactionType: "Debit",
      amount: "1200.00",
      refundAmount: "0.00",
      bookBalanceAmount: "3800.00",
      refundDate: "-",
    });
    expect(w.ledgerUSD).toEqual([]);
  });
});

describe("parseProctor", () => {
  it("maps the well-known labels and keeps the photo", () => {
    const p = parseProctor(fixture("proctor.html"));
    expect(p.title).toBe("Proctor Details");
    expect(p.photoBase64).toBe("data:image/png;base64,AAAA");
    expect(p.details).toMatchObject({
      name: "Dr. Test Proctor",
      email: "proctor@example.edu",
      phone: "9000000000",
      designation: "Associate Professor",
      facultyId: "10001",
      school: "SCOPE",
      cabin: "AB1 - 101",
    });
  });
});

describe("parsePayments", () => {
  it("reads student info and the no-dues message without inline script text", () => {
    const p = parsePayments(fixture("payments-no-dues.html"));
    expect(p.studentInfo).toEqual({
      registerNumber: "21BCE0000",
      studentName: "TEST STUDENT",
      programme: "B.Tech CSE",
      campus: "Chennai",
    });
    expect(p.message).toBe("No payment dues as of now.");
    expect(p.hasDues).toBe(false);
  });

  it("treats a fee table with no green message as dues", () => {
    const p = parsePayments(fixture("payments-dues.html"));
    expect(p.hasDues).toBe(true);
    expect(p.message).toBe("");
  });
});

describe("parseAcknowledgement", () => {
  it("reads the applicant table and the document checklist", () => {
    const a = parseAcknowledgement(fixture("acknowledgement.html"));
    expect(a).toMatchObject({
      applicationNo: "APP2026001",
      registerNo: "26BCE0000",
      name: "TEST FRESHER",
      programme: "B.Tech",
      campus: "Chennai",
      branch: "Computer Science and Engineering",
    });
    expect(a.documents).toEqual([
      { serialNo: "1", documentName: "Class XII Marksheet", status: "Submitted" },
      { serialNo: "2", documentName: "Transfer Certificate", status: "Pending" },
    ]);
  });
});

// VTOP returns its login page or an error shell when a session expires. Every
// parser must degrade to empty data on such a page instead of throwing.
describe("unexpected pages", () => {
  const shells = ["", "<html><body><h1>Session expired</h1></body></html>"];
  it.each(shells)("parsers return empty results for %j", (html) => {
    expect(() => parseWallet(html)).not.toThrow();
    expect(parseWallet(html).ledgerINR).toEqual([]);
    expect(parseProctor(html).details).toEqual({});
    expect(parsePayments(html)).toMatchObject({ studentInfo: null, hasDues: false });
    expect(parseAcknowledgement(html).documents).toEqual([]);
  });
});
