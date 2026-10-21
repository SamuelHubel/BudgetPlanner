import type { Category, ImportPreviewRow } from "../../types";
import { formatCurrency } from "../../shared/format";

type ImportPreviewTableProps = {
  transactions: ImportPreviewRow[];
  categories: Category[];
  currency: string | null;
  onCategoryChange: (index: number, categoryId: string) => void;
};

/** Shows parsed transactions and permits preview category adjustments. */
export default function ImportPreviewTable({
  transactions,
  categories,
  currency,
  onCategoryChange,
}: ImportPreviewTableProps) {
  return (
    <div className="mt-4 max-h-96 overflow-auto rounded-2xl border border-slate-800">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {["Date", "Description", "Amount", "Category", "Status"].map(
              (heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="sticky top-0 bg-slate-900 px-3 py-2 font-medium text-slate-400"
                >
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, index) => (
            <tr key={`${transaction.date}-${index}`}>
              <td className="border-t border-slate-800 px-3 py-2 text-slate-300">
                {transaction.date}
              </td>
              <td className="border-t border-slate-800 px-3 py-2 text-slate-300">
                {transaction.description}
              </td>
              <td className="border-t border-slate-800 px-3 py-2 text-slate-300">
                {currency
                  ? formatCurrency(transaction.amountCents, currency)
                  : "Currency unavailable"}
              </td>
              <td className="border-t border-slate-800 px-3 py-2 text-slate-300">
                <select
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
                  aria-label={`Category for ${transaction.description}`}
                  value={transaction.categoryId ?? ""}
                  onChange={(event) =>
                    onCategoryChange(index, event.currentTarget.value)
                  }
                >
                  <option value="">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {transaction.statementCategoryName &&
                  !transaction.categoryId && (
                    <small className="ml-2 text-amber-300">
                      Statement category not available:{" "}
                      {transaction.statementCategoryName}
                    </small>
                  )}
              </td>
              <td className="border-t border-slate-800 px-3 py-2 text-slate-300">
                {transaction.isDuplicate ? "Already imported" : "New"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
