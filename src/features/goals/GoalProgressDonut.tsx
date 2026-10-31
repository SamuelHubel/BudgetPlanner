import { formatCurrency, formatMonth } from "../../shared/format";
import type { GoalProgress } from "../../types";

const RADIUS = 26;
const VIEWBOX = 64;
const CENTER = VIEWBOX / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Share of the limit at which the meter turns from "on track" to "close". */
const WARNING_RATIO = 0.75;

type GoalProgressDonutProps = {
  /** Spending progress, or `null` when untracked or no data exists yet. */
  progress: GoalProgress | null;
  /** Linked category name; `null` when the goal is untracked. */
  categoryName: string | null;
  currency: string;
};

/** Picks the meter color for a spent/limit ratio (green, amber, then rose). */
function meterColor(ratio: number): string {
  if (ratio > 1) return "#fb7185";
  if (ratio >= WARNING_RATIO) return "#fbbf24";
  return "#34d399";
}

/**
 * Shows how much of a goal's monthly spending limit has been used.
 *
 * The ring fills with the spent/limit ratio and caps at a full ring when the
 * limit is exceeded; the center shows the uncapped percentage.
 */
export default function GoalProgressDonut({
  progress,
  categoryName,
  currency,
}: GoalProgressDonutProps) {
  if (!progress) {
    const label = categoryName
      ? `${categoryName}: no spending data yet`
      : "Not tracked";
    return (
      <div className="flex w-20 shrink-0 flex-col items-center gap-1 text-center">
        <div
          className="relative aspect-square w-16"
          role="img"
          aria-label={label}
        >
          <svg
            viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
            aria-hidden="true"
            focusable="false"
          >
            <circle
              className="fill-none stroke-slate-700"
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              strokeWidth="8"
              strokeDasharray="4 4"
            />
          </svg>
          <span
            className="absolute inset-0 flex items-center justify-center text-sm text-slate-500"
            aria-hidden="true"
          >
            —
          </span>
        </div>
        <span className="text-xs text-slate-500" aria-hidden="true">
          {categoryName ? "No data yet" : "Not tracked"}
        </span>
      </div>
    );
  }

  const { month, spentCents, limitCents } = progress;
  const ratio = spentCents / limitCents;
  const percent = Math.round(ratio * 100);
  const filledLength = Math.min(ratio, 1) * CIRCUMFERENCE;
  const overCents = spentCents - limitCents;
  const spent = formatCurrency(spentCents, currency);
  const limit = formatCurrency(limitCents, currency);
  const label =
    `${categoryName ?? "Spending"}: ${spent} of ${limit} spent in ` +
    `${formatMonth(month)} (${percent}%)` +
    (overCents > 0 ? `, over by ${formatCurrency(overCents, currency)}` : "");

  return (
    <div className="flex w-20 shrink-0 flex-col items-center gap-1 text-center">
      <div
        className="relative aspect-square w-16"
        role="img"
        aria-label={label}
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
            strokeWidth="8"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={meterColor(ratio)}
            strokeWidth="8"
            strokeLinecap={filledLength > 0 && ratio < 1 ? "round" : "butt"}
            strokeDasharray={`${filledLength} ${CIRCUMFERENCE - filledLength}`}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums text-white"
          aria-hidden="true"
        >
          {percent}%
        </span>
      </div>
      <span
        className={`text-xs tabular-nums ${overCents > 0 ? "text-rose-300" : "text-slate-400"}`}
        aria-hidden="true"
      >
        {overCents > 0
          ? `Over by ${formatCurrency(overCents, currency)}`
          : `${formatMonth(month, "short")}`}
      </span>
    </div>
  );
}
