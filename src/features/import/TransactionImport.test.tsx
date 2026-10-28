import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BudgetApiClient } from "../../api/budgetApi";
import type { ImportPreviewRow } from "../../types";
import TransactionImport from "./TransactionImport";
import { FinancialSummaryProvider } from "../home/FinancialSummaryContext";

const preview: ImportPreviewRow[] = [
  {
    date: "2026-01-01",
    amountCents: -500,
    description: "Coffee",
    categoryId: null,
    statementCategoryName: null,
    isDuplicate: true,
  },
];

function createApi(
  previewImport: BudgetApiClient["previewImport"],
): BudgetApiClient {
  return {
    isInitialized: async () => true,
    createPassword: async () => {},
    unlock: async () => {},
    lock: async () => {},
    listCategories: async () => [
      { id: 1, name: "Groceries", type: "expense", color: "#22c55e" },
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
    getCurrency: async () => "USD",
    resetFinancialData: async () => {},
  };
}

function csvFile(): File {
  const file = new File(["unused"], "statement.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", {
    value: async () => "Date,Description,Amount\n01/02/2026,Coffee,-5.00",
  });
  return file;
}

describe("TransactionImport", () => {
  it("previews duplicates and commits reviewed rows through the API", async () => {
    const user = userEvent.setup();
    const previewImport = vi.fn(async () => preview);
    const api = createApi(previewImport);
    const onImportCommitted = vi.fn();
    render(
      <FinancialSummaryProvider api={api}>
        <TransactionImport api={api} onImportCommitted={onImportCommitted} />
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
      screen.getByRole("combobox", { name: /category for coffee/i }),
      "1",
    );
    await user.click(screen.getByRole("button", { name: /confirm import/i }));

    expect(api.commitImport).toHaveBeenCalledWith("statement.csv", [
      {
        date: "2026-01-01",
        amountCents: -500,
        description: "Coffee",
        categoryId: 1,
      },
    ]);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "0 transactions imported; 1 duplicate skipped.",
    );
    expect(onImportCommitted).toHaveBeenCalledOnce();
  });

  it("lets the user resolve an ambiguous CSV date order", async () => {
    const user = userEvent.setup();
    const previewImport = vi
      .fn()
      .mockRejectedValueOnce("date order is ambiguous")
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
    );
  });
});
