import { invoke } from "@tauri-apps/api/core";
import type {
  AmountFormat,
  Budget,
  BudgetMonth,
  Category,
  CategorySettings,
  CommitImportResult,
  DateOrder,
  FinancialSummary,
  Goal,
  GoalInput,
  ImportPreviewRow,
  ImportRow,
  Subcategory,
} from "../types";

/** Operations available to frontend features through the Tauri backend. */
export interface BudgetApiClient {
  /** Reports whether password-based database initialization is complete. */
  isInitialized(): Promise<boolean>;
  /** Creates the first password and initializes the encrypted database. */
  createPassword(password: string): Promise<void>;
  /** Opens the encrypted database using the supplied password. */
  unlock(password: string): Promise<void>;
  /** Closes the active database connection. */
  lock(): Promise<void>;
  /** Permanently erases all budget data so a new password can be created. */
  resetVault(): Promise<void>;
  /** Lists transaction categories available for imports. */
  listCategories(): Promise<Category[]>;
  /** Lists subcategories available for imports. */
  listSubcategories(): Promise<Subcategory[]>;
  /** Reads the remembered subcategory choices. */
  getCategorySettings(): Promise<CategorySettings>;
  /** Saves the subcategory choices and returns what was stored. */
  updateCategorySettings(settings: CategorySettings): Promise<CategorySettings>;
  /** Parses a CSV statement into preview rows without committing them. */
  previewImport(
    csvText: string,
    fileName: string,
    dateOrder?: DateOrder,
    amountFormat?: AmountFormat,
  ): Promise<ImportPreviewRow[]>;
  /** Atomically commits reviewed import rows. */
  commitImport(
    fileName: string,
    rows: ImportRow[],
  ): Promise<CommitImportResult>;
  /** Loads the all-time and monthly financial summary. */
  getFinancialSummary(): Promise<FinancialSummary>;
  /** Reads the currency used to format financial amounts. */
  getCurrency(): Promise<string>;
  /** Deletes transactions and related financial data. */
  resetFinancialData(): Promise<void>;
  /** Lists goals newest first, including computed spending progress. */
  listGoals(): Promise<Goal[]>;
  /** Creates a goal and returns it with its computed progress. */
  createGoal(input: GoalInput): Promise<Goal>;
  /** Replaces a goal's text and spending link. */
  updateGoal(id: number, input: GoalInput): Promise<Goal>;
  /** Permanently deletes a goal. */
  deleteGoal(id: number): Promise<void>;
  /** Loads a month's budget, copy-forward template, and actual spending. */
  getBudget(month: string): Promise<BudgetMonth>;
  /** Creates or replaces a month's budget. */
  saveBudget(budget: Budget): Promise<Budget>;
  /** Permanently deletes a month's budget. */
  deleteBudget(month: string): Promise<void>;
}

/** Tauri-backed implementation of the frontend budget API. */
export const budgetApi: BudgetApiClient = {
  isInitialized: () => invoke<boolean>("is_initialized"),
  createPassword: (password) => invoke<void>("create_password", { password }),
  unlock: (password) => invoke<void>("unlock", { password }),
  lock: () => invoke<void>("lock"),
  resetVault: () => invoke<void>("reset_vault"),
  listCategories: () => invoke<Category[]>("list_categories"),
  listSubcategories: () => invoke<Subcategory[]>("list_subcategories"),
  getCategorySettings: () => invoke<CategorySettings>("get_category_settings"),
  updateCategorySettings: (settings) =>
    invoke<CategorySettings>("update_category_settings", { settings }),
  previewImport: (
    csvText,
    fileName,
    dateOrder = "auto",
    amountFormat = "auto",
  ) =>
    invoke<ImportPreviewRow[]>("preview_import", {
      csvText,
      fileName,
      dateOrder,
      amountFormat,
    }),
  commitImport: (fileName, rows) =>
    invoke<CommitImportResult>("commit_import", { fileName, rows }),
  getFinancialSummary: () => invoke<FinancialSummary>("get_financial_summary"),
  getCurrency: () => invoke<string>("get_currency"),
  resetFinancialData: () => invoke<void>("reset_financial_data"),
  listGoals: () => invoke<Goal[]>("list_goals"),
  createGoal: ({ title, categoryId, spendingLimitCents }) =>
    invoke<Goal>("create_goal", { title, categoryId, spendingLimitCents }),
  updateGoal: (id, { title, categoryId, spendingLimitCents }) =>
    invoke<Goal>("update_goal", { id, title, categoryId, spendingLimitCents }),
  deleteGoal: (id) => invoke<void>("delete_goal", { id }),
  getBudget: (month) => invoke<BudgetMonth>("get_budget", { month }),
  saveBudget: ({ month, expectedIncomeCents, inputMode, allocations }) =>
    invoke<Budget>("save_budget", {
      month,
      expectedIncomeCents,
      inputMode,
      allocations,
    }),
  deleteBudget: (month) => invoke<void>("delete_budget", { month }),
};
