import type { MonthlyBreakdown } from "../../types";
import { formatMonth } from "../../shared/format";

/** Selection value for the all-time view in the month list. */
export const ALL_TIME = "all-time";

const BUTTON_CLASS =
  "rounded-xl border px-3 py-2 text-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900";
const SELECTED_CLASS = "border-slate-900 bg-slate-100 text-slate-900";
const UNSELECTED_CLASS = "border-slate-300 bg-white text-slate-700";

type MonthListProps = {
  months: MonthlyBreakdown[];
  /** The selected month, `ALL_TIME`, or `null` when nothing is tracked. */
  selectedMonth: string | null;
  onSelect: (month: string) => void;
};

/** Renders the all-time option and selectable months from the summary. */
export default function MonthList({
  months,
  selectedMonth,
  onSelect,
}: MonthListProps) {
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4"
      aria-labelledby="tracked-months-title"
    >
      <div>
        <h4
          className="mt-1 text-lg font-semibold text-slate-900"
          id="tracked-months-title"
        >
          Tracked months
        </h4>
        <p className="mt-1 text-sm text-slate-500">
          Select a month to view its income and expenses.
        </p>
      </div>
      {months.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {[...months].reverse().map(({ month }) => (
            <li key={month}>
              <button
                type="button"
                className={`${BUTTON_CLASS} ${month === selectedMonth ? SELECTED_CLASS : UNSELECTED_CLASS}`}
                aria-pressed={month === selectedMonth}
                onClick={() => onSelect(month)}
              >
                {formatMonth(month)}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={`${BUTTON_CLASS} ${selectedMonth === ALL_TIME ? SELECTED_CLASS : UNSELECTED_CLASS}`}
              aria-pressed={selectedMonth === ALL_TIME}
              onClick={() => onSelect(ALL_TIME)}
            >
              All time
            </button>
          </li>
        </ul>
      ) : (
        <p className="py-3 text-sm text-slate-500">
          Months will appear as transactions are imported.
        </p>
      )}
    </section>
  );
}
