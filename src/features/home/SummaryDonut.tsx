import { useState } from "react";
import type { CategoryTotal } from "../../types";
import { formatCurrency } from "../../shared/format";

const FALLBACK_COLORS = ["#22d3ee", "#818cf8", "#34d399", "#fbbf24", "#fb7185", "#c084fc"];
const DONUT_RADIUS = 56;
const DONUT_VIEWBOX = 144;
const DONUT_CENTER = DONUT_VIEWBOX / 2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

type SummaryDonutProps = {
  title: string;
  categories: CategoryTotal[];
  uncategorizedCents: number;
  currency: string;
};

export default function SummaryDonut({
  title,
  categories,
  uncategorizedCents,
  currency,
}: SummaryDonutProps) {
  const chartCategories = [
    ...categories.map(({ category, amountCents }) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      amountCents,
    })),
    ...(uncategorizedCents === 0 ? [] : [{
      id: -1,
      name: "Uncategorized",
      color: "#94a3b8",
      amountCents: uncategorizedCents,
    }]),
  ];
  const total = chartCategories.reduce((sum, item) => sum + item.amountCents, 0);
  const plottedTotal = chartCategories.reduce((sum, item) => sum + Math.max(0, item.amountCents), 0);
  const [hoveredCategoryId, setHoveredCategoryId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const activeCategory = chartCategories.find(({ id }) => id === hoveredCategoryId)
    ?? chartCategories.find(({ id }) => id === selectedCategoryId);
  let offset = 0;

  const toggleCategory = (categoryId: number) => {
    setSelectedCategoryId((current) => current === categoryId ? null : categoryId);
  };

  return (
    <section className="min-w-0 rounded-3xl border border-slate-800 bg-slate-950/80 p-4" aria-labelledby={`${title.toLowerCase()}-chart-title`}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="mt-1 text-lg font-semibold text-white" id={`${title.toLowerCase()}-chart-title`}>{title}</h4>
        <strong className="text-lg text-white">{formatCurrency(total, currency)}</strong>
      </div>
      <div className="mt-4 grid items-center justify-items-center gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="relative aspect-square w-36 shrink-0" role="group" aria-label={`${title} chart totaling ${formatCurrency(total, currency)} across ${chartCategories.length} categories`}>
          <svg viewBox={`0 0 ${DONUT_VIEWBOX} ${DONUT_VIEWBOX}`}>
            <circle className="fill-none stroke-slate-800" cx={DONUT_CENTER} cy={DONUT_CENTER} r={DONUT_RADIUS} strokeWidth="20" />
            {chartCategories.map(({ id, name, color, amountCents }, index) => {
              const segmentLength = plottedTotal > 0 ? (Math.max(0, amountCents) / plottedTotal) * DONUT_CIRCUMFERENCE : 0;
              const isActive = id === (activeCategory?.id ?? null);
              const segment = (
                <circle
                  key={id}
                  className={`cursor-pointer transition-all duration-150 focus-visible:drop-shadow-[0_0_4px_white]${activeCategory && !isActive ? " opacity-30" : ""}`}
                  cx={DONUT_CENTER}
                  cy={DONUT_CENTER}
                  r={DONUT_RADIUS}
                  fill="none"
                  stroke={color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
                  strokeWidth={isActive ? 26 : 20}
                  strokeDasharray={`${segmentLength} ${DONUT_CIRCUMFERENCE - segmentLength}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${DONUT_CENTER} ${DONUT_CENTER})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${name}: ${formatCurrency(amountCents, currency)}`}
                  aria-pressed={selectedCategoryId === id}
                  onMouseEnter={() => setHoveredCategoryId(id)}
                  onMouseLeave={() => setHoveredCategoryId(null)}
                  onFocus={() => setHoveredCategoryId(id)}
                  onBlur={() => setHoveredCategoryId(null)}
                  onClick={() => toggleCategory(id)}
                />
              );
              offset += segmentLength;
              return segment;
            })}
          </svg>
          {activeCategory ? (
            <div className="pointer-events-none absolute inset-[22%] z-10 flex flex-col items-center justify-center rounded-full border border-slate-700 bg-slate-950/95 px-2 text-center shadow-lg" role="status" aria-live="polite">
              <span className="max-w-full truncate text-xs text-slate-300">{activeCategory.name}</span>
              <strong className="mt-1 text-sm font-semibold tabular-nums text-white">{formatCurrency(activeCategory.amountCents, currency)}</strong>
            </div>
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">{formatCurrency(total, currency)}</span>
          )}
        </div>
        <ul className="w-full min-w-0 space-y-2">
          {chartCategories.map(({ id, name, color }, index) => (
            <li key={id} className="text-sm text-slate-300">
              <button
                type="button"
                className={`flex w-full items-center gap-2 rounded-lg text-left transition hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400${id === (activeCategory?.id ?? null) ? " bg-slate-800/70 text-white" : ""}`}
                aria-label={name}
                aria-pressed={selectedCategoryId === id}
                onMouseEnter={() => setHoveredCategoryId(id)}
                onMouseLeave={() => setHoveredCategoryId(null)}
                onFocus={() => setHoveredCategoryId(id)}
                onBlur={() => setHoveredCategoryId(null)}
                onClick={() => toggleCategory(id)}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length] }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{name}</span>
              </button>
            </li>
          ))}
          {chartCategories.length === 0 && <li className="py-3 text-sm text-slate-500">No categorized activity yet.</li>}
        </ul>
      </div>
    </section>
  );
}
