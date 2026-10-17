import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { categories, transactions } = vi.hoisted(() => ({
  categories: [
    { id: 1, name: "Salary", type: "income", color: "#14b8a6" },
    { id: 2, name: "Groceries", type: "expense", color: "#22c55e" },
    { id: 3, name: "Housing", type: "expense", color: null },
  ],
  transactions: [
    { categoryId: 1, amount: 2500, description: "Paycheck", date: "2026-01-15" },
    { categoryId: 2, amount: -75, description: "Market", date: "2026-01-18" },
    { categoryId: 3, amount: -900, description: "Rent", date: "2026-02-01" },
  ],
}));

vi.mock("../lib/db", () => ({
  getDb: vi.fn(async () => ({
    select: vi.fn(async (query: string) =>
      query.includes("FROM categories") ? categories : transactions,
    ),
  })),
}));

import HomeTab from "./HomeTab";

afterEach(() => {
  vi.clearAllMocks();
});

describe("HomeTab category charts", () => {
  it("shows a category popup while a chart legend item is hovered", async () => {
    const user = userEvent.setup();
    render(<HomeTab />);

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
    render(<HomeTab />);

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
    render(<HomeTab />);

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
    render(<HomeTab />);

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
});
