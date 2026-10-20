import { describe, expect, it, vi } from "vitest";
import type Database from "@tauri-apps/plugin-sql";
import { categorizeTransactions, saveImportedTransactions } from "../lib/transactionImport";
import type { ParsedTransaction } from "../lib/csvParser";

describe("categorizeTransactions", () => {
  it("prefers statement categories and falls back to the most specific keyword match", async () => {
    const categories = [
      { id: 1, name: "Transportation" },
      { id: 2, name: "Dining Out" },
      { id: 3, name: "Entertainment" },
    ];
    const keywordCategories = [
      { keyword: "uber", categoryId: 1, categoryName: "Transportation" },
      { keyword: "uber eats", categoryId: 2, categoryName: "Dining Out" },
      { keyword: "netflix", categoryId: 3, categoryName: "Entertainment" },
    ];
    const db = {
      select: vi.fn(async (query: string) =>
        query.includes("keyword_category_map") ? keywordCategories : categories),
    } as unknown as Database;
    const transactions: ParsedTransaction[] = [
      { date: "2026-01-01", description: "UBER EATS*ORDER", amountCents: -2000, categoryName: " dining   out ", categoryId: null },
      { date: "2026-01-02", description: "Netflix monthly subscription", amountCents: -1500, categoryName: null, categoryId: null },
      { date: "2026-01-03", description: "UBER EATS*ORDER", amountCents: -800, categoryName: "Unrecognized", categoryId: null },
      { date: "2026-01-04", description: "Unknown payment", amountCents: -800, categoryName: "Unrecognized", categoryId: null },
    ];

    const categorized = await categorizeTransactions(db, transactions, categories);

    expect(categorized.map(({ categoryId, categoryName }) => [categoryId, categoryName])).toEqual([
      [2, "Dining Out"],
      [3, "Entertainment"],
      [2, "Dining Out"],
      [null, "Unrecognized"],
    ]);
    expect(db.select).toHaveBeenCalledTimes(1);
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
      amountCents: -4200,
      categoryName: "Groceries",
      categoryId: 7,
    };

    await saveImportedTransactions(db, "statement.csv", [transaction]);

    expect(execute).toHaveBeenLastCalledWith(
      expect.stringContaining("amount_cents"),
      [7, -4200, "Grocery store", "2026-01-05", 12, expect.any(String)],
    );
  });
});
