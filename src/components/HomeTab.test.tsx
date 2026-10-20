import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BudgetApiClient } from "../api/budgetApi";

import HomeTab from "./HomeTab";

const salary = { id: 1, name: "Salary", type: "income" as const, color: "#14b8a6" };
const groceries = { id: 2, name: "Groceries", type: "expense" as const, color: "#22c55e" };
const housing = { id: 3, name: "Housing", type: "expense" as const, color: null };
const emptySources = { largestIncomeSources: [], largestExpenses: [] };
const summary = {
  breakdown: {
    income: [{ category: salary, amountCents: 250000 }],
    expenses: [
      { category: groceries, amountCents: 7500 },
      { category: housing, amountCents: 90000 },
    ],
    ...emptySources,
    uncategorizedCents: 0,
  },
  monthlyTotals: [
    { month: "2026-01", incomeCents: 250000, expensesCents: 7500, uncategorizedCents: 0 },
    { month: "2026-02", incomeCents: 0, expensesCents: 90000, uncategorizedCents: 0 },
  ],
  monthlyBreakdowns: [
    {
      month: "2026-01",
      breakdown: {
        income: [{ category: salary, amountCents: 250000 }],
        expenses: [{ category: groceries, amountCents: 7500 }],
        ...emptySources,
        uncategorizedCents: 0,
      },
    },
    {
      month: "2026-02",
      breakdown: {
        income: [],
        expenses: [{ category: housing, amountCents: 90000 }],
        ...emptySources,
        uncategorizedCents: 0,
      },
    },
  ],
};
const api: BudgetApiClient = {
  unlock: async () => {},
  lock: async () => {},
  listCategories: async () => [],
  previewImport: async () => [],
  commitImport: async () => ({ inserted: 0, skippedDuplicates: 0 }),
  getFinancialSummary: vi.fn(async () => summary),
  resetFinancialData: async () => {},
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("HomeTab category charts", () => {
  it("shows a category popup while a chart legend item is hovered", async () => {
    const user = userEvent.setup();
    render(<HomeTab api={api} />);

    await screen.findByRole("heading", { name: "Expenses" });
    await user.click(screen.getByRole("button", { name: "January 2026" }));
    expect(screen.queryByText("By category")).not.toBeInTheDocument();
    expect(screen.queryByText("Largest sources")).not.toBeInTheDocument();
    const expenses = within(screen.getByRole("region", { name: "Expenses" }));
    const groceries = within(expenses.getByRole("list")).getByRole("button", { name: "Groceries" });
    expect(groceries).not.toHaveTextContent("$75.00");
    await user.hover(groceries);

    expect(screen.getByRole("status")).toHaveTextContent("Groceries");
    expect(screen.getByRole("status")).toHaveTextContent("$75.00");

    await user.unhover(groceries);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps a category highlighted when its legend item is selected", async () => {
    const user = userEvent.setup();
    render(<HomeTab api={api} />);

    await screen.findByRole("heading", { name: "Expenses" });
    await user.click(screen.getByRole("button", { name: "January 2026" }));
    const expenses = within(screen.getByRole("region", { name: "Expenses" }));
    const groceries = within(expenses.getByRole("list")).getByRole("button", { name: "Groceries" });
    await user.click(groceries);

    expect(groceries).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Groceries");
  });

  it("selects a category directly from its chart segment", async () => {
    const user = userEvent.setup();
    render(<HomeTab api={api} />);

    await screen.findByRole("heading", { name: "Expenses" });
    await user.click(screen.getByRole("button", { name: "January 2026" }));
    const expensesChart = within(screen.getByRole("group", { name: /Expenses chart/ }));
    const groceries = expensesChart.getByRole("button", { name: "Groceries: $75.00" });
    await user.click(groceries);

    expect(groceries).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Groceries");
    expect(screen.getByRole("status")).toHaveTextContent("$75.00");
  });

  it("defaults to the latest tracked month and replots income and expenses when a month is selected", async () => {
    const user = userEvent.setup();
    render(<HomeTab api={api} />);

    const monthlyChart = await screen.findByRole("region", { name: "Income and expenses by month" });
    const monthList = within(screen.getByRole("region", { name: "Tracked months" }));
    const february = monthList.getByRole("button", { name: "February 2026" });
    const january = monthList.getByRole("button", { name: "January 2026" });
    expect(february).toHaveAttribute("aria-pressed", "true");
    expect(january).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Showing income and expenses for February 2026")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: /Income chart/ })).getByText("$0.00")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: /Expenses chart/ })).getByText("$900.00")).toBeInTheDocument();
    expect(within(monthlyChart).getByRole("listitem", {
      name: "Jan 2026: income $2,500.00, expenses $75.00",
    })).toBeInTheDocument();
    expect(within(monthlyChart).getByRole("listitem", {
      name: "Feb 2026: income $0.00, expenses $900.00",
    })).toBeInTheDocument();

    await user.click(january);

    expect(january).toHaveAttribute("aria-pressed", "true");
    expect(february).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Showing income and expenses for January 2026")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: /Income chart/ })).getByText("$2,500.00")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: /Expenses chart/ })).getByText("$75.00")).toBeInTheDocument();
  });

  it("shows uncategorized totals as a separate bucket", async () => {
    const user = userEvent.setup();
    const apiWithUncategorized: BudgetApiClient = {
      ...api,
      getFinancialSummary: async () => ({
        ...summary,
        breakdown: { ...summary.breakdown, uncategorizedCents: -1234 },
        monthlyBreakdowns: summary.monthlyBreakdowns.map((month) => ({
          ...month,
          breakdown: { ...month.breakdown, uncategorizedCents: -1234 },
        })),
      }),
    };
    render(<HomeTab api={apiWithUncategorized} />);

    await screen.findByRole("heading", { name: "Expenses" });
    await user.click(screen.getByRole("button", { name: "January 2026" }));

    expect(screen.getByRole("region", { name: "Uncategorized transactions" })).toHaveTextContent("-$12.34");
  });
});
