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
    <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {["Date", "Description", "Amount", "Category", "Status"].map(
              (heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="sticky top-0 bg-white px-3 py-2 font-medium text-slate-500"
                >
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, index) => {
            const needsCategory =
              transaction.categoryId === null && !transaction.isDuplicate;
            return (
              <tr
                key={`${transaction.date}-${index}`}
                className={needsCategory ? "bg-amber-50" : undefined}
              >
                <td className="border-t border-slate-200 px-3 py-2 text-slate-700">
                  {transaction.date}
                </td>
                <td className="border-t border-slate-200 px-3 py-2 text-slate-700">
                  {transaction.description}
                </td>
                <td className="border-t border-slate-200 px-3 py-2 text-slate-700">
                  {currency
                    ? formatCurrency(transaction.amountCents, currency)
                    : "Currency unavailable"}
                </td>
                <td className="border-t border-slate-200 px-3 py-2 text-slate-700">
                  <select
                    className="select-capped rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-800"
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
                      <small className="ml-2 text-amber-700">
                        Statement category not available:{" "}
                        {transaction.statementCategoryName}
                      </small>
                    )}
                </td>
                <td className="border-t border-slate-200 px-3 py-2 text-slate-700">
                  {transaction.isDuplicate ? "Already imported" : "New"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
