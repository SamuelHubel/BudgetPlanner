import { useRef, useState, type ChangeEvent } from "react";
import { getDb } from "../lib/db";
import { parseBankCsv, type ParsedTransaction } from "../lib/csvParser";
import {
  categorizeTransactions,
  loadCategories,
  saveImportedTransactions,
  type Category,
} from "../lib/transactionImport";
import "./TransactionImport.css";

type Props = {
  onImported?: () => void;
};

export default function TransactionImport({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setError("");
    setStatus("");
    setIsLoading(true);
    try {
      const db = await getDb();
      const parsed = parseBankCsv(await file.text());
      const [availableCategories, categorized] = await Promise.all([
        loadCategories(db),
        categorizeTransactions(db, parsed),
      ]);
      setFileName(file.name);
      setCategories(availableCategories);
      setTransactions(categorized);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to read this CSV.");
      setTransactions([]);
    } finally {
      setIsLoading(false);
      input.value = "";
    }
  };

  const updateCategory = (index: number, value: string) => {
    const categoryId = value ? Number(value) : null;
    const category = categories.find((item) => item.id === categoryId);
    setTransactions((current) =>
      current.map((transaction, transactionIndex) =>
        transactionIndex === index
          ? {
              ...transaction,
              categoryId,
              categoryName: category?.name ?? null,
            }
          : transaction,
      ),
    );
  };

  const confirmImport = async () => {
    setError("");
    setStatus("");
    setIsLoading(true);
    try {
      await saveImportedTransactions(await getDb(), fileName, transactions);
      setStatus(`${transactions.length} transaction${transactions.length === 1 ? "" : "s"} imported.`);
      setTransactions([]);
      setFileName("");
      onImported?.();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save transactions.");
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
        <input ref={inputRef} className="hidden-file-input" type="file" accept=".csv,text/csv" onChange={handleFile} />
      </div>

      <p className="card-body">Review categories before anything is written to your transactions.</p>
      {error && <p className="import-message import-error" role="alert">{error}</p>}
      {status && <p className="import-message import-success">{status}</p>}

      {transactions.length > 0 && (
        <>
          <div className="transaction-table-wrap">
            <table className="transaction-table">
              <thead>
                <tr><th>Date</th><th>Description</th><th>Amount</th><th>Category</th></tr>
              </thead>
              <tbody>
                {transactions.map((transaction, index) => (
                  <tr key={`${transaction.date}-${index}`}>
                    <td>{transaction.date}</td>
                    <td>{transaction.description}</td>
                    <td>{transaction.amount.toFixed(2)}</td>
                    <td>
                      <select
                        aria-label={`Category for ${transaction.description}`}
                        value={transaction.categoryId ?? ""}
                        onChange={(event) => updateCategory(index, event.currentTarget.value)}
                      >
                        <option value="">Uncategorized</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                    </td>
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
