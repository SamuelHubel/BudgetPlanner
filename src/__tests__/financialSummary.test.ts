import { describe, expect, it, vi } from "vitest";
import type Database from "@tauri-apps/plugin-sql";
import { createFinancialSummary, loadFinancialSummary } from "../lib/financialSummary";

const categories = [
  { id: 1, name: "Pay", type: "income" as const, color: "#14b8a6" },
  { id: 2, name: "Groceries", type: "expense" as const, color: "#22c55e" },
  { id: 3, name: "Housing", type: "expense" as const, color: null },
];

describe("createFinancialSummary", () => {
  it("totals listed categories and ranks repeated sources separately for income and expenses", () => {
    const summary = createFinancialSummary(categories, [
      { categoryId: 1, amount: 2500, description: "Acme Payroll" },
      { categoryId: 1, amount: 2500, description: "ACME PAYROLL" },
      { categoryId: 2, amount: -75, description: "Market" },
      { categoryId: 2, amount: -40, description: "Market" },
      { categoryId: 3, amount: -900, description: "Rent" },
    ]);

    expect(summary.income.map(({ category, amount }) => [category.name, amount])).toEqual([["Pay", 5000]]);
    expect(summary.expenses.map(({ category, amount }) => [category.name, amount])).toEqual([
      ["Groceries", 115],
      ["Housing", 900],
    ]);
    expect(summary.largestIncomeSources).toEqual([
      { description: "Acme Payroll", categoryName: "Pay", amount: 5000 },
    ]);
    expect(summary.largestExpenses).toEqual([
      { description: "Rent", categoryName: "Housing", amount: 900 },
      { description: "Market", categoryName: "Groceries", amount: 115 },
    ]);
  });

  it("excludes uncategorized, missing-category, and zero-amount transactions", () => {
    const summary = createFinancialSummary(categories, [
      { categoryId: null, amount: 400, description: "Uncategorized income" },
      { categoryId: 99, amount: -80, description: "Deleted category" },
      { categoryId: 2, amount: 0, description: "Zero" },
    ]);

    expect(summary).toEqual({
      income: [],
      expenses: [],
      largestIncomeSources: [],
      largestExpenses: [],
      monthlyTotals: [],
    });
  });

  it("groups categorized transactions into ordered monthly income and expense totals", () => {
    const summary = createFinancialSummary(categories, [
      { categoryId: 1, amount: 2500, description: "Paycheck", date: "2026-02-01" },
      { categoryId: 2, amount: -75, description: "Market", date: "2026-02-12" },
      { categoryId: 3, amount: -900, description: "Rent", date: "2026-01-03" },
      { categoryId: null, amount: 1000, description: "Uncategorized", date: "2026-02-18" },
      { categoryId: 2, amount: -20, description: "Invalid date", date: "not a date" },
    ]);

    expect(summary.monthlyTotals).toEqual([
      { month: "2026-01", income: 0, expenses: 900 },
      { month: "2026-02", income: 2500, expenses: 75 },
    ]);
  });
});

describe("loadFinancialSummary", () => {
  it("loads saved categories and assigned transactions from the database", async () => {
    const select = vi.fn()
      .mockResolvedValueOnce(categories)
      .mockResolvedValueOnce([
        { categoryId: 1, amount: 1250, description: "Employer", date: "2026-03-01" },
        { categoryId: 2, amount: -35, description: "Market", date: "2026-03-02" },
      ]);
    const summary = await loadFinancialSummary({ select } as unknown as Database);

    expect(select).toHaveBeenCalledTimes(2);
    expect(summary.income[0]).toMatchObject({ category: { name: "Pay" }, amount: 1250 });
    expect(summary.expenses[0]).toMatchObject({ category: { name: "Groceries" }, amount: 35 });
    expect(summary.monthlyTotals).toEqual([
      { month: "2026-03", income: 1250, expenses: 35 },
    ]);
  });
});
