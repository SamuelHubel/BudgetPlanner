import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BudgetApiClient } from "../../api/budgetApi";
import type {
  Budget,
  Category,
  Goal,
  GoalInput,
  GoalProgress,
} from "../../types";
import { FinancialSummaryProvider } from "../home/FinancialSummaryContext";
import { useFinancialSummary } from "../home/useFinancialSummary";
import ResetDataDialog from "../settings/ResetDataDialog";
import GoalsTab from "./GoalsTab";

const categories: Category[] = [
  { id: 3, name: "Pay", type: "income", color: "#14b8a6" },
  { id: 4, name: "Dining Out", type: "expense", color: "#f97316" },
];

/** Builds a fake client backed by an in-memory, newest-first goal list. */
function createApi(
  initialGoals: Goal[] = [],
  progressFor: (input: GoalInput) => GoalProgress | null = () => null,
) {
  let goals = [...initialGoals];
  let nextId = Math.max(0, ...goals.map(({ id }) => id)) + 1;
  const toGoal = (id: number, input: GoalInput): Goal => ({
    id,
    ...input,
    createdAt: "2026-10-29T00:00:00.000Z",
    progress: progressFor(input),
  });
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
    resetFinancialData: async () => {
      goals = [];
    },
    listGoals: vi.fn(async () => goals),
    createGoal: vi.fn(async (input: GoalInput) => {
      const goal = toGoal(nextId++, input);
      goals = [goal, ...goals];
      return goal;
    }),
    updateGoal: vi.fn(async (id: number, input: GoalInput) => {
      const goal = toGoal(id, input);
      goals = goals.map((existing) => (existing.id === id ? goal : existing));
      return goal;
    }),
    deleteGoal: vi.fn(async (id: number) => {
      goals = goals.filter((goal) => goal.id !== id);
    }),
    getBudget: async (month: string) => ({
      month,
      budget: null,
      template: null,
      actuals: [],
      uncategorizedSpentCents: 0,
    }),
    saveBudget: async (budget: Budget) => budget,
    deleteBudget: async () => {},
  } satisfies BudgetApiClient;
  return api;
}

function goal(id: number, title: string, overrides: Partial<Goal> = {}): Goal {
  return {
    id,
    title,
    categoryId: null,
    spendingLimitCents: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    progress: null,
    ...overrides,
  };
}

function renderGoals(api: BudgetApiClient) {
  return render(
    <FinancialSummaryProvider api={api}>
      <GoalsTab api={api} />
    </FinancialSummaryProvider>,
  );
}

async function goalTexts() {
  const list = await screen.findByRole("list", { name: "Your goals" });
  return within(list)
    .getAllByRole("listitem")
    .map((item) => item.querySelector("p")?.textContent);
}

