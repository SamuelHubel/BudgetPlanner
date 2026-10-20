import Database from "@tauri-apps/plugin-sql";
import type { ParsedTransaction } from "./csvParser";

export type Category = {
  id: number;
  name: string;
};

type KeywordCategory = {
  keyword: string;
  categoryId: number;
  categoryName: string;
};

export async function loadCategories(db: Database): Promise<Category[]> {
  return db.select<Category[]>("SELECT id, name FROM categories ORDER BY name");
}

export async function categorizeTransactions(
  db: Database,
  transactions: ParsedTransaction[],
  categories: Category[],
): Promise<ParsedTransaction[]> {
  const keywordCategories = await db.select<KeywordCategory[]>(
    `SELECT keyword, category_id AS categoryId, categories.name AS categoryName
     FROM keyword_category_map
     JOIN categories ON categories.id = keyword_category_map.category_id
     ORDER BY keyword_category_map.id`,
  );
  const categoriesByName = new Map(
    categories.map((category) => [normalizeCategoryName(category.name), category]),
  );
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const keywordMatchers = keywordCategories
    .filter(({ keyword }) => keyword.trim() !== "")
    .map(({ keyword, categoryId }) => {
      const escapedKeyword = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return {
        keyword,
        categoryId,
        matcher: new RegExp(`(^|[^a-z0-9])${escapedKeyword}(?=$|[^a-z0-9])`),
      };
    });

  return transactions.map((transaction) => {
    const statementCategory = transaction.categoryName
      ? categoriesByName.get(normalizeCategoryName(transaction.categoryName))
      : undefined;
    if (statementCategory) {
      return {
        ...transaction,
        categoryId: statementCategory.id,
        categoryName: statementCategory.name,
      };
    }

    const description = transaction.description.toLowerCase();
    const keywordMatch = keywordMatchers
      .filter(({ matcher }) => matcher.test(description))
      .sort((first, second) => second.keyword.length - first.keyword.length)[0];
    const fallbackCategory = keywordMatch ? categoriesById.get(keywordMatch.categoryId) : undefined;
    return fallbackCategory
      ? { ...transaction, categoryId: fallbackCategory.id, categoryName: fallbackCategory.name }
      : { ...transaction, categoryId: null };
  });
}

function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function saveImportedTransactions(
  db: Database,
  fileName: string,
  transactions: ParsedTransaction[],
): Promise<void> {
  if (transactions.length === 0) {
    throw new Error("There are no transactions to import.");
  }

  const importedAt = new Date().toISOString();
  const batch = await db.execute(
    "INSERT INTO import_batches (file_name, imported_at, transaction_count) VALUES (?, ?, ?)",
    [fileName, importedAt, transactions.length],
  );
  const batchId = batch.lastInsertId;

  for (const transaction of transactions) {
    await db.execute(
      `INSERT INTO transactions
       (category_id, amount, description, date, source, import_batch_id, created_at)
       VALUES (?, ?, ?, ?, 'imported', ?, ?)`,
      [
        transaction.categoryId,
        transaction.amount,
        transaction.description,
        transaction.date,
        batchId,
        importedAt,
      ],
    );
  }
}
