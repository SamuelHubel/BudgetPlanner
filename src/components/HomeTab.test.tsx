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
    { categoryId: 1, amount: 2500, description: "Paycheck" },
    { categoryId: 2, amount: -75, description: "Market" },
    { categoryId: 3, amount: -900, description: "Rent" },
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
    const expenses = within(screen.getByRole("region", { name: "Expenses" }));
    const groceries = within(expenses.getByRole("list")).getByRole("button", { name: "Groceries: $75.00" });
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
    const expenses = within(screen.getByRole("region", { name: "Expenses" }));
    const groceries = within(expenses.getByRole("list")).getByRole("button", { name: "Groceries: $75.00" });
    await user.click(groceries);

    expect(groceries).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Groceries");
    expect(within(expenses.getByRole("list")).getByRole("button", { name: "Housing: $900.00" })).toHaveAttribute("aria-pressed", "false");
  });

  it("selects a category directly from its chart segment", async () => {
    const user = userEvent.setup();
    render(<HomeTab />);

    await screen.findByRole("heading", { name: "Expenses" });
    const expensesChart = within(screen.getByRole("group", { name: /Expenses chart/ }));
    const groceries = expensesChart.getByRole("button", { name: "Groceries: $75.00" });
    await user.click(groceries);

    expect(groceries).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Groceries");
    expect(screen.getByRole("status")).toHaveTextContent("$75.00");
  });
});
