import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BudgetApiClient } from "../../api/budgetApi";
import type { CategorySettings } from "../../types";

import HomeTab from "./HomeTab";
import { FinancialSummaryProvider } from "./FinancialSummaryContext";
import { useFinancialSummary } from "./useFinancialSummary";

const salary = {
  id: 1,
  name: "Salary",
  type: "income" as const,
  color: "#14b8a6",
};
const groceries = {
  id: 2,
  name: "Groceries",
  type: "expense" as const,
  color: "#22c55e",
};
const housing = {
  id: 3,
  name: "Housing",
  type: "expense" as const,
  color: null,
};
const emptySources = { largestIncomeSources: [], largestExpenses: [] };
const summary = {
  breakdown: {
    income: [{ category: salary, amountCents: 250000, subcategories: [] }],
    expenses: [
      { category: groceries, amountCents: 7500, subcategories: [] },
      { category: housing, amountCents: 90000, subcategories: [] },
    ],
    ...emptySources,
    uncategorizedCents: 0,
    uncategorizedIncomeCents: 0,
    uncategorizedExpensesCents: 0,
  },
  monthlyTotals: [
    {
      month: "2026-01",
      incomeCents: 250000,
      expensesCents: 7500,
    },
    {
      month: "2026-02",
      incomeCents: 0,
      expensesCents: 90000,
    },
  ],
  monthlyBreakdowns: [
    {
      month: "2026-01",
      breakdown: {
        income: [{ category: salary, amountCents: 250000, subcategories: [] }],
        expenses: [
          { category: groceries, amountCents: 7500, subcategories: [] },
        ],
        ...emptySources,
        uncategorizedCents: 0,
        uncategorizedIncomeCents: 0,
        uncategorizedExpensesCents: 0,
      },
    },
    {
      month: "2026-02",
      breakdown: {
        income: [],
        expenses: [
          { category: housing, amountCents: 90000, subcategories: [] },
        ],
        ...emptySources,
        uncategorizedCents: 0,
        uncategorizedIncomeCents: 0,
        uncategorizedExpensesCents: 0,
      },
    },
  ],
};
const api: BudgetApiClient = {
  isInitialized: async () => true,
  createPassword: async () => {},
  unlock: async () => {},
  lock: async () => {},
  resetVault: async () => {},
  listCategories: async () => [],
  previewImport: async () => [],
  commitImport: async () => ({ inserted: 0, skippedDuplicates: 0 }),
  getFinancialSummary: vi.fn(async () => summary),
  listSubcategories: async () => [],
  getCategorySettings: async () => ({
    useSubcategoriesOnImport: true,
    showSubcategoryCharts: true,
  }),
  updateCategorySettings: async (settings) => settings,
  getCurrency: vi.fn(async () => "USD"),
  resetFinancialData: async () => {},
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

function FinancialSummaryRefreshProbe() {
  const { summary, refresh } = useFinancialSummary();
  return (
    <>
      <p>{summary?.breakdown.income[0]?.amountCents ?? "Loading"}</p>
      <button type="button" onClick={refresh}>
        Refresh summary
      </button>
    </>
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("financial summary state", () => {
  it("refreshes summary data through the shared hook", async () => {
    const firstSummary = {
      ...summary,
      breakdown: {
        ...summary.breakdown,
        income: [{ category: salary, amountCents: 100, subcategories: [] }],
      },
    };
    const refreshedSummary = {
      ...summary,
      breakdown: {
        ...summary.breakdown,
        income: [{ category: salary, amountCents: 200, subcategories: [] }],
      },
    };
    const refreshApi: BudgetApiClient = {
      ...api,
      getFinancialSummary: vi
        .fn()
        .mockResolvedValueOnce(firstSummary)
        .mockResolvedValueOnce(refreshedSummary),
    };
    const user = userEvent.setup();
    render(
      <FinancialSummaryProvider api={refreshApi}>
        <FinancialSummaryRefreshProbe />
      </FinancialSummaryProvider>,
    );

    expect(await screen.findByText("100")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh summary" }));
    expect(await screen.findByText("200")).toBeInTheDocument();
  });
});

describe("HomeTab subcategory drill-down", () => {
  const dining = {
    id: 4,
    name: "Dining Out",
    type: "expense" as const,
    color: "#f97316",
  };
  const diningTotal = {
    category: dining,
    amountCents: 4000,
    subcategories: [
      {
        subcategoryId: 40,
        name: "Coffee",
        color: null,
        amountCents: 3000,
      },
      {
        subcategoryId: null,
        name: "General",
        color: null,
        amountCents: 1000,
      },
    ],
  };
  const groceriesGeneralOnly = {
    category: groceries,
    amountCents: 7500,
    subcategories: [
      {
        subcategoryId: null,
        name: "General",
        color: null,
        amountCents: 7500,
      },
    ],
  };
  const empty = {
    income: [],
    ...emptySources,
    uncategorizedCents: 0,
    uncategorizedIncomeCents: 0,
    uncategorizedExpensesCents: 0,
  };
  const drillSummary = {
    breakdown: { ...empty, expenses: [diningTotal, groceriesGeneralOnly] },
    monthlyTotals: [],
    monthlyBreakdowns: [
      {
        month: "2026-01",
        breakdown: {
          ...empty,
          expenses: [diningTotal, groceriesGeneralOnly],
        },
      },
      {
        month: "2026-02",
        breakdown: { ...empty, expenses: [groceriesGeneralOnly] },
      },
    ],
  };

  function renderHome(overrides: Partial<BudgetApiClient> = {}) {
    const drillApi: BudgetApiClient = {
      ...api,
      getFinancialSummary: async () => drillSummary,
      ...overrides,
    };
    render(
      <FinancialSummaryProvider api={drillApi}>
        <HomeTab api={drillApi} />
      </FinancialSummaryProvider>,
    );
  }

  async function openDiningOut(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByRole("heading", { name: "Expenses" });
    await user.click(screen.getByRole("button", { name: "January 2026" }));
    await user.click(screen.getByRole("button", { name: /^Dining Out:/ }));
  }

  it("swaps the donut to subcategories and back", async () => {
    const user = userEvent.setup();
    renderHome();

    await openDiningOut(user);

    expect(
      screen.getByRole("heading", { name: "Dining Out" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Coffee:/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^General:/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Groceries:/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to Expenses" }));

    expect(
      screen.getByRole("heading", { name: "Expenses" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Groceries:/ }),
    ).toBeInTheDocument();
  });

  it("keeps the highlight behavior for a category with only General activity", async () => {
    const user = userEvent.setup();
    renderHome();
    await screen.findByRole("heading", { name: "Expenses" });

    const groceriesButton = screen.getByRole("button", {
      name: /^Groceries:/,
    });
    await user.click(groceriesButton);

    expect(groceriesButton).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByRole("button", { name: /^Back to/ }),
    ).not.toBeInTheDocument();
  });

  it("returns to the main donut when the month has no such category", async () => {
    const user = userEvent.setup();
    renderHome();
    await openDiningOut(user);

    await user.click(screen.getByRole("button", { name: "February 2026" }));

    expect(
      screen.getByRole("heading", { name: "Expenses" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Back to/ }),
    ).not.toBeInTheDocument();
  });

  it("persists the switch and stops drilling in when it is off", async () => {
    const user = userEvent.setup();
    const updateCategorySettings = vi.fn(
      async (settings: CategorySettings) => settings,
    );
    renderHome({ updateCategorySettings });
    await screen.findByRole("heading", { name: "Expenses" });
    await user.click(screen.getByRole("button", { name: "January 2026" }));

    await user.click(
      screen.getByRole("checkbox", { name: "Show subcategory charts" }),
    );
    await user.click(screen.getByRole("button", { name: /^Dining Out:/ }));

    expect(updateCategorySettings).toHaveBeenCalledWith({
      useSubcategoriesOnImport: true,
      showSubcategoryCharts: false,
    });
    expect(
      screen.getByRole("heading", { name: "Expenses" }),
    ).toBeInTheDocument();
  });

  it("restores the switch and reports the failure when saving it fails", async () => {
    const user = userEvent.setup();
    renderHome({
      updateCategorySettings: async () => {
        throw new Error("disk full");
      },
    });
    await screen.findByRole("heading", { name: "Expenses" });
    const toggle = screen.getByRole("checkbox", {
      name: "Show subcategory charts",
    });

    await user.click(toggle);

    expect(await screen.findByRole("alert")).toHaveTextContent("disk full");
    expect(toggle).toBeChecked();
  });
});

describe("HomeTab category charts", () => {
  it("shows a category popup while a chart legend item is hovered", async () => {
    const user = userEvent.setup();
    render(
      <FinancialSummaryProvider api={api}>
        <HomeTab api={api} />
      </FinancialSummaryProvider>,
    );

    await screen.findByRole("heading", { name: "Expenses" });
    await user.click(screen.getByRole("button", { name: "January 2026" }));
    expect(screen.queryByText("By category")).not.toBeInTheDocument();
    expect(screen.queryByText("Largest sources")).not.toBeInTheDocument();
    const expenses = within(screen.getByRole("region", { name: "Expenses" }));
    const groceries = within(expenses.getByRole("list")).getByRole("button", {
      name: /^Groceries:/,
    });
    expect(groceries).not.toHaveTextContent("$75.00");
    await user.hover(groceries);

    expect(screen.getByRole("status")).toHaveTextContent("Groceries");
    expect(screen.getByRole("status")).toHaveTextContent("$75.00");

    await user.unhover(groceries);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.blur(groceries);
    fireEvent.focus(groceries);
    expect(screen.getByRole("status")).toHaveTextContent("Groceries");
    expect(screen.getByRole("status")).toHaveTextContent("$75.00");
  });

  it("keeps a category highlighted when its legend item is selected", async () => {
    const user = userEvent.setup();
    render(
      <FinancialSummaryProvider api={api}>
        <HomeTab api={api} />
      </FinancialSummaryProvider>,
    );

    await screen.findByRole("heading", { name: "Expenses" });
    await user.click(screen.getByRole("button", { name: "January 2026" }));
    const expenses = within(screen.getByRole("region", { name: "Expenses" }));
    const groceries = within(expenses.getByRole("list")).getByRole("button", {
      name: /^Groceries:/,
    });
    await user.click(groceries);

    expect(groceries).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Groceries");
  });

  it("exposes category selection through the accessible legend", async () => {
    const user = userEvent.setup();
    render(
      <FinancialSummaryProvider api={api}>
        <HomeTab api={api} />
      </FinancialSummaryProvider>,
    );

    await screen.findByRole("heading", { name: "Expenses" });
    await user.click(screen.getByRole("button", { name: "January 2026" }));
    const expenses = within(screen.getByRole("region", { name: "Expenses" }));
    const groceries = within(expenses.getByRole("list")).getByRole("button", {
      name: "Groceries: $75.00",
    });
    await user.click(groceries);

    expect(groceries).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Groceries");
    expect(screen.getByRole("status")).toHaveTextContent("$75.00");
  });

  it("defaults to the latest tracked month and replots income and expenses when a month is selected", async () => {
    const user = userEvent.setup();
    render(
      <FinancialSummaryProvider api={api}>
        <HomeTab api={api} />
      </FinancialSummaryProvider>,
    );

    const monthlyChart = await screen.findByRole("region", {
      name: "Income and expenses by month",
    });
    const monthList = within(
      screen.getByRole("region", { name: "Tracked months" }),
    );
    const february = monthList.getByRole("button", { name: "February 2026" });
    const january = monthList.getByRole("button", { name: "January 2026" });
    expect(february).toHaveAttribute("aria-pressed", "true");
    expect(january).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText("Showing income and expenses for February 2026"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: /Income chart/ })).getByText(
        "$0.00",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: /Expenses chart/ })).getByText(
        "$900.00",
      ),
    ).toBeInTheDocument();
    expect(
      within(monthlyChart).getByRole("listitem", {
        name: "Jan 2026: income $2,500.00, expenses $75.00",
      }),
    ).toBeInTheDocument();
    expect(
      within(monthlyChart).getByRole("listitem", {
        name: "Feb 2026: income $0.00, expenses $900.00",
      }),
    ).toBeInTheDocument();

    await user.click(january);

    expect(january).toHaveAttribute("aria-pressed", "true");
    expect(february).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText("Showing income and expenses for January 2026"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: /Income chart/ })).getByText(
        "$2,500.00",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: /Expenses chart/ })).getByText(
        "$75.00",
      ),
    ).toBeInTheDocument();
  });

  it("shows all-time totals when All time is selected", async () => {
    const user = userEvent.setup();
    render(
      <FinancialSummaryProvider api={api}>
        <HomeTab api={api} />
      </FinancialSummaryProvider>,
    );

    await screen.findByRole("heading", { name: "Expenses" });
    const allTime = screen.getByRole("button", { name: "All time" });
    expect(allTime).toHaveAttribute("aria-pressed", "false");

    await user.click(allTime);

    expect(allTime).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "February 2026" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText("Showing income and expenses for all time"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: /Expenses chart/ })).getByText(
        "$975.00",
      ),
    ).toBeInTheDocument();
  });

  it("shows uncategorized totals as a separate bucket", async () => {
    const user = userEvent.setup();
    const apiWithUncategorized: BudgetApiClient = {
      ...api,
      getFinancialSummary: async () => ({
        ...summary,
        breakdown: {
          ...summary.breakdown,
          uncategorizedCents: -1234,
          uncategorizedIncomeCents: 0,
          uncategorizedExpensesCents: 1234,
        },
        monthlyBreakdowns: summary.monthlyBreakdowns.map((month) => ({
          ...month,
          breakdown: {
            ...month.breakdown,
            uncategorizedCents: -1234,
            uncategorizedIncomeCents: 0,
            uncategorizedExpensesCents: 1234,
          },
        })),
      }),
      getCurrency: vi.fn(async () => "USD"),
    };
    render(
      <FinancialSummaryProvider api={apiWithUncategorized}>
        <HomeTab api={apiWithUncategorized} />
      </FinancialSummaryProvider>,
    );

    await screen.findByRole("heading", { name: "Expenses" });
    await user.click(screen.getByRole("button", { name: "January 2026" }));

    expect(
      screen.getByRole("region", { name: "Uncategorized transactions" }),
    ).toHaveTextContent("-$12.34");
    expect(
      within(
        within(screen.getByRole("region", { name: "Expenses" })).getByRole(
          "list",
        ),
      ).getByRole("button", {
        name: "Uncategorized: $12.34",
      }),
    ).toBeInTheDocument();
  });
});
