// This component will be used to display the users financial data in a dashboard format
// Two pie charts, income and expenses across the top and category breakdowns across the bottom.
// Users can import bank statements where their spending will be categorized and displayed
// Some data will be processed for limited insights, such as
// "You spent 20% more on groceries this month than last month" 
// and/or
// "You spent 10% less on groceries this month than last month"

import { useEffect, useState } from "react";
import { getDb } from "../lib/db";
import {
  loadFinancialSummary,
  type CategoryTotal,
  type FinancialSource,
  type FinancialSummary,
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

  return (
    <section className="card summary-chart" aria-labelledby={`${title.toLowerCase()}-chart-title`}>
      <div className="summary-chart-heading">
        <div>
          <p className="card-kicker">By category</p>
          <h4 className="summary-title" id={`${title.toLowerCase()}-chart-title`}>{title}</h4>
        </div>
        <strong className="summary-total">{currency.format(total)}</strong>
      </div>
      <div className="chart-content">
        <div
          className="donut-chart"
          role="img"
          aria-label={`${title} chart totaling ${currency.format(total)} across ${categories.length} categories`}
        >
          <svg viewBox="0 0 144 144" aria-hidden="true">
            <circle className="chart-track" cx="72" cy="72" r="56" />
            {categories.map(({ category, amount }, index) => {
              const segmentLength = total > 0 ? (amount / total) * circumference : 0;
              const color = category.color ?? fallbackColors[index % fallbackColors.length];
              const segment = (
                <circle
                  key={category.id}
                  cx="72"
                  cy="72"
                  r="56"
                  fill="none"
                  stroke={color}
                  strokeWidth="20"
                  strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 72 72)"
                />
              );
              offset += segmentLength;
              return segment;
            })}
          </svg>
          <span className="chart-center">{currency.format(total)}</span>
        </div>
        <ul className="chart-legend">
          {categories.map(({ category, amount }, index) => (
            <li key={category.id}>
              <span
                className="legend-swatch"
                style={{ backgroundColor: category.color ?? fallbackColors[index % fallbackColors.length] }}
                aria-hidden="true"
              />
              <span className="legend-name">{category.name}</span>
              <span className="legend-amount">{currency.format(amount)}</span>
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
      <p className="card-kicker">Largest sources</p>
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
        <p className="tab-sub">Your income and expenses, organized by category.</p>
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
        </>
      )}

      <TransactionImport onImported={() => setRefreshKey((current) => current + 1)} />
    </div>
  );
}
