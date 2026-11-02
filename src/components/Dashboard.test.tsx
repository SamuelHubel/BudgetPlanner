import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BudgetApiClient } from "../api/budgetApi";

vi.mock("../features/home/HomeTab", () => ({
  default: () => <div>Home content</div>,
}));
vi.mock("../features/ai/AITab", () => ({
  default: () => <div>AI content</div>,
}));
vi.mock("../features/goals/GoalsTab", () => ({
  default: () => <div>Goals content</div>,
}));

import Dashboard from "./Dashboard";

const resetFinancialData = vi.fn(async () => {});
const api: BudgetApiClient = {
  isInitialized: async () => true,
  createPassword: async () => {},
  unlock: async () => {},
  lock: async () => {},
  resetVault: async () => {},
  listCategories: async () => [],
  previewImport: async () => [],
  commitImport: async () => ({ inserted: 0, skippedDuplicates: 0 }),
  getFinancialSummary: async () => ({
    breakdown: {
      income: [],
      expenses: [],
      largestIncomeSources: [],
      largestExpenses: [],
      uncategorizedCents: 0,
      uncategorizedIncomeCents: 0,
      uncategorizedExpensesCents: 0,
    },
    monthlyTotals: [],
    monthlyBreakdowns: [],
  }),
  listSubcategories: async () => [],
  getCategorySettings: async () => ({
    useSubcategoriesOnImport: true,
    showSubcategoryCharts: true,
  }),
  updateCategorySettings: async (settings) => settings,
  getCurrency: async () => "USD",
  resetFinancialData,
  listGoals: async () => [],
  createGoal: async () => {
    throw new Error("not used");
  },
  updateGoal: async () => {
    throw new Error("not used");
  },
  deleteGoal: async () => {},
  getBudget: async (month) => ({
    month,
    budget: null,
    template: null,
    actuals: [],
    uncategorizedSpentCents: 0,
  }),
  saveBudget: async (budget) => budget,
  deleteBudget: async () => {},
};

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

function renderDashboard() {
  return render(
    <Dashboard
      api={api}
      onLock={vi.fn(async () => true)}
      lockError=""
      activeTab="home"
      onTabChange={vi.fn()}
    />,
  );
}

describe("Dashboard reset action", () => {
  it("associates each dashboard tab with an existing labeled panel", () => {
    renderDashboard();

    const tabs = screen.getAllByRole("tab");
    expect(
      screen.getByRole("tablist", { name: "Dashboard sections" }),
    ).toBeInTheDocument();
    expect(tabs).toHaveLength(4);
    for (const tab of tabs) {
      const panel = document.getElementById(
        tab.getAttribute("aria-controls") ?? "",
      );
      expect(panel).toHaveAttribute("role", "tabpanel");
      expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    }
  });

  it("requires confirmation before clearing financial data", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole("button", { name: /start over/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(resetFinancialData).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(resetFinancialData).not.toHaveBeenCalled();
  });

  it("resets after confirmation and reports success", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole("button", { name: /start over/i }));
    await user.click(
      screen.getByRole("button", { name: /delete financial data/i }),
    );

    expect(resetFinancialData).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /financial data has been cleared/i,
    );
    expect(
      screen.queryByText(/categories and keyword rules/i),
    ).not.toBeInTheDocument();
  });

  it("clears the success notice after 30 seconds", async () => {
    vi.useFakeTimers();
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: /start over/i }));
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /delete financial data/i }),
      );
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      /financial data has been cleared/i,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_999);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps the confirmation open and shows database errors", async () => {
    resetFinancialData.mockRejectedValueOnce(new Error("database unavailable"));
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole("button", { name: /start over/i }));
    expect(screen.getByRole("alertdialog")).not.toHaveTextContent(
      /categories and keyword rules/i,
    );
    await user.click(
      screen.getByRole("button", { name: /delete financial data/i }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      /database unavailable/i,
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
