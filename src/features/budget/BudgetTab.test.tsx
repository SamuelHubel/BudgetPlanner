import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BudgetApiClient } from "../../api/budgetApi";
import type { Budget, BudgetActual, Category } from "../../types";
import { FinancialSummaryProvider } from "../home/FinancialSummaryContext";
import ResetDataDialog from "../settings/ResetDataDialog";
import BudgetTab from "./BudgetTab";

const categories: Category[] = [
  { id: 1, name: "Dining Out", type: "expense", color: "#f97316" },
  { id: 2, name: "Housing", type: "expense", color: "#8b5cf6" },
  { id: 3, name: "Pay", type: "income", color: "#14b8a6" },
];

type Seed = {
  budgets?: Budget[];
  actuals?: BudgetActual[];
  uncategorizedSpentCents?: number;
};

/** Builds a fake client backed by an in-memory set of monthly budgets. */
function createApi({
  budgets = [],
  actuals = [],
  uncategorizedSpentCents = 0,
}: Seed = {}) {
  const saved = new Map(budgets.map((budget) => [budget.month, budget]));
  const api = {
    isInitialized: async () => true,
    createPassword: async () => {},
    unlock: async () => {},
    lock: async () => {},
    resetVault: async () => {},
    listCategories: async () => categories,
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
    getCurrency: async () => "USD",
    resetFinancialData: async () => {},
    listGoals: async () => [],
    createGoal: async () => {
      throw new Error("not used");
    },
    updateGoal: async () => {
      throw new Error("not used");
    },
    deleteGoal: async () => {},
    getBudget: vi.fn(async (month: string) => {
      const budget = saved.get(month) ?? null;
      const earlier = [...saved.keys()]
        .filter((candidate) => candidate < month)
        .sort()
        .pop();
      return {
        month,
        budget,
        template:
          !budget && earlier !== undefined
            ? (saved.get(earlier) ?? null)
            : null,
        actuals,
        uncategorizedSpentCents,
      };
    }),
    saveBudget: vi.fn(async (budget: Budget) => {
      saved.set(budget.month, budget);
      return budget;
    }),
    deleteBudget: vi.fn(async (month: string) => {
      saved.delete(month);
    }),
  } satisfies BudgetApiClient;
  return api;
}

function renderBudget(api: BudgetApiClient) {
  return render(
    <FinancialSummaryProvider api={api}>
      <BudgetTab api={api} />
    </FinancialSummaryProvider>,
  );
}

async function continueWithIncome(
  user: ReturnType<typeof userEvent.setup>,
  income: string,
) {
  const field = await screen.findByLabelText("Expected monthly income");
  await user.clear(field);
  await user.type(field, income);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  return screen.findByRole("dialog", { name: /build your/i });
}

function setPercent(name: string, percent: number) {
  fireEvent.change(screen.getByRole("slider", { name: `${name} percent` }), {
    target: { value: String(percent) },
  });
}

const octoberBudget: Budget = {
  month: "2026-10",
  expectedIncomeCents: 500000,
  inputMode: "percent",
  allocations: [{ categoryId: 2, amountCents: 150000 }],
};

