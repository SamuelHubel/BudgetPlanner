/** The frontend tabs available in the dashboard. */
export const TABS = ["home", "ai"] as const;

/** A dashboard tab identifier. */
export type TabName = typeof TABS[number];

/** A transaction category returned by the budget API. */
export type Category = {
  id: number;
  name: string;
  type: "income" | "expense";
  color: string | null;
};

/** A transaction row sent to the import commit API. */
export type ImportRow = {
  date: string;
  amountCents: number;
  description: string;
  categoryId: number | null;
};

/** A parsed import row with preview-only metadata. */
export type ImportPreviewRow = ImportRow & {
  statementCategoryName: string | null;
  isDuplicate: boolean;
};

/** A transaction contributing to a category's financial summary. */
export type FinancialSource = {
  categoryId: number;
  description: string;
  categoryName: string;
  amountCents: number;
};

/** A category amount in a financial breakdown. */
export type CategoryTotal = {
  category: Category;
  amountCents: number;
};

/** Aggregate amounts for categorized and uncategorized activity. */
export type FinancialBreakdown = {
  income: CategoryTotal[];
  expenses: CategoryTotal[];
  largestIncomeSources: FinancialSource[];
  largestExpenses: FinancialSource[];
  uncategorizedCents: number;
  uncategorizedIncomeCents: number;
  uncategorizedExpensesCents: number;
};

/** Income and expense totals for one calendar month. */
export type MonthlyTotal = {
  month: string;
  incomeCents: number;
  expensesCents: number;
  uncategorizedCents: number;
};

/** A monthly financial breakdown. */
export type MonthlyBreakdown = {
  month: string;
  breakdown: FinancialBreakdown;
};

/** The full summary returned by the budget API. */
export type FinancialSummary = {
  breakdown: FinancialBreakdown;
  monthlyTotals: MonthlyTotal[];
  monthlyBreakdowns: MonthlyBreakdown[];
};

/** Supported date order choices for statement imports. */
export type DateOrder = "auto" | "mdy" | "dmy";

/** Counts returned after an import commit. */
export type CommitImportResult = {
  inserted: number;
  skippedDuplicates: number;
};
