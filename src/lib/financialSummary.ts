import Database from "@tauri-apps/plugin-sql";

export type FinancialCategory = {
  id: number;
  name: string;
  type: "income" | "expense";
  color: string | null;
};

type FinancialTransaction = {
  categoryId: number | null;
  amount: number;
  description: string | null;
  date?: string;
};

export type FinancialSource = {
  description: string;
  categoryName: string;
  amount: number;
};

export type CategoryTotal = {
  category: FinancialCategory;
  amount: number;
};

export type MonthlyTotal = {
  month: string;
  income: number;
  expenses: number;
};

export type FinancialBreakdown = {
  income: CategoryTotal[];
  expenses: CategoryTotal[];
  largestIncomeSources: FinancialSource[];
  largestExpenses: FinancialSource[];
};

export type MonthlyBreakdown = FinancialBreakdown & {
  month: string;
};

export type FinancialSummary = FinancialBreakdown & {
  monthlyTotals: MonthlyTotal[];
  monthlyBreakdowns: MonthlyBreakdown[];
};

export async function loadFinancialSummary(db: Database): Promise<FinancialSummary> {
  const [categories, transactions] = await Promise.all([
    db.select<FinancialCategory[]>(
      "SELECT id, name, type, color FROM categories ORDER BY name",
    ),
    db.select<FinancialTransaction[]>(
      `SELECT category_id AS categoryId, amount, description, date
       FROM transactions`,
    ),
  ]);

  return createFinancialSummary(categories, transactions);
}

export function createFinancialSummary(
  categories: FinancialCategory[],
  transactions: FinancialTransaction[],
): FinancialSummary {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const transactionsByMonth = new Map<string, FinancialTransaction[]>();
  const monthlyTotals = new Map<string, MonthlyTotal>();

  for (const transaction of transactions) {
    const month = transaction.date ? getMonthKey(transaction.date) : null;
    if (!month) continue;

    const monthTransactions = transactionsByMonth.get(month) ?? [];
    monthTransactions.push(transaction);
    transactionsByMonth.set(month, monthTransactions);

    const monthlyTotal = monthlyTotals.get(month) ?? { month, income: 0, expenses: 0 };
    if (Number.isFinite(transaction.amount) && transaction.amount !== 0 && transaction.categoryId !== null) {
      const category = categoriesById.get(transaction.categoryId);
      if (category) {
        if (category.type === "income") {
          monthlyTotal.income += Math.abs(transaction.amount);
        } else {
          monthlyTotal.expenses += Math.abs(transaction.amount);
        }
      }
    }
    monthlyTotals.set(month, monthlyTotal);
  }

  return {
    ...createFinancialBreakdown(categories, transactions),
    monthlyTotals: [...monthlyTotals.values()].sort((first, second) => first.month.localeCompare(second.month)),
    monthlyBreakdowns: [...transactionsByMonth.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([month, monthTransactions]) => ({
        month,
        ...createFinancialBreakdown(categories, monthTransactions),
      })),
  };
}

function createFinancialBreakdown(
  categories: FinancialCategory[],
  transactions: FinancialTransaction[],
): FinancialBreakdown {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const incomeTotals = new Map<number, number>();
  const expenseTotals = new Map<number, number>();
  const incomeSources = new Map<string, FinancialSource>();
  const expenseSources = new Map<string, FinancialSource>();

  for (const transaction of transactions) {
    if (transaction.categoryId === null || !Number.isFinite(transaction.amount)) continue;
    const category = categoriesById.get(transaction.categoryId);
    if (!category || transaction.amount === 0) continue;

    const amount = Math.abs(transaction.amount);
    const isIncome = category.type === "income";
    const totals = isIncome ? incomeTotals : expenseTotals;
    totals.set(category.id, (totals.get(category.id) ?? 0) + amount);

    const description = transaction.description?.trim();
    if (!description) continue;

    const sources = isIncome ? incomeSources : expenseSources;
    const sourceKey = `${category.id}:${description.toLowerCase()}`;
    const source = sources.get(sourceKey);
    if (source) {
      source.amount += amount;
    } else {
      sources.set(sourceKey, { description, categoryName: category.name, amount });
    }
  }

  const toCategoryTotals = (
    totals: Map<number, number>,
    type: FinancialCategory["type"],
  ): CategoryTotal[] =>
    categories
      .filter((category) => category.type === type)
      .flatMap((category) => {
        const amount = totals.get(category.id);
        return amount === undefined ? [] : [{ category, amount }];
      });

  const largestSources = (sources: Map<string, FinancialSource>): FinancialSource[] =>
    [...sources.values()]
      .sort((first, second) => second.amount - first.amount || first.description.localeCompare(second.description))
      .slice(0, 5);

  return {
    income: toCategoryTotals(incomeTotals, "income"),
    expenses: toCategoryTotals(expenseTotals, "expense"),
    largestIncomeSources: largestSources(incomeSources),
    largestExpenses: largestSources(expenseSources),
  };
}

function getMonthKey(date: string): string | null {
  const isoDate = /^(\d{4})-(\d{2})/.exec(date);
  if (isoDate) {
    const month = Number(isoDate[2]);
    return month >= 1 && month <= 12 ? `${isoDate[1]}-${isoDate[2]}` : null;
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}`;
}