describe("BudgetTab", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks for income first, before showing the builder", async () => {
    renderBudget(createApi());

    expect(
      await screen.findByLabelText("Expected monthly income"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "October 2026" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rejects invalid income without opening the builder", async () => {
    const user = userEvent.setup();
    renderBudget(createApi());

    await user.type(
      await screen.findByLabelText("Expected monthly income"),
      "lots",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/as a number/i);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires income before continuing", async () => {
    const user = userEvent.setup();
    renderBudget(createApi());
    await screen.findByLabelText("Expected monthly income");

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/expected income/i);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists only expense categories in the builder", async () => {
    const user = userEvent.setup();
    renderBudget(createApi());

    const dialog = await continueWithIncome(user, "5000");

    expect(
      within(dialog).getByRole("slider", { name: "Housing percent" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("slider", { name: "Dining Out percent" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("slider", { name: "Pay percent" }),
    ).not.toBeInTheDocument();
  });

  it("saves slider allocations as cents and shows the saved view", async () => {
    const user = userEvent.setup();
    const api = createApi();
    renderBudget(api);
    await continueWithIncome(user, "5000");

    setPercent("Housing", 30);
    setPercent("Dining Out", 12.5);
    expect(
      screen.getByRole("img", { name: /42\.5% of income allocated/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save budget" }));

    expect(api.saveBudget).toHaveBeenCalledWith({
      month: "2026-10",
      expectedIncomeCents: 500000,
      inputMode: "percent",
      allocations: [
        { categoryId: 1, amountCents: 62500 },
        { categoryId: 2, amountCents: 150000 },
      ],
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("table", { name: "Budget for October 2026" }),
    ).toBeInTheDocument();
  });

  it("maps typed amounts to percent scores on the donut", async () => {
    const user = userEvent.setup();
    const api = createApi();
    renderBudget(api);
    await continueWithIncome(user, "5000");

    await user.click(screen.getByRole("button", { name: "Amount" }));
    await user.type(
      screen.getByRole("textbox", { name: "Housing amount" }),
      "1250.50",
    );

    expect(
      screen.getByRole("img", { name: /25% of income allocated/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save budget" }));
    expect(api.saveBudget).toHaveBeenCalledWith(
      expect.objectContaining({
        inputMode: "amount",
        allocations: [{ categoryId: 2, amountCents: 125050 }],
      }),
    );
  });

  it("converts values when switching input modes", async () => {
    const user = userEvent.setup();
    renderBudget(createApi());
    await continueWithIncome(user, "5000");

    setPercent("Housing", 30);
    await user.click(screen.getByRole("button", { name: "Amount" }));
    const amount = screen.getByRole("textbox", { name: "Housing amount" });
    expect(amount).toHaveValue("1500");

    await user.clear(amount);
    await user.type(amount, "2500");
    await user.click(screen.getByRole("button", { name: "Percent" }));

    expect(screen.getByRole("slider", { name: "Housing percent" })).toHaveValue(
      "50",
    );
  });

  it("blocks saving an invalid typed amount", async () => {
    const user = userEvent.setup();
    const api = createApi();
    renderBudget(api);
    await continueWithIncome(user, "5000");
    await user.click(screen.getByRole("button", { name: "Amount" }));

    await user.type(
      screen.getByRole("textbox", { name: "Housing amount" }),
      "abc",
    );
    await user.click(screen.getByRole("button", { name: "Save budget" }));

    expect(api.saveBudget).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/housing amount/i);
  });

  describe("over-allocation warning", () => {
    const warning = () => screen.queryByText(/more than you expect to earn/i);

    it("warns as soon as allocations pass 100%", async () => {
      const user = userEvent.setup();
      renderBudget(createApi());
      await continueWithIncome(user, "5000");

      setPercent("Housing", 80);
      setPercent("Dining Out", 32);

      const alert = warning();
      expect(alert).toHaveAttribute("role", "alert");
      expect(alert).toHaveTextContent("112%");
      expect(alert).toHaveTextContent("$600.00");
      expect(alert).toHaveTextContent(/savings or going into debt/i);
    });

    it("does not warn at exactly 100%", async () => {
      const user = userEvent.setup();
      renderBudget(createApi());
      await continueWithIncome(user, "5000");

      setPercent("Housing", 70);
      setPercent("Dining Out", 30);

      expect(warning()).not.toBeInTheDocument();
    });

    it("clears after reducing back to 100%", async () => {
      const user = userEvent.setup();
      renderBudget(createApi());
      await continueWithIncome(user, "5000");

      setPercent("Housing", 80);
      setPercent("Dining Out", 32);
      setPercent("Dining Out", 20);

      expect(warning()).not.toBeInTheDocument();
    });

    it("does not block saving", async () => {
      const user = userEvent.setup();
      const api = createApi();
      renderBudget(api);
      await continueWithIncome(user, "5000");

      setPercent("Housing", 80);
      setPercent("Dining Out", 32);
      await user.click(screen.getByRole("button", { name: "Save budget" }));

      expect(api.saveBudget).toHaveBeenCalledOnce();
    });
  });

  it("returns to the income step when cancelling, without saving", async () => {
    const user = userEvent.setup();
    const api = createApi();
    renderBudget(api);
    await continueWithIncome(user, "5000");

    setPercent("Housing", 30);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.saveBudget).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Expected monthly income")).toHaveValue(
      "5000",
    );
  });

  it("keeps the builder open with the error when saving fails", async () => {
    const user = userEvent.setup();
    const api = createApi();
    api.saveBudget.mockRejectedValueOnce("database is locked");
    renderBudget(api);
    await continueWithIncome(user, "5000");

    await user.click(screen.getByRole("button", { name: "Save budget" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "database is locked",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("pre-fills a new month from the nearest earlier budget", async () => {
    const user = userEvent.setup();
    renderBudget(
      createApi({ budgets: [{ ...octoberBudget, month: "2026-09" }] }),
    );

    expect(await screen.findByLabelText("Expected monthly income")).toHaveValue(
      "5000",
    );
    expect(screen.getByText(/starting from september 2026/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByRole("slider", { name: "Housing percent" }),
    ).toHaveValue("30");
  });

  it("keeps percents when a percent budget's income changes", async () => {
    const user = userEvent.setup();
    const api = createApi({ budgets: [octoberBudget] });
    renderBudget(api);

    await user.click(
      await screen.findByRole("button", { name: "Edit budget" }),
    );
    await continueWithIncome(user, "6000");
    await user.click(screen.getByRole("button", { name: "Save budget" }));

    expect(api.saveBudget).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedIncomeCents: 600000,
        allocations: [{ categoryId: 2, amountCents: 180000 }],
      }),
    );
  });

  it("keeps amounts when an amount budget's income changes", async () => {
    const user = userEvent.setup();
    const api = createApi({
      budgets: [{ ...octoberBudget, inputMode: "amount" }],
    });
    renderBudget(api);

    await user.click(
      await screen.findByRole("button", { name: "Edit budget" }),
    );
    const dialog = await continueWithIncome(user, "6000");

    expect(
      within(dialog).getByRole("textbox", { name: "Housing amount" }),
    ).toHaveValue("1500");
  });

  it("shows budgeted, actual, and remaining per category", async () => {
    renderBudget(
      createApi({
        budgets: [octoberBudget],
        actuals: [
          { categoryId: 2, spentCents: 100000 },
          { categoryId: 1, spentCents: 2500 },
        ],
        uncategorizedSpentCents: 1200,
      }),
    );

    const table = await screen.findByRole("table", {
      name: "Budget for October 2026",
    });
    const housing = within(table).getByRole("row", { name: /^Housing/ });
    expect(housing).toHaveTextContent("$1,500.00");
    expect(housing).toHaveTextContent("$1,000.00");
    expect(housing).toHaveTextContent("$500.00");
    // Spending in a category without an allocation is still shown.
    const dining = within(table).getByRole("row", { name: /^Dining Out/ });
    expect(dining).toHaveTextContent("$0.00");
    expect(dining).toHaveTextContent(/over by \$25\.00/i);
    expect(
      within(table).getByRole("row", { name: /^Uncategorized/ }),
    ).toHaveTextContent("$12.00");
  });

  it("repeats the warning on a saved budget above 100%", async () => {
    renderBudget(
      createApi({
        budgets: [
          {
            ...octoberBudget,
            allocations: [{ categoryId: 2, amountCents: 560000 }],
          },
        ],
      }),
    );

    expect(
      await screen.findByText(/more than you expect to earn/i),
    ).toBeInTheDocument();
  });

  it("moves between months", async () => {
    const user = userEvent.setup();
    const api = createApi({ budgets: [octoberBudget] });
    renderBudget(api);
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Next month" }));

    expect(
      await screen.findByRole("heading", { name: "November 2026" }),
    ).toBeInTheDocument();
    expect(api.getBudget).toHaveBeenLastCalledWith("2026-11");
    expect(await screen.findByLabelText("Expected monthly income")).toHaveValue(
      "5000",
    );
  });

  it("deletes a budget after confirmation", async () => {
    const user = userEvent.setup();
    const api = createApi({ budgets: [octoberBudget] });
    renderBudget(api);

    await user.click(
      await screen.findByRole("button", { name: "Delete budget" }),
    );
    const confirm = await screen.findByRole("alertdialog");
    await user.click(
      within(confirm).getByRole("button", { name: "Delete budget" }),
    );

    expect(api.deleteBudget).toHaveBeenCalledWith("2026-10");
    expect(
      await screen.findByLabelText("Expected monthly income"),
    ).toBeInTheDocument();
  });

  it("drops a deleted budget after Start over", async () => {
    const user = userEvent.setup();
    const api = createApi({ budgets: [octoberBudget] });
    api.resetFinancialData = async () => {
      await api.deleteBudget("2026-10");
    };
    render(
      <FinancialSummaryProvider api={api}>
        <ResetDataDialog api={api} />
        <BudgetTab api={api} />
      </FinancialSummaryProvider>,
    );
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Start over" }));
    await user.click(
      await screen.findByRole("button", { name: "Delete financial data" }),
    );

    expect(
      await screen.findByLabelText("Expected monthly income"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows load failures", async () => {
    const api = createApi();
    api.getBudget.mockRejectedValue("database is locked");
    renderBudget(api);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "database is locked",
    );
  });
});
