import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

describe("SQLite migrations", () => {
  it("applies the versioned migrations and enforces the schema", async () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("PRAGMA foreign_keys = ON");

      for (const migration of [
        "0001_initial_schema.sql",
        "0002_seed_categories.sql",
        "0003_seed_keyword_rules.sql",
      ]) {
        const sql = await readFile(join(process.cwd(), "src-tauri", "migrations", migration), "utf8");
        db.exec(sql);
      }

      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
      ).all().map((row) => row.name);
      expect(tables).toEqual(expect.arrayContaining([
        "categories",
        "import_batches",
        "transactions",
        "goals",
        "keyword_category_map",
        "ai_insights_log",
      ]));
      expect(tables).not.toContain("app_lock");
      expect(db.prepare("SELECT COUNT(*) AS count FROM categories").get()?.count).toBe(11);
      expect(db.prepare("SELECT COUNT(*) AS count FROM keyword_category_map").get()?.count).toBeGreaterThan(0);

      expect(() => db.exec(
        "INSERT INTO categories (name, type, color) VALUES ('housing', 'expense', '#000000')",
      )).toThrow();
      expect(() => db.exec(
        "INSERT INTO categories (name, type, color) VALUES ('Invalid color', 'expense', 'blue')",
      )).toThrow();
      expect(() => db.exec(
        "INSERT INTO categories (name, type) VALUES ('Invalid type', 'saving')",
      )).toThrow();
      expect(() => db.exec(
        "INSERT INTO import_batches (file_name, imported_at, transaction_count) VALUES ('bad.csv', '2026-01-01', -1)",
      )).toThrow();
      expect(() => db.exec(
        "INSERT INTO transactions (amount_cents, date) VALUES (1.5, '2026-01-01')",
      )).toThrow();
      expect(() => db.exec(
        "INSERT INTO transactions (amount_cents, date) VALUES (1, '2026-1-01')",
      )).toThrow();
      expect(() => db.exec(
        "INSERT INTO transactions (amount_cents, date, source) VALUES (1, '2026-01-01', 'imported')",
      )).toThrow();
      expect(() => db.exec(
        "INSERT INTO keyword_category_map (keyword, category_id) VALUES ('  ', 1)",
      )).toThrow();
      expect(() => db.exec(
        "INSERT INTO keyword_category_map (keyword, category_id) VALUES ('MORTGAGE', 1)",
      )).toThrow();
      expect(() => db.exec(
        "INSERT INTO goals (title, target_amount_cents) VALUES ('Fractional goal', 1.5)",
      )).toThrow();
      expect(() => db.exec(
        "INSERT INTO transactions (category_id, amount_cents, date) VALUES (999, 1, '2026-01-01')",
      )).toThrow();
      expect(() => db.exec(
        "INSERT INTO transactions (amount_cents, date, source, import_batch_id) VALUES (1, '2026-01-01', 'manual', 1)",
      )).toThrow();
      db.exec(
        "INSERT INTO transactions (amount_cents, date, dedupe_hash) VALUES (1, '2026-01-01', 'same-hash')",
      );
      expect(() => db.exec(
        "INSERT INTO transactions (amount_cents, date, dedupe_hash) VALUES (1, '2026-01-02', 'same-hash')",
      )).toThrow();

      const housingId = db.prepare(
        "SELECT id FROM categories WHERE name = 'Housing'",
      ).get()?.id;
      expect(housingId).toBeTypeOf("number");
      if (typeof housingId !== "number") {
        throw new Error("The seeded Housing category must have a numeric id.");
      }

      db.prepare(
        "INSERT INTO transactions (category_id, amount_cents, date) VALUES (?, 2500, '2026-01-01')",
      ).run(housingId);
      db.prepare(
        "INSERT INTO goals (title, target_amount_cents, category_id) VALUES ('Emergency fund', 100000, ?)",
      ).run(housingId);
      db.prepare("DELETE FROM categories WHERE id = ?").run(housingId);
      expect(db.prepare(
        "SELECT category_id FROM transactions WHERE date = '2026-01-01'",
      ).get()?.category_id).toBeNull();
      expect(db.prepare(
        "SELECT category_id FROM goals WHERE title = 'Emergency fund'",
      ).get()?.category_id).toBeNull();

      db.prepare(
        "INSERT INTO import_batches (file_name, imported_at, transaction_count) VALUES ('test.csv', '2026-01-01', 1)",
      ).run();
      db.prepare(
        "INSERT INTO transactions (amount_cents, date, source, import_batch_id) VALUES (100, '2026-01-01', 'imported', 1)",
      ).run();
      db.prepare("DELETE FROM import_batches WHERE id = 1").run();
      expect(db.prepare(
        "SELECT COUNT(*) AS count FROM transactions WHERE source = 'imported'",
      ).get()?.count).toBe(0);
    } finally {
      db.close();
    }
  });
});
