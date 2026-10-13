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

export type FinancialSummary = {
  income: CategoryTotal[];
  expenses: CategoryTotal[];
  largestIncomeSources: FinancialSource[];
  largestExpenses: FinancialSource[];
};

export async function loadFinancialSummary(db: Database): Promise<FinancialSummary> {
  const [categories, transactions] = await Promise.all([
    db.select<FinancialCategory[]>(
      "SELECT id, name, type, color FROM categories ORDER BY name",
    ),
    db.select<FinancialTransaction[]>(
      `SELECT category_id AS categoryId, amount, description
       FROM transactions
       WHERE category_id IS NOT NULL`,
    ),
  ]);

  return createFinancialSummary(categories, transactions);
}

export function createFinancialSummary(
  categories: FinancialCategory[],
  transactions: FinancialTransaction[],
): FinancialSummary {
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
