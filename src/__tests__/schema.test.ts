import { describe, expect, it } from "vitest";
import { readFile } from "fs/promises";
import { join } from "path";

describe("Database schema", () => {
  it("includes the expected core tables for the finance tracker", async () => {
    const schemaPath = join(process.cwd(), "src-tauri", "migrations", "init.sql");
    const contents = await readFile(schemaPath, "utf-8");

    expect(contents).toContain("CREATE TABLE app_lock");
    expect(contents).toContain("CREATE TABLE categories");
    expect(contents).toContain("CREATE TABLE transactions");
    expect(contents).toContain("CREATE TABLE import_batches");
    expect(contents).toContain("CREATE TABLE goals");
    expect(contents).toContain("CREATE TABLE ai_insights_log");
    expect(contents).toContain("CREATE TABLE keyword_category_map");
  });

  it("seeds common categories for statement imports", async () => {
    const migrationPath = join(process.cwd(), "src-tauri", "migrations", "default_categories.sql");
    const contents = await readFile(migrationPath, "utf-8");

    for (const category of [
      "Housing",
      "Groceries",
      "Pay",
      "Dining Out",
      "Transportation",
      "Utilities",
      "Healthcare",
      "Shopping",
      "Entertainment",
      "Personal Care",
      "Other",
    ]) {
      expect(contents).toContain(`'${category}'`);
    }
  });
});
