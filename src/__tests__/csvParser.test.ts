import { describe, expect, it } from "vitest";
import { parseBankCsv } from "../lib/csvParser";

describe("parseBankCsv", () => {
  it("supports common header variations and quoted descriptions", () => {
    const transactions = parseBankCsv(
      "Posted Date,Details,Transaction Amount\n2026-01-02,\"Coffee, shop\",$4.50\n2026-01-03,Refund,(12.00)",
    );

    expect(transactions).toEqual([
      {
        date: "2026-01-02",
        description: "Coffee, shop",
        amountCents: 450,
        categoryName: null,
        categoryId: null,
      },
      {
        date: "2026-01-03",
        description: "Refund",
        amountCents: -1200,
        categoryName: null,
        categoryId: null,
      },
    ]);
  });

  it("parses a category column when the statement provides one", () => {
    const transactions = parseBankCsv(
      "Date,Description,Amount,Transaction Category\n2026-01-02,Coffee shop,-4.50,Dining Out",
    );

    expect(transactions[0]).toMatchObject({
      description: "Coffee shop",
      categoryName: "Dining Out",
      categoryId: null,
    });
  });

  it("rejects files without required columns", () => {
    expect(() => parseBankCsv("date,merchant\n2026-01-01,Store")).toThrow(
      "date, description, and amount columns",
    );
  });

  it("supports separate debit and credit columns", () => {
    const transactions = parseBankCsv(
      "Date,Description,Debit,Credit\n2026-01-01,Store,25.00,\n2026-01-02,Paycheck,,1000.00",
    );

    expect(transactions.map(({ amountCents }) => amountCents)).toEqual([-2500, 100000]);
  });

  it("rounds imported amounts to the nearest cent", () => {
    const transactions = parseBankCsv(
      "Date,Description,Amount\n2026-01-01,Positive,1.005\n2026-01-02,Negative,(1.005)\n2026-01-03,Sub-cent,0.004",
    );

    expect(transactions.map(({ amountCents }) => amountCents)).toEqual([101, -101, 0]);
  });
});
