import { useRef, useState, type ChangeEvent } from "react";
import type { BudgetApiClient } from "../../api/budgetApi";
import type { Category, DateOrder, ImportPreviewRow, ImportRow } from "../../types";
import { toErrorMessage } from "../../lib/errors";
import { useFinancialSummary } from "../home/useFinancialSummary";

/** Returns whether a string matches a supported import date order. */
export function isDateOrder(value: string): value is DateOrder {
  return value === "auto" || value === "mdy" || value === "dmy";
}

/** Manages CSV selection, preview edits, and import submission state. */
export function useImportFlow(api: BudgetApiClient, onImportCommitted?: () => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [transactions, setTransactions] = useState<ImportPreviewRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [dateOrder, setDateOrder] = useState<DateOrder>("auto");
  const [needsDateOrder, setNeedsDateOrder] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { currency, refresh } = useFinancialSummary();

  const loadPreview = async (contents: string, name: string, order: DateOrder) => {
    const [preview, availableCategories] = await Promise.all([
      api.previewImport(contents, name, order),
      api.listCategories(),
    ]);
    setTransactions(preview);
    setCategories(availableCategories);
    setNeedsDateOrder(false);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setError("");
    setStatus("");
    setTransactions([]);
    setNeedsDateOrder(false);
    setDateOrder("auto");
    setIsLoading(true);
    try {
      const contents = await file.text();
      setCsvText(contents);
      setFileName(file.name);
      await loadPreview(contents, file.name, "auto");
    } catch (caughtError) {
      const message = toErrorMessage(caughtError, "Unable to read this CSV.");
      setError(message);
      setNeedsDateOrder(message.toLowerCase().includes("date order is ambiguous"));
    } finally {
      setIsLoading(false);
      input.value = "";
    }
  };

  const handleDateOrder = async (order: DateOrder) => {
    setDateOrder(order);
    if (order === "auto" || !csvText || !fileName) return;
    setError("");
    setIsLoading(true);
    try {
      await loadPreview(csvText, fileName, order);
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, "Unable to read this CSV."));
    } finally {
      setIsLoading(false);
    }
  };

  const updateCategory = (index: number, value: string) => {
    const categoryId = value ? Number(value) : null;
    setTransactions((current) => current.map((transaction, transactionIndex) =>
      transactionIndex === index ? { ...transaction, categoryId } : transaction));
  };

  const confirmImport = async () => {
    setError("");
    setStatus("");
    setIsLoading(true);
    try {
      const rows: ImportRow[] = transactions.map(({ date, amountCents, description, categoryId }) => ({
        date, amountCents, description, categoryId,
      }));
      const result = await api.commitImport(fileName, rows);
      const inserted = `${result.inserted} transaction${result.inserted === 1 ? "" : "s"} imported`;
      const duplicates = result.skippedDuplicates > 0
        ? `; ${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? "" : "s"} skipped`
        : "";
      setStatus(`${inserted}${duplicates}.`);
      setTransactions([]);
      setFileName("");
      setCsvText("");
      setNeedsDateOrder(false);
      refresh();
      onImportCommitted?.();
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, "Unable to save transactions."));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    inputRef, transactions, categories, dateOrder, needsDateOrder, error, status,
    isLoading, currency, handleFile, handleDateOrder,
    updateCategory, confirmImport,
  };
}
