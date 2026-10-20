import { invoke } from "@tauri-apps/api/core";
import type {
  Category,
  CommitImportResult,
  DateOrder,
  FinancialSummary,
  ImportPreviewRow,
  ImportRow,
} from "../types";

export interface BudgetApiClient {
  unlock(password: string): Promise<void>;
  lock(): Promise<void>;
  listCategories(): Promise<Category[]>;
  previewImport(
    csvText: string,
    fileName: string,
    dateOrder?: DateOrder,
  ): Promise<ImportPreviewRow[]>;
  commitImport(fileName: string, rows: ImportRow[]): Promise<CommitImportResult>;
  getFinancialSummary(): Promise<FinancialSummary>;
  resetFinancialData(): Promise<void>;
}

export const budgetApi: BudgetApiClient = {
  unlock: (password) => invoke<void>("unlock", { password }),
  lock: () => invoke<void>("lock"),
  listCategories: () => invoke<Category[]>("list_categories"),
  previewImport: (csvText, fileName, dateOrder = "auto") =>
    invoke<ImportPreviewRow[]>("preview_import", { csvText, fileName, dateOrder }),
  commitImport: (fileName, rows) =>
    invoke<CommitImportResult>("commit_import", { fileName, rows }),
  getFinancialSummary: () => invoke<FinancialSummary>("get_financial_summary"),
  resetFinancialData: () => invoke<void>("reset_financial_data"),
};
