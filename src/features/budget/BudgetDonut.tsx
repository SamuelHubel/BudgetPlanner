import { formatCurrency } from "../../shared/format";
import { donutSegments, type AllocationSummary } from "./budgetMath";

const RADIUS = 56;
const VIEWBOX = 144;
const CENTER = VIEWBOX / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Surface gap between arcs, so neighbors stay distinct without color alone. */
const SEGMENT_GAP = 2;
const MIN_SEGMENT_LENGTH = 1;
const FALLBACK_COLOR = "#94a3b8";

/** A category's allocation as drawn on the donut. */
export type DonutRow = {
  id: number;
  name: string;
  color: string | null;
  cents: number;
};

type BudgetDonutProps = {
  rows: DonutRow[];
  incomeCents: number;
  summary: AllocationSummary;
  currency: string;
  /** Category highlighted from the list, or `null`. */
  activeId: number | null;
};

/**
 * Shows how much of the expected income is allocated. The ring is the full
 * income and fills category by category, whether values came from sliders or
 * typed amounts.
 */
export default function BudgetDonut({
  rows,
  incomeCents,
  summary,
  currency,
  activeId,
}: BudgetDonutProps) {
  const segments = donutSegments(
    rows.map(({ id, color, cents }) => ({
      id,
      color: color ?? FALLBACK_COLOR,
      cents,
    })),
    incomeCents,
  );
  const activeRow = rows.find(({ id }) => id === activeId);
  const isOver = summary.overCents > 0;

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className="relative aspect-square w-48"
        role="img"
        aria-label={`${summary.allocatedPercent}% of income allocated`}
      >
        <svg
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          aria-hidden="true"
          focusable="false"
        >
          <circle
            className="fill-none stroke-slate-800"
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            strokeWidth="20"
          />
          {segments.map(({ id, color, start, fraction }) => {
            const length = Math.max(
              fraction * CIRCUMFERENCE - SEGMENT_GAP,
              MIN_SEGMENT_LENGTH,
            );
            const isDimmed = activeRow !== undefined && id !== activeRow.id;
            return (
              <circle
                key={id}
                className={`transition-all duration-150 motion-reduce:transition-none${isDimmed ? " opacity-30" : ""}`}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={color}
                strokeWidth={id === activeRow?.id ? 24 : 20}
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={-start * CIRCUMFERENCE}
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
              />
            );
          })}
          {isOver && (
            <circle
              className="fill-none stroke-rose-400"
              cx={CENTER}
              cy={CENTER}
              r={69}
              strokeWidth="2"
            />
          )}
        </svg>
        <div
          className="absolute inset-[24%] flex flex-col items-center justify-center"
          aria-hidden="true"
        >
          {activeRow ? (
            <>
              <span className="max-w-full truncate text-xs text-slate-300">
                {activeRow.name}
              </span>
              <strong className="text-sm font-semibold tabular-nums text-white">
                {formatCurrency(activeRow.cents, currency)}
              </strong>
            </>
          ) : (
            <>
              <strong className="text-2xl font-semibold tabular-nums text-white">
                {summary.allocatedPercent}%
              </strong>
              <span className="text-xs text-slate-400">allocated</span>
            </>
          )}
        </div>
      </div>
      <p
        className={`text-sm tabular-nums ${isOver ? "text-rose-300" : "text-slate-300"}`}
      >
        {isOver
          ? `Over by ${formatCurrency(summary.overCents, currency)}`
          : `Unallocated: ${formatCurrency(summary.unallocatedCents, currency)}`}
      </p>
    </div>
  );
}
