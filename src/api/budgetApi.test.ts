import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  invalidTestPassword,
  testPassword,
} from "../__tests__/testCredentials";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { budgetApi } from "./budgetApi";

beforeEach(() => {
  invoke.mockReset();
});

describe("budgetApi IPC contract", () => {
  it("uses registered command names and camel-case payloads", async () => {
    await budgetApi.isInitialized();
    await budgetApi.createPassword(testPassword);
    await budgetApi.unlock(invalidTestPassword);
    await budgetApi.lock();
    await budgetApi.resetVault();
    await budgetApi.listCategories();
    await budgetApi.previewImport("csv", "bank.csv", "mdy", "decimalComma");
    await budgetApi.commitImport("bank.csv", [
      {
        date: "2026-01-01",
        amountCents: -500,
        description: "Coffee",
        categoryId: null,
      },
    ]);
    await budgetApi.getFinancialSummary();
    await budgetApi.getCurrency();
    await budgetApi.resetFinancialData();
    await budgetApi.listGoals();
    await budgetApi.createGoal({
      title: "Spend less on dining out",
      categoryId: 4,
      spendingLimitCents: 30000,
    });
    await budgetApi.updateGoal(7, {
      title: "Save more",
      categoryId: null,
      spendingLimitCents: null,
    });
    await budgetApi.deleteGoal(7);
    await budgetApi.getBudget("2026-10");
    await budgetApi.saveBudget({
      month: "2026-10",
      expectedIncomeCents: 500000,
      inputMode: "percent",
      allocations: [{ categoryId: 4, amountCents: 150000 }],
    });
    await budgetApi.deleteBudget("2026-10");

    expect(invoke.mock.calls).toEqual([
      ["is_initialized"],
      ["create_password", { password: testPassword }],
      ["unlock", { password: invalidTestPassword }],
      ["lock"],
      ["reset_vault"],
      ["list_categories"],
      [
        "preview_import",
        {
          csvText: "csv",
          fileName: "bank.csv",
          dateOrder: "mdy",
          amountFormat: "decimalComma",
        },
      ],
      [
        "commit_import",
        {
          fileName: "bank.csv",
          rows: [
            {
              date: "2026-01-01",
              amountCents: -500,
              description: "Coffee",
              categoryId: null,
            },
          ],
        },
      ],
      ["get_financial_summary"],
      ["get_currency"],
      ["reset_financial_data"],
      ["list_goals"],
      [
        "create_goal",
        {
          title: "Spend less on dining out",
          categoryId: 4,
          spendingLimitCents: 30000,
        },
      ],
      [
        "update_goal",
        {
          id: 7,
          title: "Save more",
          categoryId: null,
          spendingLimitCents: null,
        },
      ],
      ["delete_goal", { id: 7 }],
      ["get_budget", { month: "2026-10" }],
      [
        "save_budget",
        {
          month: "2026-10",
          expectedIncomeCents: 500000,
          inputMode: "percent",
          allocations: [{ categoryId: 4, amountCents: 150000 }],
        },
      ],
      ["delete_budget", { month: "2026-10" }],
    ]);
  });
});
