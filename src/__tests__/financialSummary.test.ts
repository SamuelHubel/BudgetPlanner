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
      { categoryId: 1, amountCents: 250000, description: "Acme Payroll" },
      { categoryId: 1, amountCents: 250000, description: "ACME PAYROLL" },
      { categoryId: 2, amountCents: -7500, description: "Market" },
      { categoryId: 2, amountCents: -4000, description: "Market" },
      { categoryId: 3, amountCents: -90000, description: "Rent" },
    ]);

    expect(summary.income.map(({ category, amountCents }) => [category.name, amountCents])).toEqual([["Pay", 500000]]);
    expect(summary.expenses.map(({ category, amountCents }) => [category.name, amountCents])).toEqual([
      ["Groceries", 11500],
      ["Housing", 90000],
    ]);
    expect(summary.largestIncomeSources).toEqual([
      { description: "Acme Payroll", categoryName: "Pay", amountCents: 500000 },
    ]);
    expect(summary.largestExpenses).toEqual([
      { description: "Rent", categoryName: "Housing", amountCents: 90000 },
      { description: "Market", categoryName: "Groceries", amountCents: 11500 },
    ]);
  });

  it("excludes uncategorized, missing-category, and zero-amount transactions", () => {
    const summary = createFinancialSummary(categories, [
      { categoryId: null, amountCents: 40000, description: "Uncategorized income" },
      { categoryId: 99, amountCents: -8000, description: "Deleted category" },
      { categoryId: 2, amountCents: 0, description: "Zero" },
    ]);

    expect(summary).toEqual({
      income: [],
      expenses: [],
      largestIncomeSources: [],
      largestExpenses: [],
      monthlyTotals: [],
      monthlyBreakdowns: [],
    });
  });

  it("groups categorized transactions into ordered monthly income and expense totals", () => {
    const summary = createFinancialSummary(categories, [
      { categoryId: 1, amountCents: 250000, description: "Paycheck", date: "2026-02-01" },
      { categoryId: 2, amountCents: -7500, description: "Market", date: "2026-02-12" },
      { categoryId: 3, amountCents: -90000, description: "Rent", date: "2026-01-03" },
      { categoryId: null, amountCents: 100000, description: "Uncategorized", date: "2026-02-18" },
      { categoryId: 2, amountCents: -2000, description: "Invalid date", date: "not a date" },
    ]);

    expect(summary.monthlyTotals).toEqual([
      { month: "2026-01", incomeCents: 0, expensesCents: 90000 },
      { month: "2026-02", incomeCents: 250000, expensesCents: 7500 },
    ]);
    expect(summary.monthlyBreakdowns.map(({ month, income, expenses }) => [
      month,
      income.map(({ category, amountCents }) => [category.name, amountCents]),
      expenses.map(({ category, amountCents }) => [category.name, amountCents]),
    ])).toEqual([
      ["2026-01", [], [["Housing", 90000]]],
      ["2026-02", [["Pay", 250000]], [["Groceries", 7500]]],
    ]);
  });

  it("tracks months that contain only uncategorized transactions", () => {
    const summary = createFinancialSummary(categories, [
      { categoryId: null, amountCents: -2000, description: "Uncategorized", date: "2026-03-12" },
    ]);

    expect(summary.monthlyTotals).toEqual([
      { month: "2026-03", incomeCents: 0, expensesCents: 0 },
    ]);
    expect(summary.monthlyBreakdowns).toMatchObject([
      { month: "2026-03", income: [], expenses: [] },
    ]);
  });
});

describe("loadFinancialSummary", () => {
  it("loads saved categories and assigned transactions from the database", async () => {
    const select = vi.fn()
      .mockResolvedValueOnce(categories)
      .mockResolvedValueOnce([
        { categoryId: 1, amountCents: 125000, description: "Employer", date: "2026-03-01" },
        { categoryId: 2, amountCents: -3500, description: "Market", date: "2026-03-02" },
        { categoryId: null, amountCents: -1000, description: "Uncategorized", date: "2026-04-02" },
      ]);
    const summary = await loadFinancialSummary({ select } as unknown as Database);

    expect(select).toHaveBeenCalledTimes(2);
    expect(select).toHaveBeenNthCalledWith(2, expect.stringContaining("amount_cents AS amountCents"));
    expect(summary.income[0]).toMatchObject({ category: { name: "Pay" }, amountCents: 125000 });
    expect(summary.expenses[0]).toMatchObject({ category: { name: "Groceries" }, amountCents: 3500 });
    expect(summary.monthlyTotals).toEqual([
      { month: "2026-03", incomeCents: 125000, expensesCents: 3500 },
      { month: "2026-04", incomeCents: 0, expensesCents: 0 },
    ]);
    expect(summary.monthlyBreakdowns.map(({ month }) => month)).toEqual(["2026-03", "2026-04"]);
  });
});
