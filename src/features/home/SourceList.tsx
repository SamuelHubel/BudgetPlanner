import type { FinancialSource } from "../../types";
import { formatCurrency } from "../../shared/format";

type SourceListProps = {
  title: string;
  sources: FinancialSource[];
  currency: string;
};

/** Lists the largest categorized sources for a financial summary. */
export default function SourceList({
  title,
  sources,
  currency,
}: SourceListProps) {
  const headingId = `${title.toLowerCase().replace(/ /g, "-")}-title`;
  return (
    <section
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-4"
      aria-labelledby={headingId}
    >
      <h4 className="mt-1 text-lg font-semibold text-slate-900" id={headingId}>
        {title}
      </h4>
      {sources.length > 0 ? (
        <ol className="mt-3 divide-y divide-slate-200">
          {sources.map((source) => (
            <li
              key={`${source.categoryId}-${source.description}`}
              className="flex items-center justify-between gap-3 py-3 text-sm text-slate-800"
            >
              <span className="flex min-w-0 flex-col items-start text-left">
                <span className="max-w-full truncate">
                  {source.description}
                </span>
                <small className="mt-1 text-xs text-slate-500">
                  {source.categoryName}
                </small>
              </span>
              <strong className="shrink-0 tabular-nums">
                {formatCurrency(source.amountCents, currency)}
              </strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-3 text-sm text-slate-500">
          No categorized activity yet.
        </p>
      )}
    </section>
  );
}
