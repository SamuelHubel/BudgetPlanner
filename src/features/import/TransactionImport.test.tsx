import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BudgetApiClient } from "../../api/budgetApi";
import type { CategorySettings, ImportPreviewRow } from "../../types";
import TransactionImport from "./TransactionImport";
import { FinancialSummaryProvider } from "../home/FinancialSummaryContext";

const preview: ImportPreviewRow[] = [
  {
    date: "2026-01-01",
    amountCents: -500,
    description: "Coffee",
    categoryId: null,
    subcategoryId: null,
    statementCategoryName: null,
    isDuplicate: true,
  },
];

const ambiguousDateOrder = {
  code: "ambiguousDateOrder",
  message: "date order is ambiguous",
};
const ambiguousAmount = {
  code: "ambiguousAmount",
  message: 'row 2: amount "1,234" could be read two ways',
};

function createApi(
  previewImport: BudgetApiClient["previewImport"],
  overrides: Partial<BudgetApiClient> = {},
): BudgetApiClient {
  return {
    isInitialized: async () => true,
    createPassword: async () => {},
    unlock: async () => {},
    lock: async () => {},
    resetVault: async () => {},
    listCategories: async () => [
      { id: 1, name: "Groceries", type: "expense", color: "#22c55e" },
      { id: 2, name: "Dining Out", type: "expense", color: "#f97316" },
      { id: 3, name: "Other", type: "expense", color: "#64748b" },
    ],
    previewImport,
    commitImport: vi.fn(async () => ({ inserted: 0, skippedDuplicates: 1 })),
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
    listSubcategories: async () => [
      { id: 10, categoryId: 1, name: "Supermarkets", color: null },
      { id: 20, categoryId: 2, name: "Coffee", color: null },
    ],
    getCategorySettings: async () => ({
      useSubcategoriesOnImport: true,
      showSubcategoryCharts: true,
    }),
    updateCategorySettings: async (settings) => settings,
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
    getBudget: async (month) => ({
      month,
      budget: null,
      template: null,
      actuals: [],
      uncategorizedSpentCents: 0,
    }),
    saveBudget: async (budget) => budget,
    deleteBudget: async () => {},
    ...overrides,
  };
}

function csvFile(): File {
  const file = new File(["unused"], "statement.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", {
    value: async () => "Date,Description,Amount\n01/02/2026,Coffee,-5.00",
  });
  return file;
}

const reviewRows: ImportPreviewRow[] = [
  {
    date: "2026-01-01",
    amountCents: -500,
    description: "Latte",
    categoryId: 2,
    subcategoryId: 20,
    statementCategoryName: null,
    isDuplicate: false,
  },
  {
    date: "2026-01-02",
    amountCents: -900,
    description: "Mystery",
    categoryId: null,
    subcategoryId: null,
    statementCategoryName: null,
    isDuplicate: false,
  },
  {
    date: "2026-01-03",
    amountCents: -100,
    description: "Old mystery",
    categoryId: null,
    subcategoryId: null,
    statementCategoryName: null,
    isDuplicate: true,
  },
];

async function renderReview(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<BudgetApiClient> = {},
) {
  const api = createApi(async () => reviewRows, overrides);
  render(
    <FinancialSummaryProvider api={api}>
      <TransactionImport api={api} />
    </FinancialSummaryProvider>,
  );
  await user.upload(screen.getByLabelText(/choose a csv file/i), csvFile());
  await screen.findByRole("combobox", { name: "Category for Latte" });
  return api;
}

describe("TransactionImport subcategories", () => {
  it("offers only the selected category's subcategories", async () => {
    const user = userEvent.setup();
    await renderReview(user);

    const select = screen.getByRole("combobox", {
      name: "Subcategory for Latte",
    });

    expect(select).toHaveValue("20");
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["General", "Coffee"]);
  });

  it("clears the subcategory when the main category changes", async () => {
    const user = userEvent.setup();
    const api = await renderReview(user);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Category for Latte" }),
      "1",
    );
    expect(
      screen.getByRole("combobox", { name: "Subcategory for Latte" }),
    ).toHaveValue("");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Subcategory for Latte" }),
      "10",
    );
    await user.click(screen.getByRole("button", { name: /confirm import/i }));

    expect(vi.mocked(api.commitImport).mock.calls[0]?.[1][0]).toMatchObject({
      categoryId: 1,
      subcategoryId: 10,
    });
  });

  it("disables the subcategory select when a category has none", async () => {
    const user = userEvent.setup();
    await renderReview(user);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Category for Latte" }),
      "3",
    );

    expect(
      screen.getByRole("combobox", { name: "Subcategory for Latte" }),
    ).toBeDisabled();
  });

  it("sends main categories only when opted out, and remembers the choice", async () => {
    const user = userEvent.setup();
    const updateCategorySettings = vi.fn(
      async (settings: CategorySettings) => settings,
    );
    const api = await renderReview(user, { updateCategorySettings });

    await user.click(
      await screen.findByRole("checkbox", { name: "Use subcategories" }),
    );

    expect(updateCategorySettings).toHaveBeenCalledWith({
      useSubcategoriesOnImport: false,
      showSubcategoryCharts: true,
    });
    expect(
      screen.queryByRole("combobox", { name: "Subcategory for Latte" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirm import/i }));
    expect(vi.mocked(api.commitImport).mock.calls[0]?.[1][0]).toMatchObject({
      categoryId: 2,
      subcategoryId: null,
    });
  });

  it("restores subcategory picks when opting back in", async () => {
    const user = userEvent.setup();
    await renderReview(user);
    const toggle = await screen.findByRole("checkbox", {
      name: "Use subcategories",
    });

    await user.click(toggle);
    await user.click(toggle);

    expect(
      screen.getByRole("combobox", { name: "Subcategory for Latte" }),
    ).toHaveValue("20");
  });

  it("counts new rows still needing a category, ignoring duplicates", async () => {
    const user = userEvent.setup();
    await renderReview(user);

    expect(
      screen.getByText("1 transaction needs a category"),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Category for Mystery" }),
      "1",
    );
    expect(screen.queryByText(/needs? a category/)).not.toBeInTheDocument();
  });
});

