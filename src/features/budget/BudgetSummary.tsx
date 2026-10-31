import { formatCurrency, formatMonth } from "../../shared/format";
import type { BudgetMonth, Budget, Category } from "../../types";
import BudgetDonut from "./BudgetDonut";
import { summarizeAllocations } from "./budgetMath";
import OverAllocationWarning from "./OverAllocationWarning";

type BudgetSummaryProps = {
  budget: Budget;
  view: BudgetMonth;
  categories: Category[];
  currency: string;
};

/** Shows a saved budget next to the month's actual spending. */
export default function BudgetSummary({
  budget,
  view,
  categories,
  currency,
}: BudgetSummaryProps) {
  const budgetedCents = new Map(
    budget.allocations.map(({ categoryId, amountCents }) => [
      categoryId,
      amountCents,
    ]),
  );
  const spentCents = new Map(
    view.actuals.map(({ categoryId, spentCents: spent }) => [
      categoryId,
      spent,
    ]),
  );
  const donutRows = categories.map(({ id, name, color }) => ({
    id,
    name,
    color,
    cents: budgetedCents.get(id) ?? 0,
  }));
  const tableRows = categories
    .filter(({ id }) => budgetedCents.has(id) || spentCents.has(id))
    .map(({ id, name, color }) => ({
      id,
      name,
      color,
      budgeted: budgetedCents.get(id) ?? 0,
      spent: spentCents.get(id) ?? 0,
    }));
  const summary = summarizeAllocations(
    donutRows.map(({ cents }) => cents),
    budget.expectedIncomeCents,
  );

  return (
    <div className="space-y-4">
      <div className="grid items-center gap-6 rounded-3xl border border-slate-800 bg-slate-950/80 p-4 sm:grid-cols-[13rem_minmax(0,1fr)]">
        <BudgetDonut
          rows={donutRows}
          incomeCents={budget.expectedIncomeCents}
          summary={summary}
          currency={currency}
          activeId={null}
        />
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-400">Expected income</dt>
            <dd className="text-lg font-semibold tabular-nums text-white">
              {formatCurrency(budget.expectedIncomeCents, currency)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-400">Allocated</dt>
            <dd className="text-lg font-semibold tabular-nums text-white">
              {formatCurrency(summary.allocatedCents, currency)}
            </dd>
          </div>
        </dl>
      </div>

      <OverAllocationWarning summary={summary} currency={currency} />

      <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
        <table
          className="w-full text-sm"
          aria-label={`Budget for ${formatMonth(budget.month)}`}
        >
          <thead>
            <tr className="text-left text-slate-400">
              <th className="pb-2 font-medium" scope="col">
                Category
              </th>
              <th className="pb-2 text-right font-medium" scope="col">
                Budgeted
              </th>
              <th className="pb-2 text-right font-medium" scope="col">
                Actual
              </th>
              <th className="pb-2 text-right font-medium" scope="col">
                Remaining
              </th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map(({ id, name, color, budgeted, spent }) => {
              const remaining = budgeted - spent;
              return (
                <tr key={id} className="border-t border-slate-800">
                  <th className="py-2 text-left font-normal" scope="row">
                    <span className="flex items-center gap-2 text-slate-200">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: color ?? "#94a3b8" }}
                        aria-hidden="true"
                      />
                      {name}
                    </span>
                  </th>
                  <td className="py-2 text-right tabular-nums text-slate-300">
                    {formatCurrency(budgeted, currency)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-300">
                    {formatCurrency(spent, currency)}
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums ${remaining < 0 ? "text-rose-300" : "text-slate-300"}`}
                  >
                    {remaining < 0
                      ? `Over by ${formatCurrency(-remaining, currency)}`
                      : formatCurrency(remaining, currency)}
                  </td>
                </tr>
              );
            })}
            {view.uncategorizedSpentCents > 0 && (
              <tr className="border-t border-slate-800">
                <th
                  className="py-2 text-left font-normal text-slate-400"
                  scope="row"
                >
                  Uncategorized
                </th>
                <td className="py-2 text-right text-slate-500">—</td>
                <td className="py-2 text-right tabular-nums text-slate-300">
                  {formatCurrency(view.uncategorizedSpentCents, currency)}
                </td>
                <td className="py-2 text-right text-slate-500">—</td>
              </tr>
            )}
            {tableRows.length === 0 && view.uncategorizedSpentCents === 0 && (
              <tr className="border-t border-slate-800">
                <td className="py-3 text-slate-400" colSpan={4}>
                  Nothing allocated or spent this month yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
