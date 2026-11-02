import { useMemo } from "react";
import type { Category, ImportPreviewRow, Subcategory } from "../../types";
import { formatCurrency } from "../../shared/format";

type ImportPreviewTableProps = {
  transactions: ImportPreviewRow[];
  categories: Category[];
  subcategories: Subcategory[];
  /** Whether rows can be assigned a subcategory. */
  useSubcategories: boolean;
  currency: string | null;
  onCategoryChange: (index: number, categoryId: string) => void;
  onSubcategoryChange: (index: number, subcategoryId: string) => void;
};

/** Shows parsed transactions and permits preview category adjustments. */
export default function ImportPreviewTable({
  transactions,
  categories,
  subcategories,
  useSubcategories,
  currency,
  onCategoryChange,
  onSubcategoryChange,
}: ImportPreviewTableProps) {
  const subcategoriesByCategory = useMemo(() => {
    const grouped = new Map<number, Subcategory[]>();
    for (const subcategory of subcategories) {
      const siblings = grouped.get(subcategory.categoryId) ?? [];
      siblings.push(subcategory);
      grouped.set(subcategory.categoryId, siblings);
    }
    return grouped;
  }, [subcategories]);

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
          {transactions.map((transaction, index) => {
            const needsCategory =
              transaction.categoryId === null && !transaction.isDuplicate;
            const rowSubcategories =
              transaction.categoryId === null
                ? []
                : (subcategoriesByCategory.get(transaction.categoryId) ?? []);
            return (
              <tr
                key={`${transaction.date}-${index}`}
                className={needsCategory ? "bg-amber-950/30" : undefined}
              >
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
                  {useSubcategories && (
                    <select
                      className="ml-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200 disabled:opacity-50"
                      aria-label={`Subcategory for ${transaction.description}`}
                      value={transaction.subcategoryId ?? ""}
                      disabled={rowSubcategories.length === 0}
                      onChange={(event) =>
                        onSubcategoryChange(index, event.currentTarget.value)
                      }
                    >
                      <option value="">General</option>
                      {rowSubcategories.map((subcategory) => (
                        <option key={subcategory.id} value={subcategory.id}>
                          {subcategory.name}
                        </option>
                      ))}
                    </select>
                  )}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
