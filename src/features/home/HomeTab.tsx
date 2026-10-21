import { useState } from "react";
import type { BudgetApiClient } from "../../api/budgetApi";
import { formatCurrency, formatMonth } from "../../shared/format";
import MonthList from "./MonthList";
import MonthlyBarChart from "./MonthlyBarChart";
import { useFinancialSummary } from "./useFinancialSummary";
import SourceList from "./SourceList";
import SummaryDonut from "./SummaryDonut";
import TransactionImport from "../import/TransactionImport";

type HomeTabProps = {
  api: BudgetApiClient;
};

/** Loads and displays the selected period's financial overview. */
export default function HomeTab({ api }: HomeTabProps) {
  const { summary, currency, error, isLoading } = useFinancialSummary();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const selectedMonthBreakdown = summary?.monthlyBreakdowns.find(({ month }) => month === selectedMonth)
    ?? summary?.monthlyBreakdowns[summary.monthlyBreakdowns.length - 1]
    ?? null;
  const displayedBreakdown = selectedMonthBreakdown?.breakdown ?? summary?.breakdown ?? null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-white">Home</h3>
        <p className="text-sm text-slate-400">Your income and expenses, organized by category and month.</p>
      </div>
      {error && <p className="rounded-xl bg-rose-950/60 px-3 py-2 text-sm text-rose-200" role="alert">Unable to load financial data: {error}</p>}
      {isLoading && <p className="py-3 text-sm text-slate-500" role="status">Loading financial data…</p>}
      {!isLoading && !error && summary && displayedBreakdown && currency && (
        <>
          <MonthList months={summary.monthlyBreakdowns} selectedMonth={selectedMonthBreakdown?.month ?? null} onSelect={setSelectedMonth} />
          {selectedMonthBreakdown && (
            <p className="-mb-2 text-sm text-slate-400" aria-live="polite">
              Showing income and expenses for {formatMonth(selectedMonthBreakdown.month)}
            </p>
          )}
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            <SummaryDonut title="Income" categories={displayedBreakdown.income} uncategorizedCents={displayedBreakdown.uncategorizedIncomeCents} currency={currency} />
            <SummaryDonut title="Expenses" categories={displayedBreakdown.expenses} uncategorizedCents={displayedBreakdown.uncategorizedExpensesCents} currency={currency} />
          </div>
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4" aria-label="Uncategorized transactions">
            <h4 className="text-lg font-semibold text-white">Uncategorized</h4>
            <p className="text-lg text-white">{formatCurrency(displayedBreakdown.uncategorizedCents, currency)}</p>
          </section>
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            <SourceList title="Largest income sources" sources={displayedBreakdown.largestIncomeSources} currency={currency} />
            <SourceList title="Largest expenses" sources={displayedBreakdown.largestExpenses} currency={currency} />
          </div>
          <MonthlyBarChart totals={summary.monthlyTotals} currency={currency} />
        </>
      )}
      <TransactionImport api={api} />
    </div>
  );
}
