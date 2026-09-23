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
        amount: 4.5,
        categoryId: null,
        categoryName: null,
      },
      {
        date: "2026-01-03",
        description: "Refund",
        amount: -12,
        categoryId: null,
        categoryName: null,
      },
    ]);
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

    expect(transactions.map(({ amount }) => amount)).toEqual([-25, 1000]);
  });
});
