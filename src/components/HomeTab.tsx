import { useEffect, useState } from "react";
import type { BudgetApiClient } from "../api/budgetApi";
import { toErrorMessage } from "../lib/errors";
import type {
  CategoryTotal,
  FinancialBreakdown,
  FinancialSource,
  FinancialSummary,
  MonthlyBreakdown,
  MonthlyTotal,
} from "../types";
import { formatCurrency, formatMonth } from "../lib/formatting";
import "./HomeTab.css";
import TransactionImport from "./TransactionImport";

const fallbackColors = ["#22d3ee", "#818cf8", "#34d399", "#fbbf24", "#fb7185", "#c084fc"];

function SummaryChart({ title, categories }: { title: string; categories: CategoryTotal[] }) {
  const total = categories.reduce((sum, item) => sum + item.amountCents, 0);
  const plottedTotal = categories.reduce((sum, item) => sum + Math.max(0, item.amountCents), 0);
  const circumference = 2 * Math.PI * 56;
  let offset = 0;
  const [hoveredCategoryId, setHoveredCategoryId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const activeCategory = categories.find(({ category }) => category.id === hoveredCategoryId)
    ?? categories.find(({ category }) => category.id === selectedCategoryId);
  const activeCategoryId = activeCategory?.category.id ?? null;

  const toggleCategory = (categoryId: number) => {
    setSelectedCategoryId((current) => current === categoryId ? null : categoryId);
  };

  return (
    <section className="card summary-chart" aria-labelledby={`${title.toLowerCase()}-chart-title`}>
      <div className="summary-chart-heading">
        <div>
          <h4 className="summary-title" id={`${title.toLowerCase()}-chart-title`}>{title}</h4>
        </div>
        <strong className="summary-total">{formatCurrency(total)}</strong>
      </div>
      <div className="chart-content">
        <div
          className="donut-chart"
          role="group"
          aria-label={`${title} chart totaling ${formatCurrency(total)} across ${categories.length} categories`}
        >
          <svg viewBox="0 0 144 144">
            <circle className="chart-track" cx="72" cy="72" r="56" />
            {categories.map(({ category, amountCents }, index) => {
              const segmentLength = plottedTotal > 0
                ? (Math.max(0, amountCents) / plottedTotal) * circumference
                : 0;
              const color = category.color ?? fallbackColors[index % fallbackColors.length];
              const isActive = category.id === activeCategoryId;
              const segment = (
                <circle
                  key={category.id}
                  className={`chart-segment${isActive ? " is-active" : ""}${activeCategoryId !== null && !isActive ? " is-dimmed" : ""}`}
                  cx="72"
                  cy="72"
                  r="56"
                  fill="none"
                  stroke={color}
                  strokeWidth={isActive ? 26 : 20}
                  strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 72 72)"
                  role="button"
                  tabIndex={0}
                  aria-label={`${category.name}: ${formatCurrency(amountCents)}`}
                  aria-pressed={selectedCategoryId === category.id}
                  onMouseEnter={() => setHoveredCategoryId(category.id)}
                  onMouseLeave={() => setHoveredCategoryId(null)}
                  onFocus={() => setHoveredCategoryId(category.id)}
                  onBlur={() => setHoveredCategoryId(null)}
                  onClick={() => toggleCategory(category.id)}
                />
              );
              offset += segmentLength;
              return segment;
            })}
          </svg>
          {activeCategory ? (
            <div className="chart-popup" role="status" aria-live="polite">
              <span>{activeCategory.category.name}</span>
              <strong>{formatCurrency(activeCategory.amountCents)}</strong>
            </div>
          ) : (
            <span className="chart-center">{formatCurrency(total)}</span>
          )}
        </div>
        <ul className="chart-legend">
          {categories.map(({ category }, index) => (
            <li key={category.id}>
              <button
                type="button"
                className={`legend-button${category.id === activeCategoryId ? " is-active" : ""}`}
                aria-label={category.name}
                aria-pressed={selectedCategoryId === category.id}
                onMouseEnter={() => setHoveredCategoryId(category.id)}
                onMouseLeave={() => setHoveredCategoryId(null)}
                onFocus={() => setHoveredCategoryId(category.id)}
                onBlur={() => setHoveredCategoryId(null)}
                onClick={() => toggleCategory(category.id)}
              >
                <span
                  className="legend-swatch"
                  style={{ backgroundColor: category.color ?? fallbackColors[index % fallbackColors.length] }}
                  aria-hidden="true"
                />
                <span className="legend-name">{category.name}</span>
              </button>
            </li>
          ))}
          {categories.length === 0 && <li className="summary-empty">No categorized activity yet.</li>}
        </ul>
      </div>
    </section>
  );
}

