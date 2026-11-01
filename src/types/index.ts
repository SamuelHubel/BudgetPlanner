/** The frontend tabs available in the dashboard. */
export const TABS = ["home", "budget", "goals", "ai"] as const;

/** A dashboard tab identifier. */
export type TabName = (typeof TABS)[number];

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

/** How a statement writes amounts such as `1,234`. */
export type AmountFormat = "auto" | "decimalDot" | "decimalComma";

/** Counts returned after an import commit. */
export type CommitImportResult = {
  inserted: number;
  skippedDuplicates: number;
};

/** Spending progress for a goal linked to an expense category. */
export type GoalProgress = {
  /** Month the progress covers, as `YYYY-MM` (latest month with data). */
  month: string;
  /** Non-negative net spending in the linked category, in cents. */
  spentCents: number;
  /** Monthly spending limit, in cents. */
  limitCents: number;
};

/** A user financial goal returned by the budget API. */
export type Goal = {
  id: number;
  title: string;
  /** Linked expense category, or `null` for an untracked goal. */
  categoryId: number | null;
  /** Monthly spending limit in cents, or `null` for an untracked goal. */
  spendingLimitCents: number | null;
  createdAt: string;
  /** Computed progress, or `null` when untracked or no data exists yet. */
  progress: GoalProgress | null;
};

/** Editable goal fields sent to the create and update APIs. */
export type GoalInput = {
  title: string;
  categoryId: number | null;
  spendingLimitCents: number | null;
};

/**
 * How a budget's allocations are entered. This also decides what stays fixed
 * when income changes: percents for `percent`, amounts for `amount`.
 */
export type BudgetInputMode = "percent" | "amount";

/** The amount budgeted for one expense category. */
export type BudgetAllocation = {
  categoryId: number;
  amountCents: number;
};

/** A saved budget, also the fields sent to the save API. */
export type Budget = {
  /** Month the budget covers, as `YYYY-MM`. */
  month: string;
  expectedIncomeCents: number;
  inputMode: BudgetInputMode;
  allocations: BudgetAllocation[];
};

/** Actual net spending in one expense category. */
export type BudgetActual = {
  categoryId: number;
  spentCents: number;
};

/** Everything the Budget tab shows for one calendar month. */
export type BudgetMonth = {
  month: string;
  /** The month's saved budget, or `null` when none exists. */
  budget: Budget | null;
  /** The nearest earlier budget, or `null` when `budget` is set or none exists. */
  template: Budget | null;
  actuals: BudgetActual[];
  /** Outflows this month with no category, in cents. */
  uncategorizedSpentCents: number;
};
