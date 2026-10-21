import type { MonthlyBreakdown } from "../../types";
import { formatMonth } from "../../shared/format";

type MonthListProps = {
  months: MonthlyBreakdown[];
  selectedMonth: string | null;
  onSelect: (month: string) => void;
};

export default function MonthList({ months, selectedMonth, onSelect }: MonthListProps) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-950/80 p-4" aria-labelledby="tracked-months-title">
      <div>
        <h4 className="mt-1 text-lg font-semibold text-white" id="tracked-months-title">Tracked months</h4>
        <p className="mt-1 text-sm text-slate-400">Select a month to view its income and expenses.</p>
      </div>
      {months.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {[...months].reverse().map(({ month }) => (
            <li key={month}>
              <button
                type="button"
                className={`rounded-xl border px-3 py-2 text-sm transition hover:border-cyan-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400${month === selectedMonth ? " border-cyan-400 bg-cyan-950/60 text-cyan-100" : " border-slate-700 bg-slate-900 text-slate-300"}`}
                aria-pressed={month === selectedMonth}
                onClick={() => onSelect(month)}
              >
                {formatMonth(month)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-3 text-sm text-slate-500">Months will appear as transactions are imported.</p>
      )}
    </section>
  );
}