function SourceList({ title, sources }: { title: string; sources: FinancialSource[] }) {
  const headingId = `${title.toLowerCase().replace(/ /g, "-")}-title`;

  return (
    <section className="card source-card" aria-labelledby={headingId}>
      <h4 className="summary-title" id={headingId}>{title}</h4>
      {sources.length > 0 ? (
        <ol className="source-list">
          {sources.map((source) => (
            <li key={`${source.categoryName}-${source.description}`}>
              <span className="source-description">
                <span>{source.description}</span>
                <small>{source.categoryName}</small>
              </span>
              <strong>{formatCurrency(source.amountCents)}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="summary-empty">No categorized activity yet.</p>
      )}
    </section>
  );
}

function MonthList({
  months,
  selectedMonth,
  onSelect,
}: {
  months: MonthlyBreakdown[];
  selectedMonth: string | null;
  onSelect: (month: string) => void;
}) {
  return (
    <section className="card month-list-card" aria-labelledby="tracked-months-title">
      <div>
        <h4 className="summary-title" id="tracked-months-title">Tracked months</h4>
        <p className="month-list-description">Select a month to view its income and expenses.</p>
      </div>
      {months.length > 0 ? (
        <ul className="month-list">
          {[...months].reverse().map(({ month }) => (
            <li key={month}>
              <button
                type="button"
                className={`month-list-button${month === selectedMonth ? " is-selected" : ""}`}
                aria-pressed={month === selectedMonth}
                onClick={() => onSelect(month)}
              >
                {formatMonth(month)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="summary-empty">Months will appear as transactions are imported.</p>
      )}
    </section>
  );
}

function MonthlyBarChart({ totals }: { totals: MonthlyTotal[] }) {
  const maxAmountCents = Math.max(0, ...totals.flatMap(({ incomeCents, expensesCents }) => [
    Math.max(0, incomeCents),
    Math.max(0, expensesCents),
  ]));

  return (
    <section className="card monthly-chart" aria-labelledby="monthly-chart-title">
      <h4 className="summary-title" id="monthly-chart-title">Income and expenses by month</h4>
      <div className="monthly-chart-legend" aria-label="Chart legend">
        <span><i className="monthly-bar-income" aria-hidden="true" />Income</span>
        <span><i className="monthly-bar-expenses" aria-hidden="true" />Expenses</span>
      </div>
      {totals.length > 0 ? (
        <ol className="monthly-bars" aria-label="Monthly income and expenses">
          {totals.map(({ month, incomeCents, expensesCents }) => {
            const label = formatMonth(month, "short");

            return (
              <li
                className="monthly-bar-group"
                key={month}
                aria-label={`${label}: income ${formatCurrency(incomeCents)}, expenses ${formatCurrency(expensesCents)}`}
              >
                <div className="monthly-bar-pair" aria-hidden="true">
                  <span
                    className="monthly-bar monthly-bar-income"
                    style={{ height: `${maxAmountCents > 0 ? (Math.max(0, incomeCents) / maxAmountCents) * 100 : 0}%` }}
                  />
                  <span
                    className="monthly-bar monthly-bar-expenses"
                    style={{ height: `${maxAmountCents > 0 ? (Math.max(0, expensesCents) / maxAmountCents) * 100 : 0}%` }}
                  />
                </div>
                <span className="monthly-bar-label">{label}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="summary-empty">Monthly totals will appear as categorized statements are imported.</p>
      )}
    </section>
  );
}

export default function HomeTab({ api }: { api: BudgetApiClient }) {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError("");

    void api
      .getFinancialSummary()
      .then((result) => {
        if (isCurrent) setSummary(result);
      })
      .catch((caughtError: unknown) => {
        if (isCurrent) {
          setError(toErrorMessage(caughtError, "Unable to load financial data."));
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [api, refreshKey]);

  const currentMonth = summary?.monthlyBreakdowns.find(({ month }) => month === selectedMonth)
    ?? summary?.monthlyBreakdowns[summary.monthlyBreakdowns.length - 1]
    ?? null;
  const currentBreakdown: FinancialBreakdown | null =
    currentMonth?.breakdown ?? summary?.breakdown ?? null;

  return (
    <div className="tab-content">
      <div className="stack">
        <h3 className="tab-title">Home</h3>
        <p className="tab-sub">Your income and expenses, organized by category and month.</p>
      </div>

      {error && <p className="summary-error" role="alert">Unable to load financial data: {error}</p>}
      {isLoading && <p className="summary-empty" role="status">Loading financial data…</p>}
      {!isLoading && !error && summary && currentBreakdown && (
        <>
          <MonthList
            months={summary.monthlyBreakdowns}
            selectedMonth={currentMonth?.month ?? null}
            onSelect={setSelectedMonth}
          />
          {currentMonth && (
            <p className="selected-month-label" aria-live="polite">
              Showing income and expenses for {formatMonth(currentMonth.month)}
            </p>
          )}
          <div className="grid-two">
            <SummaryChart title="Income" categories={currentBreakdown.income} />
            <SummaryChart title="Expenses" categories={currentBreakdown.expenses} />
          </div>
          <section className="card" aria-label="Uncategorized transactions">
            <h4 className="summary-title">Uncategorized</h4>
            <p className="summary-total">{formatCurrency(currentBreakdown.uncategorizedCents)}</p>
          </section>
          <div className="grid-two">
            <SourceList title="Largest income sources" sources={currentBreakdown.largestIncomeSources} />
            <SourceList title="Largest expenses" sources={currentBreakdown.largestExpenses} />
          </div>
          <MonthlyBarChart totals={summary.monthlyTotals} />
        </>
      )}

      <TransactionImport
        api={api}
        onImported={() => setRefreshKey((current) => current + 1)}
      />
    </div>
  );
}
