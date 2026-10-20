import { useRef, useState, type ChangeEvent } from "react";
import type { BudgetApiClient } from "../api/budgetApi";
import type { Category, DateOrder, ImportPreviewRow, ImportRow } from "../types";
import { toErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/formatting";
import "./TransactionImport.css";

type Props = {
  api: BudgetApiClient;
  onImported?: () => void;
};

function isDateOrder(value: string): value is DateOrder {
  return value === "auto" || value === "mdy" || value === "dmy";
}

export default function TransactionImport({ api, onImported }: Props) {
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

  const loadPreview = async (
    contents: string,
    name: string,
    order: DateOrder,
  ) => {
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
    setTransactions((current) =>
      current.map((transaction, transactionIndex) =>
        transactionIndex === index ? { ...transaction, categoryId } : transaction,
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
      const duplicates = result.skippedDuplicates > 0
        ? `; ${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? "" : "s"} skipped`
        : "";
      setStatus(`${inserted}${duplicates}.`);
      setTransactions([]);
      setFileName("");
      setCsvText("");
      setNeedsDateOrder(false);
      onImported?.();
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, "Unable to save transactions."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="import-card card">
      <div className="import-heading">
        <div>
          <p className="card-kicker">Bank statement</p>
          <h4 className="import-title">Import transactions</h4>
        </div>
        <button type="button" className="primary-btn" onClick={() => inputRef.current?.click()} disabled={isLoading}>
          Choose CSV
        </button>
        <input ref={inputRef} className="hidden-file-input" type="file" accept=".csv,text/csv" aria-label="Choose a CSV file" onChange={handleFile} />
      </div>

      <p className="card-body">Review categories before anything is written to your transactions.</p>
      {error && <p className="import-message import-error" role="alert">{error}</p>}
      {needsDateOrder && (
        <label className="card-body">
          Choose the date order used by this statement
          <select
            aria-label="Statement date order"
            value={dateOrder}
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (isDateOrder(value)) void handleDateOrder(value);
            }}
            disabled={isLoading}
          >
            <option value="auto">Automatic</option>
            <option value="mdy">Month / day / year</option>
            <option value="dmy">Day / month / year</option>
          </select>
        </label>
      )}
      {status && <p className="import-message import-success" role="status">{status}</p>}

      {transactions.length > 0 && (
        <>
          <div className="transaction-table-wrap">
            <table className="transaction-table">
              <thead>
                <tr><th>Date</th><th>Description</th><th>Amount</th><th>Category</th><th>Status</th></tr>
              </thead>
              <tbody>
                {transactions.map((transaction, index) => (
                  <tr key={`${transaction.date}-${index}`}>
                    <td>{transaction.date}</td>
                    <td>{transaction.description}</td>
                    <td>{formatCurrency(transaction.amountCents)}</td>
                    <td>
                      <select
                        aria-label={`Category for ${transaction.description}`}
                        value={transaction.categoryId ?? ""}
                        onChange={(event) => updateCategory(index, event.currentTarget.value)}
                      >
                        <option value="">Uncategorized</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                      {transaction.statementCategoryName && !transaction.categoryId && (
                        <small className="ml-2 text-amber-300">
                          Statement category not available: {transaction.statementCategoryName}
                        </small>
                      )}
                    </td>
                    <td>{transaction.isDuplicate ? "Already imported" : "New"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="primary-btn import-confirm" onClick={confirmImport} disabled={isLoading}>
            Confirm import
          </button>
        </>
      )}
    </section>
  );
}
