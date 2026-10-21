export type Category = {
  id: number;
  name: string;
  type: "income" | "expense";
  color: string | null;
};

export type ImportRow = {
  date: string;
  amountCents: number;
  description: string;
  categoryId: number | null;
};

export type ImportPreviewRow = ImportRow & {
  statementCategoryName: string | null;
  isDuplicate: boolean;
};

export type FinancialSource = {
  categoryId: number;
  description: string;
  categoryName: string;
  amountCents: number;
};

export type CategoryTotal = {
  category: Category;
  amountCents: number;
};

export type FinancialBreakdown = {
  income: CategoryTotal[];
  expenses: CategoryTotal[];
  largestIncomeSources: FinancialSource[];
  largestExpenses: FinancialSource[];
  uncategorizedCents: number;
  uncategorizedIncomeCents: number;
  uncategorizedExpensesCents: number;
};

export type MonthlyTotal = {
  month: string;
  incomeCents: number;
  expensesCents: number;
  uncategorizedCents: number;
};

export type MonthlyBreakdown = {
  month: string;
  breakdown: FinancialBreakdown;
};

export type FinancialSummary = {
  breakdown: FinancialBreakdown;
  monthlyTotals: MonthlyTotal[];
  monthlyBreakdowns: MonthlyBreakdown[];
};

export type DateOrder = "auto" | "mdy" | "dmy";

export type CommitImportResult = {
  inserted: number;
  skippedDuplicates: number;
};
