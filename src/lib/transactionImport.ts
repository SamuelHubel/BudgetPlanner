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
): Promise<ParsedTransaction[]> {
  const mappings = await db.select<KeywordCategory[]>(
    `SELECT keyword, category_id AS categoryId, categories.name AS categoryName
     FROM keyword_category_map
     JOIN categories ON categories.id = keyword_category_map.category_id
     ORDER BY keyword_category_map.id`,
  );

  return transactions.map((transaction) => {
    const description = transaction.description.toLowerCase();
    const match = mappings.find(({ keyword }) => description.includes(keyword.toLowerCase()));
    return match
      ? { ...transaction, categoryId: match.categoryId, categoryName: match.categoryName }
      : transaction;
  });
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
