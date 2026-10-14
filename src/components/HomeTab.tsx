import { useEffect, useState } from "react";
import { getDb } from "../lib/db";
import {
  loadFinancialSummary,
  type CategoryTotal,
  type FinancialSource,
  type FinancialSummary,
  type MonthlyTotal,
} from "../lib/financialSummary";
import "./HomeTab.css";
import TransactionImport from "./TransactionImport";

const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

const fallbackColors = ["#22d3ee", "#818cf8", "#34d399", "#fbbf24", "#fb7185", "#c084fc"];

function SummaryChart({ title, categories }: { title: string; categories: CategoryTotal[] }) {
  const total = categories.reduce((sum, item) => sum + item.amount, 0);
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
        <strong className="summary-total">{currency.format(total)}</strong>
      </div>
      <div className="chart-content">
        <div
          className="donut-chart"
          role="group"
          aria-label={`${title} chart totaling ${currency.format(total)} across ${categories.length} categories`}
        >
          <svg viewBox="0 0 144 144">
            <circle className="chart-track" cx="72" cy="72" r="56" />
            {categories.map(({ category, amount }, index) => {
              const segmentLength = total > 0 ? (amount / total) * circumference : 0;
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
                  aria-label={`${category.name}: ${currency.format(amount)}`}
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
              <strong>{currency.format(activeCategory.amount)}</strong>
            </div>
          ) : (
            <span className="chart-center">{currency.format(total)}</span>
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
              <strong>{currency.format(source.amount)}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="summary-empty">No categorized activity yet.</p>
      )}
    </section>
  );
}

function MonthlyBarChart({ totals }: { totals: MonthlyTotal[] }) {
  const maxAmount = Math.max(0, ...totals.flatMap(({ income, expenses }) => [income, expenses]));

  return (
    <section className="card monthly-chart" aria-labelledby="monthly-chart-title">
      <h4 className="summary-title" id="monthly-chart-title">Income and expenses by month</h4>
      <div className="monthly-chart-legend" aria-label="Chart legend">
        <span><i className="monthly-bar-income" aria-hidden="true" />Income</span>
        <span><i className="monthly-bar-expenses" aria-hidden="true" />Expenses</span>
      </div>
      {totals.length > 0 ? (
        <ol className="monthly-bars" aria-label="Monthly income and expenses">
          {totals.map(({ month, income, expenses }) => {
            const [year, monthNumber] = month.split("-").map(Number);
            const label = new Date(year, monthNumber - 1).toLocaleDateString(undefined, {
              month: "short",
              year: "numeric",
            });

            return (
              <li
                className="monthly-bar-group"
                key={month}
                aria-label={`${label}: income ${currency.format(income)}, expenses ${currency.format(expenses)}`}
              >
                <div className="monthly-bar-pair" aria-hidden="true">
                  <span
                    className="monthly-bar monthly-bar-income"
                    style={{ height: `${maxAmount > 0 ? (income / maxAmount) * 100 : 0}%` }}
                  />
                  <span
                    className="monthly-bar monthly-bar-expenses"
                    style={{ height: `${maxAmount > 0 ? (expenses / maxAmount) * 100 : 0}%` }}
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

export default function HomeTab() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError("");

    void getDb()
      .then(loadFinancialSummary)
      .then((result) => {
        if (isCurrent) setSummary(result);
      })
      .catch((caughtError: unknown) => {
        if (isCurrent) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load financial data.");
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [refreshKey]);

  return (
    <div className="tab-content">
      <div className="stack">
        <h3 className="tab-title">Home</h3>
        <p className="tab-sub">Your income and expenses, organized by category and month.</p>
      </div>

      {error && <p className="summary-error" role="alert">Unable to load financial data: {error}</p>}
      {isLoading && <p className="summary-empty" role="status">Loading financial data…</p>}
      {!isLoading && !error && summary && (
        <>
          <div className="grid-two">
            <SummaryChart title="Income" categories={summary.income} />
            <SummaryChart title="Expenses" categories={summary.expenses} />
          </div>
          <div className="grid-two">
            <SourceList title="Largest income sources" sources={summary.largestIncomeSources} />
            <SourceList title="Largest expenses" sources={summary.largestExpenses} />
          </div>
          <MonthlyBarChart totals={summary.monthlyTotals} />
        </>
      )}

      <TransactionImport onImported={() => setRefreshKey((current) => current + 1)} />
    </div>
  );
}
