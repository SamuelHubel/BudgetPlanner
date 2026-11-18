import { useState } from "react";
import type { MonthlyTotal } from "../../types";
import { formatCurrency, formatMonth } from "../../shared/format";

type MonthlyBarChartProps = {
  totals: MonthlyTotal[];
  currency: string;
  /** The month (`YYYY-MM`) shown elsewhere on the page, or null for all time. */
  selectedMonth: string | null;
  /** Called when a point on the line graph is clicked. */
  onSelectMonth: (month: string) => void;
};

type ChartView = "bar" | "line";

const SERIES = [
  { key: "incomeCents", name: "income", color: "bg-cyan-500" },
  { key: "expensesCents", name: "expenses", color: "bg-violet-500" },
] as const;

/** Charts monthly income and expense totals as bars or lines. */
export default function MonthlyBarChart({
  totals,
  currency,
  selectedMonth,
  onSelectMonth,
}: MonthlyBarChartProps) {
  const [view, setView] = useState<ChartView>("bar");
  // A line needs two points, so single-month data always shows bars.
  const canShowLine = totals.length > 1;
  const isLine = view === "line" && canShowLine;
  const maxAmountCents = Math.max(
    0,
    ...totals.flatMap(({ incomeCents, expensesCents }) => [
      Math.max(0, incomeCents),
      Math.max(0, expensesCents),
    ]),
  );
  const percentOfMax = (cents: number) =>
    maxAmountCents > 0 ? (Math.max(0, cents) / maxAmountCents) * 100 : 0;
  /** Position of a point as percentages of the plot's width and height. */
  const pointPosition = (index: number, cents: number) => ({
    x: ((index + 0.5) / totals.length) * 100,
    // 10% headroom: the scroll wrapper clips overflow, which would cut off dots at the max.
    y: 100 - percentOfMax(cents) * 0.9,
  });
  const linePoints = (pick: (total: MonthlyTotal) => number) =>
    totals
      .map((total, index) => {
        const { x, y } = pointPosition(index, pick(total));
        return `${x},${y}`;
      })
      .join(" ");
  const itemLabel = ({ month, incomeCents, expensesCents }: MonthlyTotal) =>
    `${formatMonth(month, "short")}: income ${formatCurrency(incomeCents, currency)}, expenses ${formatCurrency(expensesCents, currency)}`;

  return (
    <section
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-4"
      aria-labelledby="monthly-chart-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4
          className="text-lg font-semibold text-slate-900"
          id="monthly-chart-title"
        >
          Income and expenses by month
        </h4>
        {canShowLine && (
          <div
            className="flex rounded-md border border-slate-200 p-0.5 text-sm"
            role="group"
            aria-label="Chart type"
          >
            {(["bar", "line"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`rounded px-3 py-1 font-medium ${
                  view === option
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
                aria-pressed={view === option}
                onClick={() => setView(option)}
              >
                {option === "bar" ? "Bar" : "Line"}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700"
        aria-label="Chart legend"
      >
        <span className="flex items-center gap-2">
          <i
            className="inline-block h-3 w-3 rounded-sm bg-cyan-500"
            aria-hidden="true"
          />
          Income
        </span>
        <span className="flex items-center gap-2">
          <i
            className="inline-block h-3 w-3 rounded-sm bg-violet-500"
            aria-hidden="true"
          />
          Expenses
        </span>
      </div>
      {totals.length === 0 ? (
        <p className="py-3 text-sm text-slate-500">
          Monthly totals will appear as categorized statements are imported.
        </p>
      ) : isLine ? (
        <div className="mt-4 overflow-x-auto pb-2">
          <div style={{ minWidth: `${totals.length * 3.5}rem` }}>
            <div className="relative">
              <svg
                className="block h-48 w-full overflow-visible border-b border-slate-300"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  className="stroke-cyan-500"
                  points={linePoints(({ incomeCents }) => incomeCents)}
                  fill="none"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                <polyline
                  className="stroke-violet-500"
                  points={linePoints(({ expensesCents }) => expensesCents)}
                  fill="none"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {totals.flatMap((total, index) =>
                SERIES.map(({ key, name, color }) => {
                  const { x, y } = pointPosition(index, total[key]);
                  const isSelected = total.month === selectedMonth;
                  return (
                    // HTML buttons, not SVG circles, so the stretched viewBox doesn't squash them.
                    <button
                      key={`${total.month}-${name}`}
                      type="button"
                      className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                      style={{ left: `${x}%`, top: `${y}%` }}
                      aria-label={`${formatMonth(total.month, "short")} ${name} ${formatCurrency(total[key], currency)}`}
                      aria-pressed={isSelected}
                      onClick={() => onSelectMonth(total.month)}
                    >
                      <span
                        className={`block rounded-full border-2 border-white ${color} ${
                          isSelected
                            ? "h-4 w-4 ring-2 ring-slate-900"
                            : "h-3 w-3"
                        }`}
                      />
                    </button>
                  );
                }),
              )}
            </div>
            <ol
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${totals.length}, minmax(0, 1fr))`,
              }}
              aria-label="Monthly income and expenses"
            >
              {totals.map((total) => (
                <li
                  className="min-w-0 text-center"
                  key={total.month}
                  aria-label={itemLabel(total)}
                >
                  <span className="mt-2 block truncate text-xs text-slate-500">
                    {formatMonth(total.month, "short")}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <ol
          className="mt-4 grid auto-cols-[minmax(3.5rem,1fr)] grid-flow-col gap-2 overflow-x-auto pb-2"
          aria-label="Monthly income and expenses"
        >
          {totals.map((total) => (
            <li
              className="min-w-0 text-center"
              key={total.month}
              aria-label={itemLabel(total)}
            >
              <div
                className="flex h-48 items-end justify-center gap-1 border-b border-slate-300"
                aria-hidden="true"
              >
                <span
                  className="block w-4 rounded-t-sm bg-cyan-500"
                  style={{ height: `${percentOfMax(total.incomeCents)}%` }}
                />
                <span
                  className="block w-4 rounded-t-sm bg-violet-500"
                  style={{ height: `${percentOfMax(total.expensesCents)}%` }}
                />
              </div>
              <span className="mt-2 block truncate text-xs text-slate-500">
                {formatMonth(total.month, "short")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