describe("GoalsTab", () => {
  it("clears deleted goals when financial data is reset from outside the tab", async () => {
    const user = userEvent.setup();
    const api = createApi([goal(1, "Save for a bike")]);
    render(
      <FinancialSummaryProvider api={api}>
        <ResetDataDialog api={api} />
        <GoalsTab api={api} />
      </FinancialSummaryProvider>,
    );
    expect(await goalTexts()).toEqual(["Save for a bike"]);

    await user.click(screen.getByRole("button", { name: /start over/i }));
    await user.click(
      screen.getByRole("button", { name: /delete financial data/i }),
    );

    expect(await screen.findByText(/no goals yet/i)).toBeInTheDocument();
    expect(screen.queryByText("Save for a bike")).not.toBeInTheDocument();
  });

  it("keeps the goal list mounted when the summary refreshes", async () => {
    const api = createApi([goal(1, "Save for a bike")]);
    let refreshSummary = () => {};
    function CaptureRefresh() {
      refreshSummary = useFinancialSummary().refresh;
      return null;
    }
    render(
      <FinancialSummaryProvider api={api}>
        <CaptureRefresh />
        <GoalsTab api={api} />
      </FinancialSummaryProvider>,
    );
    await goalTexts();
    const list = screen.getByRole("list", { name: "Your goals" });

    await act(async () => {
      refreshSummary();
    });

    expect(screen.queryByText("Loading goals…")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Your goals" })).toBe(list);
  });

  it("shows an empty state when there are no goals", async () => {
    renderGoals(createApi());

    expect(await screen.findByText(/no goals yet/i)).toBeInTheDocument();
  });

  it("adds new goals to the top of the list and clears the form", async () => {
    const user = userEvent.setup();
    const api = createApi([goal(1, "Build an emergency fund")]);
    renderGoals(api);
    await screen.findByRole("list", { name: "Your goals" });

    // Untracked goals need only text; the limit field is not shown.
    expect(screen.queryByLabelText("Monthly limit")).not.toBeInTheDocument();
    const textbox = screen.getByLabelText("Your goal");
    await user.type(textbox, "Spend less on dining out");
    await user.click(screen.getByRole("button", { name: "Add goal" }));

    await screen.findByRole("button", {
      name: "Edit goal: Spend less on dining out",
    });
    expect(await goalTexts()).toEqual([
      "Spend less on dining out",
      "Build an emergency fund",
    ]);
    expect(api.createGoal).toHaveBeenCalledWith({
      title: "Spend less on dining out",
      categoryId: null,
      spendingLimitCents: null,
    });
    expect(textbox).toHaveValue("");
  });

  it("offers only expense categories and links a goal with a limit", async () => {
    const user = userEvent.setup();
    const api = createApi();
    renderGoals(api);
    await screen.findByText(/no goals yet/i);

    const select = screen.getByLabelText("Track spending in (optional)");
    expect(
      within(select).queryByRole("option", { name: "Pay" }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Your goal"), "Cap dining");
    await user.selectOptions(select, "Dining Out");
    await user.type(screen.getByLabelText("Monthly limit"), "300.5");
    await user.click(screen.getByRole("button", { name: "Add goal" }));

    expect(api.createGoal).toHaveBeenCalledWith({
      title: "Cap dining",
      categoryId: 4,
      spendingLimitCents: 30050,
    });
  });

  it("requires a limit only once a category is chosen", async () => {
    const user = userEvent.setup();
    const api = createApi();
    renderGoals(api);
    await screen.findByText(/no goals yet/i);

    await user.type(screen.getByLabelText("Your goal"), "Cap dining");
    await user.selectOptions(
      screen.getByLabelText("Track spending in (optional)"),
      "Dining Out",
    );
    await user.click(screen.getByRole("button", { name: "Add goal" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      /enter a monthly limit to track this category/i,
    );
    expect(api.createGoal).not.toHaveBeenCalled();

    // Switching back to "Don't track" hides the limit and allows saving.
    await user.selectOptions(
      screen.getByLabelText("Track spending in (optional)"),
      "Don't track",
    );
    expect(screen.queryByLabelText("Monthly limit")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add goal" }));
    expect(api.createGoal).toHaveBeenCalledWith({
      title: "Cap dining",
      categoryId: null,
      spendingLimitCents: null,
    });
  });

  it("edits a goal in place and cancel discards changes", async () => {
    const user = userEvent.setup();
    const api = createApi([goal(1, "Save more")]);
    renderGoals(api);

    await user.click(
      await screen.findByRole("button", { name: "Edit goal: Save more" }),
    );
    const list = screen.getByRole("list", { name: "Your goals" });
    const editBox = within(list).getByLabelText("Your goal");
    await user.clear(editBox);
    await user.type(editBox, "Discarded");
    await user.click(within(list).getByRole("button", { name: "Cancel" }));
    expect(await goalTexts()).toEqual(["Save more"]);
    expect(api.updateGoal).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Edit goal: Save more" }),
    );
    const secondEditBox = within(list).getByLabelText("Your goal");
    await user.clear(secondEditBox);
    await user.type(secondEditBox, "Save $200 a month");
    await user.click(within(list).getByRole("button", { name: "Save goal" }));

    await screen.findByRole("button", {
      name: "Edit goal: Save $200 a month",
    });
    expect(await goalTexts()).toEqual(["Save $200 a month"]);
    expect(api.updateGoal).toHaveBeenCalledWith(1, {
      title: "Save $200 a month",
      categoryId: null,
      spendingLimitCents: null,
    });
  });

  it("deletes a goal only after confirmation", async () => {
    const user = userEvent.setup();
    const api = createApi([goal(1, "Save more")]);
    renderGoals(api);

    await user.click(
      await screen.findByRole("button", { name: "Delete goal: Save more" }),
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.deleteGoal).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Delete goal: Save more" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete goal" }));

    expect(api.deleteGoal).toHaveBeenCalledWith(1);
    expect(await screen.findByText(/no goals yet/i)).toBeInTheDocument();
  });

  it("describes tracked, over-limit, and untracked progress", async () => {
    renderGoals(
      createApi([
        goal(3, "Over", {
          categoryId: 4,
          spendingLimitCents: 10000,
          progress: { month: "2026-10", spentCents: 12500, limitCents: 10000 },
        }),
        goal(2, "Tracked", {
          categoryId: 4,
          spendingLimitCents: 30000,
          progress: { month: "2026-10", spentCents: 21000, limitCents: 30000 },
        }),
        goal(1, "Untracked"),
      ]),
    );

    expect(
      await screen.findByRole("img", {
        name: "Dining Out: $210.00 of $300.00 spent in October 2026 (70%)",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Dining Out: $125.00 of $100.00 spent in October 2026 (125%), over by $25.00",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Over by $25.00")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Not tracked" }),
    ).toBeInTheDocument();
  });

  it("shows the AI disclosure without calling any API", async () => {
    const user = userEvent.setup();
    const api = createApi([goal(1, "Save more")]);
    renderGoals(api);
    await screen.findByRole("list", { name: "Your goals" });
    const callsBefore = api.listGoals.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Help me meet this" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      /not professional financial advice/i,
    );
    expect(api.listGoals).toHaveBeenCalledTimes(callsBefore);
    expect(api.createGoal).not.toHaveBeenCalled();
    expect(api.updateGoal).not.toHaveBeenCalled();
  });
});
