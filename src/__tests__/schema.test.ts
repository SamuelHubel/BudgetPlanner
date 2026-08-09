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
});