describe("TransactionImport", () => {
  it("previews duplicates and commits reviewed rows through the API", async () => {
    const user = userEvent.setup();
    const previewImport = vi.fn(async () => preview);
    const api = createApi(previewImport);
    render(
      <FinancialSummaryProvider api={api}>
        <TransactionImport api={api} />
      </FinancialSummaryProvider>,
    );

    await user.upload(screen.getByLabelText(/choose a csv file/i), csvFile());
    expect(await screen.findByText("Already imported")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(5);
    expect(
      screen
        .getAllByRole("columnheader")
        .every((header) => header.getAttribute("scope") === "col"),
    ).toBe(true);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Category for Coffee" }),
      "1",
    );
    await user.click(screen.getByRole("button", { name: /confirm import/i }));

    expect(api.commitImport).toHaveBeenCalledWith("statement.csv", [
      {
        date: "2026-01-01",
        amountCents: -500,
        description: "Coffee",
        categoryId: 1,
        subcategoryId: null,
      },
    ]);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "0 transactions imported; 1 duplicate skipped.",
    );
  });

  it("lets the user resolve an ambiguous CSV date order", async () => {
    const user = userEvent.setup();
    const previewImport = vi
      .fn()
      .mockRejectedValueOnce(ambiguousDateOrder)
      .mockResolvedValueOnce(preview);
    const api = createApi(previewImport);
    render(
      <FinancialSummaryProvider api={api}>
        <TransactionImport api={api} />
      </FinancialSummaryProvider>,
    );

    await user.upload(screen.getByLabelText(/choose a csv file/i), csvFile());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "date order is ambiguous",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Statement date order" }),
      "mdy",
    );

    expect(await screen.findByText("Already imported")).toBeInTheDocument();
    expect(previewImport).toHaveBeenLastCalledWith(
      "Date,Description,Amount\n01/02/2026,Coffee,-5.00",
      "statement.csv",
      "mdy",
      "auto",
    );
  });

  it("lets the user resolve an ambiguous amount format", async () => {
    const user = userEvent.setup();
    const previewImport = vi
      .fn()
      .mockRejectedValueOnce(ambiguousAmount)
      .mockResolvedValueOnce(preview);
    const api = createApi(previewImport);
    render(
      <FinancialSummaryProvider api={api}>
        <TransactionImport api={api} />
      </FinancialSummaryProvider>,
    );

    await user.upload(screen.getByLabelText(/choose a csv file/i), csvFile());
    await user.selectOptions(
      await screen.findByRole("combobox", { name: "Statement amount format" }),
      "decimalComma",
    );

    expect(await screen.findByText("Already imported")).toBeInTheDocument();
    expect(previewImport).toHaveBeenLastCalledWith(
      "Date,Description,Amount\n01/02/2026,Coffee,-5.00",
      "statement.csv",
      "auto",
      "decimalComma",
    );
  });

  it("keeps both choices when a statement needs a date order and an amount format", async () => {
    const user = userEvent.setup();
    const previewImport = vi
      .fn()
      .mockRejectedValueOnce(ambiguousDateOrder)
      .mockRejectedValueOnce(ambiguousAmount)
      .mockResolvedValueOnce(preview);
    const api = createApi(previewImport);
    render(
      <FinancialSummaryProvider api={api}>
        <TransactionImport api={api} />
      </FinancialSummaryProvider>,
    );

    await user.upload(screen.getByLabelText(/choose a csv file/i), csvFile());
    await user.selectOptions(
      await screen.findByRole("combobox", { name: "Statement date order" }),
      "dmy",
    );
    await user.selectOptions(
      await screen.findByRole("combobox", { name: "Statement amount format" }),
      "decimalDot",
    );

    expect(await screen.findByText("Already imported")).toBeInTheDocument();
    expect(previewImport).toHaveBeenLastCalledWith(
      "Date,Description,Amount\n01/02/2026,Coffee,-5.00",
      "statement.csv",
      "dmy",
      "decimalDot",
    );
  });
});
