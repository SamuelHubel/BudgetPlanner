import { useRef, useState, type ChangeEvent } from "react";
import type { BudgetApiClient } from "../../api/budgetApi";
import type {
  AmountFormat,
  Category,
  DateOrder,
  ImportPreviewRow,
  ImportRow,
} from "../../types";
import { errorCode, toErrorMessage } from "../../shared/errors";
import { useFinancialSummary } from "../home/useFinancialSummary";

/** Returns whether a string matches a supported import date order. */
export function isDateOrder(value: string): value is DateOrder {
  return value === "auto" || value === "mdy" || value === "dmy";
}

/** Returns whether a string matches a supported amount format. */
export function isAmountFormat(value: string): value is AmountFormat {
  return value === "auto" || value === "decimalDot" || value === "decimalComma";
}

/** Manages CSV selection, preview edits, and import submission state. */
export function useImportFlow(api: BudgetApiClient) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [transactions, setTransactions] = useState<ImportPreviewRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [dateOrder, setDateOrder] = useState<DateOrder>("auto");
  const [needsDateOrder, setNeedsDateOrder] = useState(false);
  const [amountFormat, setAmountFormat] = useState<AmountFormat>("auto");
  const [needsAmountFormat, setNeedsAmountFormat] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { currency, refresh } = useFinancialSummary();

  /**
   * Parses the statement with the given choices. A file can need both a date
   * order and an amount format, and each failure reveals only one, so a prompt
   * stays up until a preview succeeds.
   */
  const loadPreview = async (
    contents: string,
    name: string,
    order: DateOrder,
    format: AmountFormat,
  ) => {
    setError("");
    setIsLoading(true);
    try {
      const [preview, availableCategories] = await Promise.all([
        api.previewImport(contents, name, order, format),
        api.listCategories(),
      ]);
      setTransactions(preview);
      setCategories(availableCategories);
      setNeedsDateOrder(false);
      setNeedsAmountFormat(false);
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, "Unable to read this CSV."));
      const code = errorCode(caughtError);
      if (code === "ambiguousDateOrder") setNeedsDateOrder(true);
      if (code === "ambiguousAmount") setNeedsAmountFormat(true);
    } finally {
      setIsLoading(false);
    }
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
    setNeedsAmountFormat(false);
    setAmountFormat("auto");
    try {
      const contents = await file.text();
      setCsvText(contents);
      setFileName(file.name);
      await loadPreview(contents, file.name, "auto", "auto");
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, "Unable to read this CSV."));
    } finally {
      input.value = "";
    }
  };

  const handleDateOrder = async (order: DateOrder) => {
    setDateOrder(order);
    if (order === "auto" || !csvText || !fileName) return;
    await loadPreview(csvText, fileName, order, amountFormat);
  };

  const handleAmountFormat = async (format: AmountFormat) => {
    setAmountFormat(format);
    if (format === "auto" || !csvText || !fileName) return;
    await loadPreview(csvText, fileName, dateOrder, format);
  };

  const updateCategory = (index: number, value: string) => {
    const categoryId = value ? Number(value) : null;
    setTransactions((current) =>
      current.map((transaction, transactionIndex) =>
        transactionIndex === index
          ? { ...transaction, categoryId }
          : transaction,
      ),
    );
  };

  const confirmImport = async () => {
    setError("");
    setStatus("");
    setIsLoading(true);
    try {
      const rows: ImportRow[] = transactions.map(
        ({ date, amountCents, description, categoryId }) => ({
          date,
          amountCents,
          description,
          categoryId,
        }),
      );
      const result = await api.commitImport(fileName, rows);
      const inserted = `${result.inserted} transaction${result.inserted === 1 ? "" : "s"} imported`;
      const duplicates =
        result.skippedDuplicates > 0
          ? `; ${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? "" : "s"} skipped`
          : "";
      setStatus(`${inserted}${duplicates}.`);
      setTransactions([]);
      setFileName("");
      setCsvText("");
      setNeedsDateOrder(false);
      setNeedsAmountFormat(false);
      refresh();
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, "Unable to save transactions."));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    inputRef,
    transactions,
    categories,
    dateOrder,
    needsDateOrder,
    amountFormat,
    needsAmountFormat,
    error,
    status,
    isLoading,
    currency,
    handleFile,
    handleDateOrder,
    handleAmountFormat,
    updateCategory,
    confirmImport,
  };
}
