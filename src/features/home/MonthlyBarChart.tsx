import type { MonthlyTotal } from "../../types";
import { formatCurrency, formatMonth } from "../../shared/format";

type MonthlyBarChartProps = {
  totals: MonthlyTotal[];
  currency: string;
};

export default function MonthlyBarChart({ totals, currency }: MonthlyBarChartProps) {
  const maxAmountCents = Math.max(0, ...totals.flatMap(({ incomeCents, expensesCents }) => [
    Math.max(0, incomeCents),
    Math.max(0, expensesCents),
  ]));

  return (
    <section className="min-w-0 rounded-3xl border border-slate-800 bg-slate-950/80 p-4" aria-labelledby="monthly-chart-title">
      <h4 className="text-lg font-semibold text-white" id="monthly-chart-title">Income and expenses by month</h4>
      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-300" aria-label="Chart legend">
        <span className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-sm bg-cyan-400" aria-hidden="true" />Income</span>
        <span className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-sm bg-violet-400" aria-hidden="true" />Expenses</span>
      </div>
      {totals.length > 0 ? (
        <ol className="mt-4 grid auto-cols-[minmax(3.5rem,1fr)] grid-flow-col gap-2 overflow-x-auto pb-2" aria-label="Monthly income and expenses">
          {totals.map(({ month, incomeCents, expensesCents }) => {
            const label = formatMonth(month, "short");
            return (
              <li className="min-w-0 text-center" key={month} aria-label={`${label}: income ${formatCurrency(incomeCents, currency)}, expenses ${formatCurrency(expensesCents, currency)}`}>
                <div className="flex h-48 items-end justify-center gap-1 border-b border-slate-700" aria-hidden="true">
                  <span className="block w-4 rounded-t-sm bg-cyan-400" style={{ height: `${maxAmountCents > 0 ? (Math.max(0, incomeCents) / maxAmountCents) * 100 : 0}%` }} />
                  <span className="block w-4 rounded-t-sm bg-violet-400" style={{ height: `${maxAmountCents > 0 ? (Math.max(0, expensesCents) / maxAmountCents) * 100 : 0}%` }} />
                </div>
                <span className="mt-2 block truncate text-xs text-slate-400">{label}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="py-3 text-sm text-slate-500">Monthly totals will appear as categorized statements are imported.</p>
      )}
    </section>
  );
}
