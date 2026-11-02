import { useState } from "react";
import {
  DonutArc,
  donutGeometry,
  DonutSvg,
  NEUTRAL_SEGMENT_COLOR,
} from "../../shared/Donut";
import { formatCurrency } from "../../shared/format";

const FALLBACK_COLORS = [
  "#22d3ee",
  "#818cf8",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#c084fc",
];
const GEOMETRY = donutGeometry(144, 56);

/** One slice of a donut panel. */
export type DonutItem = {
  id: number;
  name: string;
  /** Slice color, or `null` to use the next fallback color. */
  color: string | null;
  amountCents: number;
  /** Whether choosing this item opens more detail instead of highlighting it. */
  canOpen?: boolean;
};

type DonutPanelProps = {
  /** Accessible name for the chart. */
  title: string;
  items: DonutItem[];
  total: number;
  currency: string;
  onOpen?: (id: number) => void;
};

/** Displays amounts as an interactive donut with a selectable legend. */
export default function DonutPanel({
  title,
  items,
  total,
  currency,
  onOpen,
}: DonutPanelProps) {
  const plottedTotal = items.reduce(
    (sum, item) => sum + Math.max(0, item.amountCents),
    0,
  );
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const activeItem =
    items.find(({ id }) => id === hoveredId) ??
    items.find(({ id }) => id === selectedId);
  let offset = 0;

  const chooseItem = ({ id, canOpen }: DonutItem) => {
    if (canOpen) {
      onOpen?.(id);
      return;
    }
    setSelectedId((current) => (current === id ? null : id));
  };

  return (
    <div className="mt-4 grid items-center justify-items-center gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <div
        className="relative aspect-square w-36 shrink-0"
        role="group"
        aria-label={`${title} chart totaling ${formatCurrency(total, currency)} across ${items.length} categories`}
      >
        <DonutSvg geometry={GEOMETRY} strokeWidth={20}>
          {items.map(({ id, color, amountCents }, index) => {
            const segmentLength =
              plottedTotal > 0
                ? (Math.max(0, amountCents) / plottedTotal) *
                  GEOMETRY.circumference
                : 0;
            const isActive = id === (activeItem?.id ?? null);
            const segment = (
              <DonutArc
                key={id}
                geometry={GEOMETRY}
                className={`transition-all duration-150${activeItem && !isActive ? " opacity-30" : ""}`}
                color={
                  color ??
                  FALLBACK_COLORS[index % FALLBACK_COLORS.length] ??
                  NEUTRAL_SEGMENT_COLOR
                }
                strokeWidth={isActive ? 26 : 20}
                length={segmentLength}
                offset={offset}
              />
            );
            offset += segmentLength;
            return segment;
          })}
        </DonutSvg>
        {activeItem ? (
          <div
            className="pointer-events-none absolute inset-[22%] z-10 flex flex-col items-center justify-center rounded-full border border-slate-700 bg-slate-950/95 px-2 text-center shadow-lg"
            role="status"
            aria-live="polite"
          >
            <span className="max-w-full truncate text-xs text-slate-300">
              {activeItem.name}
            </span>
            <strong className="mt-1 text-sm font-semibold tabular-nums text-white">
              {formatCurrency(activeItem.amountCents, currency)}
            </strong>
          </div>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
            {formatCurrency(total, currency)}
          </span>
        )}
      </div>
      <ul className="w-full min-w-0 space-y-2">
        {items.map((item, index) => {
          const { id, name, color, amountCents, canOpen } = item;
          return (
            <li key={id} className="text-sm text-slate-300">
              <button
                type="button"
                className={`flex w-full items-center gap-2 rounded-lg text-left transition hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400${id === (activeItem?.id ?? null) ? " bg-slate-800/70 text-white" : ""}`}
                aria-label={`${name}: ${formatCurrency(amountCents, currency)}${canOpen ? ", show subcategories" : ""}`}
                aria-pressed={canOpen ? undefined : selectedId === id}
                onMouseEnter={() => setHoveredId(id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(id)}
                onBlur={() => setHoveredId(null)}
                onClick={() => chooseItem(item)}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
                  }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{name}</span>
                {canOpen && (
                  <span className="text-slate-500" aria-hidden="true">
                    ›
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {items.length === 0 && (
          <li className="py-3 text-sm text-slate-400">
            No categorized activity yet.
          </li>
        )}
      </ul>
    </div>
  );
}
