import { useState } from "react";
import Alert from "../../shared/Alert";
import { toErrorMessage } from "../../shared/errors";
import { formatCurrency, formatMonth } from "../../shared/format";
import MonthList, { ALL_TIME } from "./MonthList";
import MonthlyBarChart from "./MonthlyBarChart";
import { useFinancialSummary } from "./useFinancialSummary";
import SourceList from "./SourceList";
import SummaryDonut from "./SummaryDonut";

/** Loads and displays the selected period's financial overview. */
export default function HomeTab() {
  const {
    summary,
    currency,
    error,
    isLoading,
    categorySettings,
    updateCategorySettings,
  } = useFinancialSummary();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState("");
  const showSubcategories = categorySettings?.showSubcategoryCharts ?? false;

  const toggleSubcategoryCharts = async (showSubcategoryCharts: boolean) => {
    setSettingsError("");
    try {
      await updateCategorySettings({ showSubcategoryCharts });
    } catch (caughtError) {
      setSettingsError(
        toErrorMessage(caughtError, "Unable to save this setting."),
      );
    }
  };
  const isAllTime = selectedMonth === ALL_TIME;
  const selectedMonthBreakdown = isAllTime
    ? null
    : (summary?.monthlyBreakdowns.find(
        ({ month }) => month === selectedMonth,
      ) ??
      summary?.monthlyBreakdowns[summary.monthlyBreakdowns.length - 1] ??
      null);
  const displayedBreakdown =
    selectedMonthBreakdown?.breakdown ?? summary?.breakdown ?? null;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-slate-900">Home</h3>
      {error && <Alert>Unable to load financial data: {error}</Alert>}
      {isLoading && (
        <p className="py-3 text-sm text-slate-500" role="status">
          Loading financial data…
        </p>
      )}
      {!isLoading && !error && summary && displayedBreakdown && currency && (
        <>
          <MonthList
            months={summary.monthlyBreakdowns}
            selectedMonth={
              isAllTime ? ALL_TIME : (selectedMonthBreakdown?.month ?? null)
            }
            onSelect={setSelectedMonth}
          />
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
            {(isAllTime || selectedMonthBreakdown) && (
              <p className="text-slate-500" aria-live="polite">
                Showing income and expenses for{" "}
                {selectedMonthBreakdown
                  ? formatMonth(selectedMonthBreakdown.month)
                  : "all time"}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <section
                className="text-slate-500"
                aria-label="Uncategorized transactions"
              >
                Uncategorized{" "}
                <span className="font-semibold tabular-nums text-slate-900">
                  {formatCurrency(
                    displayedBreakdown.uncategorizedCents,
                    currency,
                  )}
                </span>
              </section>
              <label className="flex items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-slate-900"
                  checked={showSubcategories}
                  disabled={!categorySettings}
                  onChange={(event) =>
                    void toggleSubcategoryCharts(event.currentTarget.checked)
                  }
                />
                Show subcategory charts
              </label>
            </div>
          </div>
          {settingsError && <Alert>{settingsError}</Alert>}
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            <SummaryDonut
              title="Income"
              categories={displayedBreakdown.income}
              uncategorizedCents={displayedBreakdown.uncategorizedIncomeCents}
              currency={currency}
              showSubcategories={showSubcategories}
            />
            <SummaryDonut
              title="Expenses"
              categories={displayedBreakdown.expenses}
              uncategorizedCents={displayedBreakdown.uncategorizedExpensesCents}
              currency={currency}
              showSubcategories={showSubcategories}
            />
          </div>
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            <SourceList
              title="Largest income sources"
              sources={displayedBreakdown.largestIncomeSources}
              currency={currency}
            />
            <SourceList
              title="Largest expenses"
              sources={displayedBreakdown.largestExpenses}
              currency={currency}
            />
          </div>
          <MonthlyBarChart
            totals={summary.monthlyTotals}
            currency={currency}
            selectedMonth={
              isAllTime ? null : (selectedMonthBreakdown?.month ?? null)
            }
            onSelectMonth={setSelectedMonth}
          />
        </>
      )}
    </div>
  );
}
