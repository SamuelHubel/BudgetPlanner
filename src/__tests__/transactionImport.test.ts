import { describe, expect, it, vi } from "vitest";
import type Database from "@tauri-apps/plugin-sql";
import { categorizeTransactions, saveImportedTransactions } from "../lib/transactionImport";
import type { ParsedTransaction } from "../lib/csvParser";

describe("categorizeTransactions", () => {
  it("uses the most specific keyword match and leaves vague descriptions uncategorized", async () => {
    const mappings = [
      { keyword: "uber", categoryId: 1, categoryName: "Transportation" },
      { keyword: "uber eats", categoryId: 2, categoryName: "Dining Out" },
      { keyword: "netflix", categoryId: 3, categoryName: "Entertainment" },
      { keyword: "shop", categoryId: 4, categoryName: "Shopping" },
    ];
    const db = {
      select: vi.fn(async () => mappings),
    } as unknown as Database;
    const transactions: ParsedTransaction[] = [
      { date: "2026-01-01", description: "UBER EATS*ORDER", amount: -20, categoryId: null, categoryName: null },
      { date: "2026-01-02", description: "Netflix monthly subscription", amount: -15, categoryId: null, categoryName: null },
      { date: "2026-01-03", description: "Unknown payment", amount: -8, categoryId: null, categoryName: null },
      { date: "2026-01-04", description: "Workshop supplies", amount: -12, categoryId: null, categoryName: null },
    ];

    const categorized = await categorizeTransactions(db, transactions);

    expect(categorized.map(({ categoryId, categoryName }) => [categoryId, categoryName])).toEqual([
      [2, "Dining Out"],
      [3, "Entertainment"],
      [null, null],
      [null, null],
    ]);
  });
});

describe("saveImportedTransactions", () => {
  it("persists the category assigned during CSV review", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ lastInsertId: 12 })
      .mockResolvedValueOnce({ rowsAffected: 1 });
    const db = { execute } as unknown as Database;
    const transaction: ParsedTransaction = {
      date: "2026-01-05",
      description: "Grocery store",
      amount: -42,
      categoryId: 7,
      categoryName: "Groceries",
    };

    await saveImportedTransactions(db, "statement.csv", [transaction]);

    expect(execute).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO transactions"),
      [7, -42, "Grocery store", "2026-01-05", 12, expect.any(String)],
    );
  });
});
