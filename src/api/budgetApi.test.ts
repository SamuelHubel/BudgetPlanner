import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { budgetApi } from "./budgetApi";

beforeEach(() => {
  invoke.mockReset();
});

describe("budgetApi IPC contract", () => {
  it("uses registered command names and camel-case payloads", async () => {
    await budgetApi.unlock("password");
    await budgetApi.lock();
    await budgetApi.listCategories();
    await budgetApi.previewImport("csv", "bank.csv", "mdy");
    await budgetApi.commitImport("bank.csv", [{
      date: "2026-01-01",
      amountCents: -500,
      description: "Coffee",
      categoryId: null,
    }]);
    await budgetApi.getFinancialSummary();
    await budgetApi.resetFinancialData();

    expect(invoke.mock.calls).toEqual([
      ["unlock", { password: "password" }],
      ["lock"],
      ["list_categories"],
      ["preview_import", { csvText: "csv", fileName: "bank.csv", dateOrder: "mdy" }],
      ["commit_import", {
        fileName: "bank.csv",
        rows: [{
          date: "2026-01-01",
          amountCents: -500,
          description: "Coffee",
          categoryId: null,
        }],
      }],
      ["get_financial_summary"],
      ["reset_financial_data"],
    ]);
  });
});
